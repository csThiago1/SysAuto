# PWA Onda 5 — Offline Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fila de mutations offline (Dexie) com idempotência por `client_uuid`, reconciliação de IDs e detecção de conflito via `If-Match`, conforme Seção 6 do spec `docs/superpowers/specs/2026-06-22-mobile-webapp-session-design.md`.

**Architecture:** Writes que falham por queda de rede são enfileirados em IndexedDB (Dexie, tabela única `drafts`) e re-enviados quando a conexão volta. Backend ganha coluna `client_uuid` (idempotência de creates) e suporte a `If-Match` → 409 no PATCH de OS. Leituras offline já são servidas pelo service worker NetworkFirst da onda 2 — nada a fazer.

**Tech Stack:** Dexie 4 + dexie-react-hooks, uuid (v7), fake-indexeddb (testes), Django/DRF, django-tenants.

## Global Constraints

- TypeScript strict, nunca `any` — `unknown` + narrowing.
- Python type hints obrigatórios; nunca `print()`, sempre `logger`.
- Cores só por design tokens (`warning-*`, `error-*`) — nunca cor bruta.
- Hooks de API sempre `/api/proxy/`.
- Respostas de erro DRF sempre `"detail"`.
- Testes backend: pytest via `docker exec paddock_django pytest ...`. Frontend: `npx vitest run ...` em `apps/dscar-web`.
- Commits conventional: `feat(offline): ...`, `feat(pwa): ...`.
- Dev server Django roda da pasta principal (não editar em `.worktrees/`).

## Decisões de escopo (deliberadas — não "esquecimentos")

1. **Sem tabelas Dexie de leitura** (`service_orders`, `clientes`, `pecas` do spec): o SW NetworkFirst (`api-get-cache`, onda 2) já serve GETs offline de forma transparente. Dexie guarda só a fila de mutations. Adicionar cache de leitura estruturado se o cache HTTP se mostrar insuficiente.
2. **Sem `BackgroundSyncPlugin` do Serwist**: a fila Dexie é o único mecanismo de replay — o plugin duplicaria o re-envio (dupla fila). Drain via evento `online` + mount do `useOfflineSync`. Sync com app fechado fica pra depois se houver demanda real.
3. **`If-Match` só em PATCHes de OS enfileirados offline**: o `updated_at` é lido do cache do SW no momento do enqueue. Fluxo online permanece inalterado (zero risco de regressão nas telas atuais). Backend aceita o header em qualquer update, quando presente.
4. **Modal de conflito com 3 ações** (ver OS, manter minhas/sobrescrever, descartar). "Merge manual" do spec = abrir a OS e reeditar — coberto pela ação "ver OS".
5. **Draft sincronizado é deletado** (não guardamos status `synced` — o badge some, histórico não é requisito).
6. **Whitelist de URLs enfileiráveis** em vez de marcar `offline: false` em dezenas de call sites: NF-e, faturamento, aprovação de OC e transição → `delivered` ficam fora da whitelist e falham rápido como hoje.
7. **Complemento particular** (`complement/parts`, `complement/services`): fluxo desktop/financeiro, online-only — sem idempotência (fora da whitelist).
8. **Ceiling conhecido:** criar OS offline retorna `id = client_uuid`; se a tela navegar pra OS recém-criada, ela só existe após o sync. O banner de pendências é a mitigação. Reconciliação de navegação otimista fica pra iteração futura se incomodar na prática.
9. **Serializers não mudam** (o `client_uuid` é lido de `request.data` nas views e não aparece nas responses) → schema OpenAPI inalterado, sem `make gen-api-types`.

---

### Task 1: Backend — campo `client_uuid` nos models + migrations

**Files:**
- Modify: `backend/core/apps/service_orders/models/service_order.py` (classes `ServiceOrder` e `ServiceOrderPhoto`)
- Modify: `backend/core/apps/service_orders/models/items.py` (classe `ServiceOrderPart`)
- Modify: `backend/core/apps/service_orders/models/capacity.py` (classe `ApontamentoHoras`)
- Modify: `backend/core/apps/signatures/models.py` (classe `Signature`)

**Interfaces:**
- Produces: campo `client_uuid: CharField(max_length=36, unique=True, null=True, blank=True)` nos 5 models — usado pelas Tasks 2 e 3.

- [ ] **Step 1: Adicionar o campo aos 5 models**

Em cada um dos 5 models, adicionar (mesmo bloco, ao final dos campos existentes da classe):

```python
    client_uuid = models.CharField(
        max_length=36,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        help_text="UUID v7 gerado no cliente — idempotência do sync offline (PWA onda 5)",
    )
```

Nota: `unique=True` + `null=True` — Postgres permite múltiplos NULL; nunca gravar `""` (usar `or None` nas views, Task 3).

- [ ] **Step 2: Gerar e aplicar migrations**

```bash
docker exec paddock_django python manage.py makemigrations service_orders signatures
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar && make migrate
```

Expected: 1 migration em `service_orders` (4 AddField) + 1 em `signatures` (1 AddField); `migrate_schemas` OK em todos os tenants.

- [ ] **Step 3: Commit**

```bash
git add backend/core/apps/service_orders/models/ backend/core/apps/signatures/models.py backend/core/apps/*/migrations/
git commit -m "feat(offline): client_uuid em OS, foto, peça, apontamento e assinatura"
```

---

### Task 2: Backend — helpers de idempotência e If-Match com testes

**Files:**
- Create: `backend/core/apps/service_orders/offline.py`
- Test: `backend/core/apps/service_orders/tests/test_offline_sync.py`

**Interfaces:**
- Produces: `Conflict` (APIException 409), `find_by_client_uuid(model, request) -> Model | None`, `check_if_match(instance, request) -> None` (levanta `Conflict`). Consumidos pela Task 3.

- [ ] **Step 1: Escrever os testes (falhando)**

```python
"""Testes da camada offline sync — idempotência client_uuid e If-Match (PWA onda 5)."""
import hashlib
from types import SimpleNamespace

from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.persons.models import Person, PersonRole
from apps.service_orders.models import ServiceOrder, ServiceOrderStatus
from apps.service_orders.offline import Conflict, check_if_match, find_by_client_uuid

CLIENT_UUID = "0198c0de-aaaa-7000-8000-000000000001"


class OfflineSyncTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        email = "offline@dscar.com"
        self.user = GlobalUser.objects.create_user(
            email=email,
            email_hash=hashlib.sha256(email.encode()).hexdigest(),
            password="x",
        )
        person = Person.objects.create(person_kind="PF", full_name="Cliente Offline")
        PersonRole.objects.create(person=person, role="CLIENT")
        self.order = ServiceOrder.objects.create(
            number=9901,
            plate="OFF1L23",
            customer=person,
            customer_name=person.full_name,
            customer_type="private",
            status=ServiceOrderStatus.RECEPTION,
            created_by=self.user,
            client_uuid=CLIENT_UUID,
        )

    @staticmethod
    def _request(data: dict | None = None, headers: dict | None = None) -> SimpleNamespace:
        return SimpleNamespace(data=data or {}, headers=headers or {})

    def test_find_by_client_uuid_retorna_existente(self) -> None:
        req = self._request({"client_uuid": CLIENT_UUID})
        assert find_by_client_uuid(ServiceOrder, req) == self.order

    def test_find_by_client_uuid_sem_campo_retorna_none(self) -> None:
        assert find_by_client_uuid(ServiceOrder, self._request()) is None
        assert find_by_client_uuid(ServiceOrder, self._request({"client_uuid": ""})) is None

    def test_if_match_igual_passa(self) -> None:
        self.order.refresh_from_db()
        req = self._request(headers={"If-Match": self.order.updated_at.isoformat()})
        check_if_match(self.order, req)  # não deve levantar

    def test_if_match_divergente_levanta_conflict(self) -> None:
        req = self._request(headers={"If-Match": "2020-01-01T00:00:00+00:00"})
        with self.assertRaises(Conflict):
            check_if_match(self.order, req)

    def test_sem_if_match_passa(self) -> None:
        check_if_match(self.order, self._request())  # header ausente = sem verificação
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
docker exec paddock_django pytest apps/service_orders/tests/test_offline_sync.py -v
```

Expected: FAIL — `ModuleNotFoundError: apps.service_orders.offline`.

- [ ] **Step 3: Implementar `offline.py`**

```python
"""Helpers do sync offline (PWA onda 5) — idempotência por client_uuid e If-Match.

O cliente offline enfileira mutations com um UUID v7 gerado no device.
No replay, creates idempotentes devolvem a entidade já criada em vez de
duplicar; updates com If-Match divergente levantam 409 pro cliente abrir
o fluxo de resolução de conflito.
"""
from typing import Optional, Type, TypeVar

from django.db import models
from rest_framework.exceptions import APIException

M = TypeVar("M", bound=models.Model)


class Conflict(APIException):
    """HTTP 409 — recurso alterado por outro usuário (If-Match divergente)."""

    status_code = 409
    default_detail = "Recurso alterado por outro usuário."
    default_code = "conflict"


def find_by_client_uuid(model: Type[M], request) -> Optional[M]:
    """Retorna a instância já sincada se request.data trouxer um client_uuid conhecido."""
    client_uuid = request.data.get("client_uuid") or ""
    if not client_uuid:
        return None
    return model.objects.filter(client_uuid=client_uuid).first()


def check_if_match(instance: models.Model, request) -> None:
    """Levanta Conflict(409) se o header If-Match diverge do updated_at atual.

    Header ausente = sem verificação (fluxo online atual permanece intacto).
    """
    if_match = request.headers.get("If-Match")
    if not if_match:
        return
    current = instance.updated_at.isoformat()
    if current != if_match:
        raise Conflict(
            detail=(
                f"Registro alterado por outro usuário em "
                f"{instance.updated_at:%d/%m %H:%M}."
            )
        )
```

- [ ] **Step 4: Rodar e ver passar**

```bash
docker exec paddock_django pytest apps/service_orders/tests/test_offline_sync.py -v
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/core/apps/service_orders/offline.py backend/core/apps/service_orders/tests/test_offline_sync.py
git commit -m "feat(offline): helpers de idempotência client_uuid e If-Match 409"
```

---

### Task 3: Backend — wiring nas views (creates idempotentes + If-Match no update)

**Files:**
- Modify: `backend/core/apps/service_orders/views/orders.py` (actions `create`, `update`, `photos`, `parts`, e os POSTs de `parts/estoque`, `parts/compra`, `parts/seguradora` — linhas ~280, ~299, ~1057, ~661, ~776, ~829, ~872)
- Modify: `backend/core/apps/service_orders/views/apontamento.py` (método `create`, linha ~48)
- Modify: `backend/core/apps/signatures/views.py` (action `capture`, linha ~34)

**Interfaces:**
- Consumes: `find_by_client_uuid`, `check_if_match` da Task 2; campo `client_uuid` da Task 1.
- Produces: todos os endpoints que a fila offline replaya são idempotentes; `PATCH /service-orders/{id}/` com `If-Match` divergente → 409 `{"detail": "..."}`.

- [ ] **Step 1: Imports em `views/orders.py`**

```python
from apps.service_orders.offline import check_if_match, find_by_client_uuid
```

- [ ] **Step 2: `ServiceOrderViewSet.create` — idempotência**

No topo do método (antes de instanciar o serializer):

```python
        existing = find_by_client_uuid(ServiceOrder, request)
        if existing:
            return Response(
                ServiceOrderDetailSerializer(existing, context={"request": request}).data
            )
```

Após `order = ServiceOrderService.create(...)` (sem tocar no service — o campo é gravado direto):

```python
        client_uuid = request.data.get("client_uuid") or None
        if client_uuid:
            ServiceOrder.objects.filter(pk=order.pk).update(client_uuid=client_uuid)
```

- [ ] **Step 3: `ServiceOrderViewSet.update` — If-Match**

Logo após `instance = self.get_object()`:

```python
        check_if_match(instance, request)
```

- [ ] **Step 4: Action `photos` (POST) — idempotência**

No início do branch `if request.method == "POST":`:

```python
            existing = find_by_client_uuid(ServiceOrderPhoto, request)
            if existing:
                return Response(
                    ServiceOrderPhotoSerializer(existing, context={"request": request}).data
                )
```

E no `ServiceOrderPhoto.objects.create(...)` existente, adicionar o kwarg:

```python
                client_uuid=request.data.get("client_uuid") or None,
```

- [ ] **Step 5: Actions de peças — idempotência**

Em `parts` (POST), `parts/estoque`, `parts/compra` e `parts/seguradora`: no início do branch POST de cada action:

```python
            existing = find_by_client_uuid(ServiceOrderPart, request)
            if existing:
                return Response(ServiceOrderPartSerializer(existing).data)
```

Na action `parts`, o create é via serializer — adicionar o kwarg no `serializer.save(...)`:

```python
            part = serializer.save(
                service_order=service_order,
                created_by=request.user,
                client_uuid=request.data.get("client_uuid") or None,
            )
```

Nas outras 3 actions, adicionar `client_uuid=request.data.get("client_uuid") or None,` em **cada** chamada `ServiceOrderPart.objects.create(` dentro da action (grep: linhas ~809, ~841, ~884).

- [ ] **Step 6: `ApontamentoViewSet.create` — idempotência**

Import no topo de `views/apontamento.py`:

```python
from apps.service_orders.offline import find_by_client_uuid
```

No início do método `create` (antes do serializer):

```python
        existing = find_by_client_uuid(ApontamentoHoras, request)
        if existing:
            return Response(ApontamentoSerializer(existing).data)
```

E no `ApontamentoHoras.objects.create(...)`, adicionar:

```python
            client_uuid=request.data.get("client_uuid") or None,
```

- [ ] **Step 7: `SignatureViewSet.capture` — idempotência**

Import no topo de `signatures/views.py`:

```python
from apps.service_orders.offline import find_by_client_uuid
```

(Nota: import de módulo utilitário, não de model — permitido pelas regras de isolamento.)

No início da action `capture`:

```python
        existing = find_by_client_uuid(Signature, request)
        if existing:
            return Response(SignatureDetailSerializer(existing).data)
```

Após `signature = SignatureService.capture(...)`:

```python
        client_uuid = request.data.get("client_uuid") or None
        if client_uuid:
            Signature.objects.filter(pk=signature.pk).update(client_uuid=client_uuid)
```

- [ ] **Step 8: Teste de integração da idempotência de OS**

Adicionar ao `test_offline_sync.py`:

```python
    def test_create_os_duplicado_por_client_uuid_nao_duplica(self) -> None:
        """Replay do mesmo client_uuid devolve a OS existente em vez de criar outra."""
        req = self._request({"client_uuid": CLIENT_UUID})
        found = find_by_client_uuid(ServiceOrder, req)
        assert found is not None
        assert ServiceOrder.objects.filter(client_uuid=CLIENT_UUID).count() == 1
```

- [ ] **Step 9: Rodar suite do app + smoke da suite de OS**

```bash
docker exec paddock_django pytest apps/service_orders/tests/test_offline_sync.py apps/service_orders/tests/test_mvp_pipeline.py -v
```

Expected: tudo passed (mvp_pipeline garante que os creates não regrediram).

- [ ] **Step 10: Commit**

```bash
git add backend/core/apps/service_orders/views/ backend/core/apps/signatures/views.py backend/core/apps/service_orders/tests/test_offline_sync.py
git commit -m "feat(offline): creates idempotentes por client_uuid + If-Match 409 no update de OS"
```

---

### Task 4: Frontend — deps + schema Dexie

**Files:**
- Modify: `apps/dscar-web/package.json` (via npm install)
- Create: `apps/dscar-web/src/lib/offline/db.ts`

**Interfaces:**
- Produces: `db` (Dexie com tabela `drafts`), `DraftMutation`, `DraftStatus` — consumidos pelas Tasks 5–8.

- [ ] **Step 1: Instalar dependências**

```bash
cd apps/dscar-web && npm install dexie dexie-react-hooks uuid && npm install -D fake-indexeddb
```

- [ ] **Step 2: Criar `src/lib/offline/db.ts`**

```ts
import Dexie, { type EntityTable } from "dexie";

export type DraftStatus = "pending" | "syncing" | "conflict" | "failed";

/**
 * Mutation enfileirada offline. Replay genérico por URL+método —
 * o payload JSON (ou campos do FormData) é remontado no drain.
 */
export interface DraftMutation {
  /** client_uuid v7 — também injetado no payload pra idempotência no backend */
  id: string;
  url: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  headers: Record<string, string>;
  /** body JSON, ou campos texto do FormData (multipart) */
  payload?: Record<string, unknown>;
  /** arquivo do FormData, se houver (Blob é serializável em IndexedDB) */
  blob?: Blob;
  blobField?: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
  status: DraftStatus;
}

// ponytail: sem tabelas de cache de leitura — o SW NetworkFirst já serve GETs
// offline; adicionar cache estruturado só se o cache HTTP se provar insuficiente.
export const db = new Dexie("dscar-offline") as Dexie & {
  drafts: EntityTable<DraftMutation, "id">;
};

db.version(1).stores({
  drafts: "id, status, createdAt",
});
```

- [ ] **Step 3: Typecheck e commit**

```bash
npx tsc --noEmit
git add package.json package-lock.json src/lib/offline/db.ts
git commit -m "feat(offline): schema Dexie da fila de mutations (dexie, uuid, fake-indexeddb)"
```

---

### Task 5: Frontend — queue.ts (enqueue, drain, reconciliação, conflito) + testes

**Files:**
- Create: `apps/dscar-web/src/lib/offline/queue.ts`
- Create: `apps/dscar-web/src/lib/offline/describe.ts`
- Test: `apps/dscar-web/src/lib/offline/queue.test.ts`

**Interfaces:**
- Consumes: `db`, `DraftMutation` da Task 4.
- Produces: `enqueueMutation(url: string, init: RequestInit): Promise<DraftMutation>`, `drainQueue(): Promise<void>`, `isQueueable(url: string, init: RequestInit): boolean`, `keepMine(draftId: string)`, `discardDraft(draftId: string)`, `describeDraft(d: DraftMutation): string`.

- [ ] **Step 1: Escrever os testes (falhando)**

```ts
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import { discardDraft, drainQueue, enqueueMutation, isQueueable, keepMine } from "./queue";

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

beforeEach(async () => {
  await db.drafts.clear();
  vi.restoreAllMocks();
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("caches", { match: vi.fn().mockResolvedValue(undefined) });
});

describe("isQueueable", () => {
  it("aceita writes de OS/fotos/peças/apontamento/assinatura", () => {
    expect(isQueueable("/api/proxy/service-orders/", { method: "POST" })).toBe(true);
    expect(isQueueable("/api/proxy/service-orders/abc-123/photos/", { method: "POST" })).toBe(true);
    expect(isQueueable("/api/proxy/signatures/capture/", { method: "POST" })).toBe(true);
  });

  it("rejeita GET, fiscal e transição pra delivered", () => {
    expect(isQueueable("/api/proxy/service-orders/", {})).toBe(false);
    expect(isQueueable("/api/proxy/fiscal/nfe/", { method: "POST" })).toBe(false);
    expect(
      isQueueable("/api/proxy/service-orders/abc/transition/", {
        method: "POST",
        body: JSON.stringify({ new_status: "delivered" }),
      }),
    ).toBe(false);
  });
});

describe("enqueueMutation", () => {
  it("injeta client_uuid no payload JSON", async () => {
    const draft = await enqueueMutation(
      "/api/proxy/service-orders/",
      jsonInit("POST", { plate: "ABC1D23" }),
    );
    expect(draft.payload?.client_uuid).toBe(draft.id);
    expect(draft.payload?.plate).toBe("ABC1D23");
    expect(await db.drafts.count()).toBe(1);
  });

  it("separa blob dos campos texto em FormData", async () => {
    const fd = new FormData();
    fd.append("folder", "initial_survey");
    fd.append("file", new Blob(["x"], { type: "image/jpeg" }), "foto.jpg");
    const draft = await enqueueMutation("/api/proxy/service-orders/abc/photos/", {
      method: "POST",
      body: fd,
    });
    expect(draft.payload?.folder).toBe("initial_survey");
    expect(draft.blobField).toBe("file");
    expect(draft.blob).toBeInstanceOf(Blob);
  });
});

describe("drainQueue", () => {
  it("2xx remove o draft e reconcilia o id nos drafts dependentes", async () => {
    const os = await enqueueMutation("/api/proxy/service-orders/", jsonInit("POST", { plate: "A" }));
    await enqueueMutation(
      `/api/proxy/service-orders/${os.id}/photos/`,
      jsonInit("POST", { folder: "initial_survey" }),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "real-1" }), { status: 201 }))
      .mockResolvedValueOnce(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await drainQueue();

    expect(await db.drafts.count()).toBe(0);
    expect(String(fetchMock.mock.calls[1][0])).toContain("real-1");
  });

  it("409 marca conflict e mantém o draft", async () => {
    const d = await enqueueMutation("/api/proxy/service-orders/abc/", jsonInit("PATCH", { plate: "B" }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "alterada" }), { status: 409 })),
    );

    await drainQueue();

    const after = await db.drafts.get(d.id);
    expect(after?.status).toBe("conflict");
  });

  it("erro de rede mantém pending e interrompe o drain", async () => {
    const d = await enqueueMutation("/api/proxy/service-orders/", jsonInit("POST", { plate: "C" }));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

    await drainQueue();

    const after = await db.drafts.get(d.id);
    expect(after?.status).toBe("pending");
  });
});

describe("resolução de conflito", () => {
  it("keepMine remove If-Match e volta pra pending", async () => {
    const d = await enqueueMutation("/api/proxy/service-orders/abc/", jsonInit("PATCH", { plate: "D" }));
    await db.drafts.update(d.id, { status: "conflict", headers: { "If-Match": "2020-01-01" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));

    await keepMine(d.id);

    expect(await db.drafts.count()).toBe(0); // re-drenado com sucesso
  });

  it("discardDraft deleta", async () => {
    const d = await enqueueMutation("/api/proxy/service-orders/", jsonInit("POST", { plate: "E" }));
    await discardDraft(d.id);
    expect(await db.drafts.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/lib/offline/queue.test.ts
```

Expected: FAIL — `Cannot find module './queue'`.

- [ ] **Step 3: Implementar `queue.ts`**

```ts
import { v7 as uuidv7 } from "uuid";
import { db, type DraftMutation } from "./db";

// Operações que a fila offline pode replayar. Tudo fora daqui (NF-e,
// faturamento, aprovação de OC, delivered) falha rápido como hoje.
const QUEUEABLE: RegExp[] = [
  /^\/api\/proxy\/service-orders\/$/,
  /^\/api\/proxy\/service-orders\/[0-9a-f-]+\/$/,
  /^\/api\/proxy\/service-orders\/[0-9a-f-]+\/(photos|parts|parts\/estoque|labor|apontamentos|transition|checklist-items\/bulk)\/$/,
  /^\/api\/proxy\/signatures\/capture\/$/,
];

export function isQueueable(url: string, init: RequestInit): boolean {
  const method = init.method ?? "GET";
  if (method === "GET") return false;
  const path = url.startsWith("/") ? url : new URL(url, window.location.origin).pathname;
  if (!QUEUEABLE.some((re) => re.test(path))) return false;
  // Transição → delivered é online-only (dispara faturamento/NF-e no backend)
  if (
    /\/transition\/$/.test(path) &&
    typeof init.body === "string" &&
    init.body.includes('"delivered"')
  ) {
    return false;
  }
  return true;
}

function normalizeHeaders(h: HeadersInit | undefined): Record<string, string> {
  if (!h) return {};
  if (h instanceof Headers) return Object.fromEntries(h.entries());
  if (Array.isArray(h)) return Object.fromEntries(h);
  return { ...h };
}

export async function enqueueMutation(url: string, init: RequestInit): Promise<DraftMutation> {
  const id = uuidv7();
  const headers = normalizeHeaders(init.headers);
  let payload: Record<string, unknown> | undefined;
  let blob: Blob | undefined;
  let blobField: string | undefined;

  if (init.body instanceof FormData) {
    payload = {};
    for (const [key, value] of init.body.entries()) {
      if (value instanceof Blob) {
        blob = value;
        blobField = key;
      } else {
        payload[key] = value;
      }
    }
    payload.client_uuid = id;
    delete headers["Content-Type"]; // multipart é remontado no drain
  } else if (typeof init.body === "string") {
    payload = { ...(JSON.parse(init.body) as Record<string, unknown>), client_uuid: id };
  }

  // PATCH de OS: If-Match com o updated_at da última versão vista (cache do SW).
  // Sem cache → sem If-Match → sem detecção de conflito (comportamento atual).
  if (/\/service-orders\/[0-9a-f-]+\/$/.test(url) && init.method === "PATCH") {
    const cached = await caches.match(url).catch(() => undefined);
    if (cached) {
      const data = (await cached.json().catch(() => ({}))) as { updated_at?: string };
      if (data.updated_at) headers["If-Match"] = data.updated_at;
    }
  }

  const draft: DraftMutation = {
    id,
    url,
    method: (init.method ?? "POST") as DraftMutation["method"],
    headers,
    payload,
    blob,
    blobField,
    createdAt: Date.now(),
    attempts: 0,
    status: "pending",
  };
  await db.drafts.add(draft);
  return draft;
}

function buildRequest(draft: DraftMutation): RequestInit {
  if (draft.blob && draft.blobField) {
    const fd = new FormData();
    Object.entries(draft.payload ?? {}).forEach(([k, v]) => fd.append(k, String(v)));
    fd.append(draft.blobField, draft.blob);
    return { method: draft.method, headers: draft.headers, body: fd };
  }
  return {
    method: draft.method,
    headers: { "Content-Type": "application/json", ...draft.headers },
    body: draft.payload ? JSON.stringify(draft.payload) : undefined,
  };
}

async function errDetail(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { detail?: string };
  return body.detail ?? `HTTP ${res.status}`;
}

/** Substitui o client_uuid recém-sincado pelo id real nos drafts dependentes. */
async function reconcileId(clientUuid: string, remoteId: string): Promise<void> {
  const all = await db.drafts.toArray();
  for (const d of all) {
    const url = d.url.replaceAll(clientUuid, remoteId);
    const payloadStr = d.payload ? JSON.stringify(d.payload) : undefined;
    const newPayloadStr = payloadStr?.replaceAll(clientUuid, remoteId);
    if (url !== d.url || newPayloadStr !== payloadStr) {
      await db.drafts.update(d.id, {
        url,
        payload: newPayloadStr ? (JSON.parse(newPayloadStr) as Record<string, unknown>) : d.payload,
      });
    }
  }
}

/** @returns false se a rede caiu de novo (interrompe o drain) */
async function syncDraft(draft: DraftMutation): Promise<boolean> {
  await db.drafts.update(draft.id, { status: "syncing", attempts: draft.attempts + 1 });
  let res: Response;
  try {
    res = await fetch(draft.url, buildRequest(draft));
  } catch {
    await db.drafts.update(draft.id, { status: "pending", lastError: "network_error" });
    return false;
  }
  if (res.ok) {
    const body = (await res.json().catch(() => ({}))) as { id?: number | string };
    if (draft.method === "POST" && body.id != null) {
      await reconcileId(draft.id, String(body.id));
    }
    await db.drafts.delete(draft.id);
  } else if (res.status === 409) {
    await db.drafts.update(draft.id, { status: "conflict", lastError: await errDetail(res) });
  } else {
    await db.drafts.update(draft.id, { status: "failed", lastError: await errDetail(res) });
  }
  return true;
}

let draining = false;

export async function drainQueue(): Promise<void> {
  if (draining || !navigator.onLine) return;
  draining = true;
  try {
    const pending = await db.drafts.where("status").equals("pending").sortBy("createdAt");
    for (const stale of pending) {
      // reler: reconciliações de drafts anteriores podem ter alterado url/payload
      const draft = await db.drafts.get(stale.id);
      if (!draft || draft.status !== "pending") continue;
      const ok = await syncDraft(draft);
      if (!ok) break;
    }
  } finally {
    draining = false;
  }
}

/** Conflito → "manter minhas alterações": re-envia sem If-Match (sobrescreve). */
export async function keepMine(draftId: string): Promise<void> {
  const draft = await db.drafts.get(draftId);
  if (!draft) return;
  const headers = { ...draft.headers };
  delete headers["If-Match"];
  await db.drafts.update(draftId, { status: "pending", headers, lastError: undefined });
  await drainQueue();
}

export async function discardDraft(draftId: string): Promise<void> {
  await db.drafts.delete(draftId);
}
```

- [ ] **Step 4: Implementar `describe.ts`**

```ts
import type { DraftMutation } from "./db";

const RULES: Array<[RegExp, string]> = [
  [/\/photos\/$/, "Foto"],
  [/\/signatures\/capture\/$/, "Assinatura"],
  [/\/apontamentos\/$/, "Apontamento de horas"],
  [/\/parts(\/|$)/, "Peça"],
  [/\/labor\/$/, "Serviço"],
  [/\/transition\/$/, "Transição de status"],
  [/\/checklist-items\/bulk\/$/, "Checklist"],
  [/\/service-orders\/$/, "Nova OS"],
  [/\/service-orders\/[0-9a-f-]+\/$/, "Edição de OS"],
];

/** Rótulo PT-BR de um draft pra exibição em banner/modal. */
export function describeDraft(d: DraftMutation): string {
  for (const [re, label] of RULES) {
    if (re.test(d.url)) return label;
  }
  return `${d.method} ${d.url}`;
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
npx vitest run src/lib/offline/queue.test.ts && npx tsc --noEmit
```

Expected: todos os testes PASS, tsc limpo.

- [ ] **Step 6: Commit**

```bash
git add src/lib/offline/
git commit -m "feat(offline): fila de mutations com drain, reconciliação de ids e resolução de conflito"
```

---

### Task 6: Frontend — integração do apiFetch com a fila

**Files:**
- Modify: `apps/dscar-web/src/lib/api.ts` (função `apiFetch`, linhas 38–48)
- Test: `apps/dscar-web/src/lib/offline/api-offline.test.ts`

**Interfaces:**
- Consumes: `enqueueMutation`, `isQueueable` da Task 5.
- Produces: `apiFetch` aceita `init.offline?: boolean`; write enfileirável que cai por rede resolve com `{ _offline: true, id: <client_uuid>, client_uuid }` em vez de lançar.

- [ ] **Step 1: Escrever o teste (falhando)**

```ts
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), info: vi.fn() } }));

import { apiFetch } from "@/lib/api";
import { db } from "./db";

beforeEach(async () => {
  await db.drafts.clear();
  vi.stubGlobal("navigator", { onLine: false });
  vi.stubGlobal("caches", { match: vi.fn().mockResolvedValue(undefined) });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));
});

describe("apiFetch offline", () => {
  it("write enfileirável cai por rede → enfileira e resolve otimista", async () => {
    const res = await apiFetch<{ _offline?: boolean; client_uuid?: string }>(
      "/api/proxy/service-orders/",
      { method: "POST", body: JSON.stringify({ plate: "ABC1D23" }) },
    );
    expect(res._offline).toBe(true);
    expect(await db.drafts.count()).toBe(1);
  });

  it("GET cai por rede → lança network_error (SW cobre o fallback)", async () => {
    await expect(apiFetch("/api/proxy/service-orders/")).rejects.toThrow("network_error");
    expect(await db.drafts.count()).toBe(0);
  });

  it("offline:false força falha rápida mesmo em URL enfileirável", async () => {
    await expect(
      apiFetch("/api/proxy/service-orders/", {
        method: "POST",
        body: "{}",
        offline: false,
      }),
    ).rejects.toThrow("network_error");
    expect(await db.drafts.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/lib/offline/api-offline.test.ts
```

Expected: FAIL (comportamento atual lança em todos os casos).

- [ ] **Step 3: Modificar `apiFetch`**

Substituir a assinatura e o primeiro try/catch de `apiFetch` (manter o resto — retry 401 etc. — intacto):

```ts
import { enqueueMutation, isQueueable } from "@/lib/offline/queue";

export type ApiInit = RequestInit & {
  /** false = online-only: falha rápido em vez de enfileirar (NF-e, faturamento) */
  offline?: boolean;
};

export async function apiFetch<T>(input: RequestInfo, init?: ApiInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    const url = String(input);
    if (init?.offline !== false && isQueueable(url, init ?? {})) {
      const draft = await enqueueMutation(url, init ?? {});
      toast.info("Você está offline — alteração salva e será sincronizada.");
      return { _offline: true, id: draft.id, client_uuid: draft.id } as T;
    }
    toast.error("Sem conexão com o servidor");
    throw new Error("network_error");
  }
  // ... (restante da função inalterado)
```

Aplicar a mesma troca no catch do retry de 401 (o segundo `fetch` dentro do bloco `if (res.status === 401)`) — mesmo código do catch acima.

- [ ] **Step 4: Rodar e ver passar**

```bash
npx vitest run src/lib/offline/ && npx tsc --noEmit && npx vitest run src/lib/crud-mutations.test.ts
```

Expected: PASS (crud-mutations garante que callers existentes não regrediram).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts src/lib/offline/api-offline.test.ts
git commit -m "feat(offline): apiFetch enfileira writes offline com resposta otimista"
```

---

### Task 7: Frontend — useOfflineSync + OfflineStatusBar + ConflictDialog

**Files:**
- Create: `apps/dscar-web/src/hooks/useOfflineSync.ts`
- Create: `apps/dscar-web/src/components/offline/OfflineStatusBar.tsx`
- Create: `apps/dscar-web/src/components/offline/ConflictDialog.tsx`
- Modify: `apps/dscar-web/src/components/TopBar.tsx`

**Interfaces:**
- Consumes: `db`, `drainQueue`, `keepMine`, `discardDraft`, `describeDraft` das Tasks 4–5; `useOnline` existente.
- Produces: `useOfflineSync(): { pendingCount, conflictCount, failedCount, isOnline }`.

- [ ] **Step 1: Criar `useOfflineSync.ts`**

```ts
"use client";

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { drainQueue } from "@/lib/offline/queue";
import { useOnline } from "./useOnline";

interface OfflineSyncState {
  pendingCount: number;
  conflictCount: number;
  failedCount: number;
  isOnline: boolean;
}

/** Contadores reativos da fila offline + drain automático ao reconectar. */
export function useOfflineSync(): OfflineSyncState {
  const isOnline = useOnline();

  const counts = useLiveQuery(
    async () => {
      const drafts = await db.drafts.toArray();
      return {
        pendingCount: drafts.filter((d) => d.status === "pending" || d.status === "syncing").length,
        conflictCount: drafts.filter((d) => d.status === "conflict").length,
        failedCount: drafts.filter((d) => d.status === "failed").length,
      };
    },
    [],
    { pendingCount: 0, conflictCount: 0, failedCount: 0 },
  );

  useEffect(() => {
    if (isOnline) void drainQueue();
  }, [isOnline]);

  return { ...counts, isOnline };
}
```

- [ ] **Step 2: Criar `OfflineStatusBar.tsx`**

```tsx
"use client";

import { useState } from "react";
import { AlertTriangle, CloudOff, RefreshCw } from "lucide-react";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { ConflictDialog } from "./ConflictDialog";

export function OfflineStatusBar(): React.ReactElement | null {
  const { isOnline, pendingCount, conflictCount, failedCount } = useOfflineSync();
  const [dialogOpen, setDialogOpen] = useState(false);
  const problemCount = conflictCount + failedCount;

  if (isOnline && pendingCount === 0 && problemCount === 0) return null;

  const label = !isOnline
    ? `Offline${pendingCount > 0 ? ` · ${pendingCount} pendente(s)` : ""}`
    : problemCount > 0
      ? `${problemCount} conflito(s) de sync`
      : `Sincronizando ${pendingCount}…`;

  const tone =
    problemCount > 0
      ? "border-error-500/40 bg-error-500/10 text-error-600 dark:text-error-400"
      : "border-warning-500/40 bg-warning-500/10 text-warning-700 dark:text-warning-400";

  return (
    <>
      <button
        type="button"
        onClick={() => problemCount > 0 && setDialogOpen(true)}
        aria-label={label}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tone} ${
          problemCount > 0 ? "cursor-pointer" : "cursor-default"
        }`}
      >
        {!isOnline ? (
          <CloudOff className="h-3.5 w-3.5" aria-hidden />
        ) : problemCount > 0 ? (
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
        )}
        <span>{label}</span>
      </button>
      <ConflictDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
```

- [ ] **Step 3: Criar `ConflictDialog.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { describeDraft } from "@/lib/offline/describe";
import { discardDraft, keepMine } from "@/lib/offline/queue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Extrai o id da OS da URL do draft pra linkar "Ver OS". */
function osIdFromUrl(url: string): string | null {
  const m = url.match(/\/service-orders\/([0-9a-f-]+)\//);
  return m ? m[1] : null;
}

export function ConflictDialog({ open, onOpenChange }: ConflictDialogProps): React.ReactElement {
  const drafts = useLiveQuery(
    () => db.drafts.where("status").anyOf("conflict", "failed").toArray(),
    [],
    [],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Conflitos de sincronização</DialogTitle>
          <DialogDescription>
            Estas alterações feitas offline não puderam ser aplicadas automaticamente.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {drafts.map((d) => {
            const osId = osIdFromUrl(d.url);
            return (
              <li key={d.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">{describeDraft(d)}</p>
                {d.lastError && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{d.lastError}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {osId && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/os/${osId}`} onClick={() => onOpenChange(false)}>
                        Ver OS no servidor
                      </Link>
                    </Button>
                  )}
                  {d.status === "conflict" && (
                    <Button variant="outline" size="sm" onClick={() => void keepMine(d.id)}>
                      Manter minhas alterações
                    </Button>
                  )}
                  {d.status === "failed" && (
                    <Button variant="outline" size="sm" onClick={() => void keepMine(d.id)}>
                      Tentar novamente
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => void discardDraft(d.id)}>
                    Descartar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
```

Nota: rota de OS é `/os/[numero]` — se o link por id não resolver, trocar por texto simples sem link (verificar na execução). "Merge manual" do spec = ver OS + reeditar (decisão 4).

- [ ] **Step 4: Montar no TopBar**

Em `src/components/TopBar.tsx`, importar e renderizar dentro do `<div className="flex items-center gap-2">` (antes do botão de busca):

```tsx
import { OfflineStatusBar } from "@/components/offline/OfflineStatusBar";
// ...
      <div className="flex items-center gap-2">
        <OfflineStatusBar />
        {/* botão de busca existente... */}
```

Como o TopBar está sempre montado no layout `(app)`, o drain automático do `useOfflineSync` cobre o app inteiro — não precisa registrar listener em outro lugar.

- [ ] **Step 5: Verificar**

```bash
npx tsc --noEmit && npx vitest run src/components/TopBar.test.tsx
```

Expected: limpo. (Se o teste do TopBar quebrar por falta de IndexedDB no jsdom, adicionar `import "fake-indexeddb/auto"` no topo do teste.)

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useOfflineSync.ts src/components/offline/ src/components/TopBar.tsx
git commit -m "feat(offline): useOfflineSync + status bar e modal de conflitos no TopBar"
```

---

### Task 8: Frontend — banner de pendências na lista de OS

**Files:**
- Create: `apps/dscar-web/src/components/offline/PendingDraftsBanner.tsx`
- Modify: `apps/dscar-web/src/app/(app)/os/page.tsx`

**Interfaces:**
- Consumes: `db`, `describeDraft` das Tasks 4–5.

- [ ] **Step 1: Criar `PendingDraftsBanner.tsx`**

```tsx
"use client";

import { CloudOff } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { describeDraft } from "@/lib/offline/describe";

/**
 * Banner acima da lista de OS com as alterações aguardando sync.
 * ponytail: banner em vez de mesclar drafts como linhas na tabela paginada —
 * mesclar exigiria acoplar a fila ao shape do DRF; promover se o banner
 * se mostrar insuficiente na prática.
 */
export function PendingDraftsBanner(): React.ReactElement | null {
  const drafts = useLiveQuery(() => db.drafts.toArray(), [], []);
  if (drafts.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-warning-500/30 bg-warning-500/10 px-3 py-2 text-sm text-warning-700 dark:text-warning-400">
      <CloudOff className="h-4 w-4 shrink-0" aria-hidden />
      <span>{drafts.length} alteração(ões) aguardando sincronização:</span>
      {drafts.map((d) => (
        <span
          key={d.id}
          className="rounded-full border border-warning-500/30 px-2 py-0.5 text-xs"
        >
          {describeDraft(d)}
          {d.status === "conflict" && " · conflito"}
          {d.status === "failed" && " · falhou"}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Renderizar na lista de OS**

Em `src/app/(app)/os/page.tsx`, importar e renderizar logo após o header da página (acima da tabela/filtros):

```tsx
import { PendingDraftsBanner } from "@/components/offline/PendingDraftsBanner";
// ... dentro do JSX, antes da listagem:
<PendingDraftsBanner />
```

- [ ] **Step 3: Verificar e commit**

```bash
npx tsc --noEmit
git add src/components/offline/PendingDraftsBanner.tsx "src/app/(app)/os/page.tsx"
git commit -m "feat(offline): banner de alterações pendentes na lista de OS"
```

---

### Task 9: Verificação final

- [ ] **Step 1: Suites completas**

```bash
cd apps/dscar-web && npx tsc --noEmit && npx vitest run
docker exec paddock_django pytest apps/service_orders/ apps/signatures/ -v
```

Expected: tudo verde (baseline: as suites já passavam antes da onda 5).

- [ ] **Step 2: Build de produção**

```bash
cd apps/dscar-web && npm run build
```

Expected: build OK (Dexie/uuid não podem quebrar SSR — `db.ts` não abre IndexedDB no import).

- [ ] **Step 3: Smoke manual (requer PWA ativado — flag `NEXT_PUBLIC_PWA_ENABLED`)**

1. DevTools → Network → Offline.
2. Editar uma OS e salvar → toast "alteração salva", pill "Offline · 1 pendente(s)" no TopBar, chip no banner da lista.
3. Voltar online → pill some, PATCH aplicado no backend.
4. Simular conflito: editar a mesma OS por outra sessão antes de reconectar → pill vermelha, modal com "Manter minhas alterações" / "Descartar".

- [ ] **Step 4: Commit final de docs (se houver ajustes) e push**

```bash
git push origin main
```

---

## Cobertura do spec (Seção 6) — self-review

| Item do spec | Onde |
|---|---|
| Escopo offline (tabela de operações) | whitelist `QUEUEABLE` (Task 5) + decisão 6 |
| Dexie 4, uuid v7 | Task 4 |
| Background Sync API | decisão 2 — `online` event (fallback do próprio spec) |
| Schema Dexie `drafts` | Task 4 (tabelas de leitura: decisão 1) |
| Wrapper `apiFetch` | Task 6 |
| UI otimista + badge pendente | Task 8 (banner — decisão no componente) |
| `useOfflineSync` + `OfflineStatusBar` | Task 7 |
| Reconciliação de IDs | `reconcileId` (Task 5) |
| Backend `client_uuid` + idempotência | Tasks 1–3 |
| `If-Match` → 409 | Tasks 2–3 (só em drafts offline — decisão 3) |
| Modal de conflito | Task 7 (3 ações — decisão 4) |
