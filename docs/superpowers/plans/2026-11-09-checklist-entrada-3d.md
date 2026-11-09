# Checklist de entrada 3D — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O consultor faz o checklist de entrada andando em volta do carro (celular, 7 paradas), marcando cada dano numa peça de um carro 3D realista com foto. A conferência no iPad e no monitor finaliza, gera o PDF e colhe a assinatura (presencial ou link remoto). Um cruzamento com o orçamento do Cilia aponta os danos fora do sinistro e cria um retorno de orçamento particular.

**Architecture:** Backend novo dentro de `apps/service_orders` (models, services e um router aninhado por OS), reaproveitando `signatures`, `documents` (weasyprint) e `followups`. Um pacote compartilhado `packages/car-3d` (React Three Fiber) concentra o carro 3D e as regras puras (peças, volumes, paradas). A web usa o pacote direto; o mobile usa via Expo DOM component (`'use dom'`). As peças são **volumes** (`regions.json`) sobre modelos `.glb` gratuitos; a malha não é separada.

**Tech Stack:** Django 5 + DRF + django-tenants + Celery · Next 16 + React 19 + TanStack Query v5 + Zod + Vitest · Expo SDK 55 + expo-router + zustand/MMKV · three + @react-three/fiber 9 + @react-three/drei 10.

**Spec:** `docs/superpowers/specs/2026-11-09-checklist-entrada-3d-design.md` (ler junto; o plano argumenta a partir dele).

## Global Constraints

- Repositório: `~/Documents/Projetos/grupo-dscar/grupo-dscar`. Branch de trabalho: `feat/checklist-entrada-3d`, criada a partir da `docs/checklist-entrada-3d`.
- Toda query de tenant em `schema_context`; toda task Celery recebe `tenant_schema` e abre `with schema_context(tenant_schema):`.
- Hard delete proibido: nenhum endpoint DELETE nos models novos; desativar = `soft_delete()` / `is_active=False`.
- `ServiceOrderPhoto` é imutável; o S3 key nunca é apagado.
- Logs sem PII (nada de nome, telefone ou CPF em `logger.*`).
- Python: type hints, `logger = logging.getLogger(__name__)`, sem `print`, sem raw SQL, sem `except: pass`.
- TS strict, sem `any`; toda resposta de API validada com Zod; toda tela com os estados loading (Skeleton), error e empty.
- `ChecklistDamage.checklist_type` e todas as fotos deste fluxo usam `checklist_type="entrada"` e a pasta `checklist_entrada`.
- Chaves de peça, tipos, gravidades e relações são **exatamente** os valores da Task 2 (backend) e da Task 11 (TS), espelhados manualmente como `VALID_TRANSITIONS` já é.
- Cores de gravidade: leve `#ffe000`, moderada `#ff8a00`, grave `#ea0e03`. Carro sem cor (`FANTASIA`/`NAO_INFORMADA`): `#9a9a9a`.
- Modelos 3D: CC0 ou CC-BY; **CC BY-NC-SA só para tenants listados em `CAR3D_NC_TENANTS` (padrão `["tenant_dscar"]`), por decisão do Thiago em 09/11/2026**, sempre com crédito (autor, link, licença) na página de créditos e no rodapé do PDF. Nunca *NoDerivatives*/*Editorial*. Emblemas e placas removidos, `.glb` ≤ 3 MB.
- Modelo por carro (emenda de 09/11/2026): resolução = modelo da família (marca + família normalizadas) → modelo padrão da carroceria → provisório da carroceria, sempre pulando modelos cuja licença o tenant não pode usar.
- Assinatura **nunca** bloqueia Kanban nem entrega.
- Testes backend, sempre por arquivo e com timeout (a suíte inteira leva horas e já tem 276 falhas antigas):
  `docker exec paddock_django timeout 1800 pytest <arquivo> -q -p no:cacheprovider -o addopts=""`
- Testes web: `cd apps/dscar-web && npx vitest run <arquivo>`. Testes do pacote: `cd packages/car-3d && npx vitest run`.
- Mobile não tem test runner; a verificação é `cd apps/mobile && npx tsc --noEmit` + execução no simulador iOS.
- **Antes da primeira task que mexe em código, avisar o Thiago para ele ativar o ultracode.**

## Review Focus

1. **Envio duplicado offline** (o mobile reenviando o mesmo dano ou pertence): o mesmo `client_uuid` precisa resultar em um registro só, e a resposta é 200 com o existente → teste na Task 3.
2. **Edição depois de finalizado** (web ou fila mobile atrasada chegando depois da finalização): precisa responder 409 `checklist_locked` sem gravar nada → teste na Task 3.
3. **Link remoto vencido, reutilizado ou de versão reaberta**: precisa responder 410 e não criar `Signature` → teste na Task 6.
4. **Descrições do Cilia com acento, abreviação e gênero** ("PARA-CHOQUE DIANT.", "Parachoque dianteiro", "PORTA DIANTEIRA ESQ"): precisam cair na mesma peça → teste na Task 7.
5. **OS particular ou sem orçamento**: todo dano fica `sem_orcamento` e nenhum retorno é criado → teste na Task 9.

---

## Fase 0 — Tirar o risco

### Task 1: Spike — R3F dentro de Expo DOM component no iOS

O resto do mobile depende disto. Se falhar, pare e traga ao Thiago (alternativa: WebView apontando para uma rota web embutida).

**Files:**
- Create: `apps/mobile/src/components/car3d/Car3DSpike.tsx` (`'use dom'`), rota temporária `apps/mobile/app/(app)/dev/car3d.tsx`
- Modify: `apps/mobile/package.json` (deps `three`, `@react-three/fiber@^9`, `@react-three/drei@^10`)

- [ ] **Step 1:** Instalar as deps no workspace mobile: `npm i -w mobile three @react-three/fiber@^9 @react-three/drei@^10 && npm i -D -w mobile @types/three`.
- [ ] **Step 2:** Criar `Car3DSpike` com `'use dom'`, um `<Canvas>` com um cubo que gira e um `useGLTF(props.modelUri)`. Recebe `modelUri: string` e `onTap: (name: string) => Promise<void>`.
- [ ] **Step 3:** Baixar um `.glb` de teste com `expo-file-system` para `Paths.document/car-3d/test.glb` e passar o `file://` para o componente.
- [ ] **Step 4:** Rodar no simulador (`npx expo run:ios`). Esperado: o cubo gira, o modelo aparece e o toque chama `onTap` no lado nativo (`console.log`).
- [ ] **Step 5:** Se o `file://` não carregar dentro do DOM component, testar a alternativa: ler o arquivo como base64 no nativo e passar uma `data:` URI. Registrar o resultado (qual dos dois funcionou) no topo da Task 19 deste plano.
- [ ] **Step 6:** Remover a rota `dev/car3d.tsx`, manter as deps e commitar: `git commit -m "chore(mobile): spike r3f em expo dom component"`.

---

## Fase 1 — Backend

### Task 2: Models, choices e migrations

**Files:**
- Create: `backend/core/apps/service_orders/checklist_constants.py`, `backend/core/apps/service_orders/models/checklist.py`
- Modify: `backend/core/apps/service_orders/models/__init__.py` (import + `__all__`), `backend/core/apps/service_orders/models/service_order.py` (`ActivityType`)
- Test: `backend/core/apps/service_orders/tests/test_checklist_models.py`
- Migration: `0042_entry_checklist.py`

**Interfaces — Produces:**
- `checklist_constants.py`:
  - `PANEL_KEYS: tuple[str, ...]` — exatamente: `parachoque_diant, parachoque_tras, capo, teto, tampa_tras, cacamba, paralama_diant_e, paralama_diant_d, lateral_tras_e, lateral_tras_d, porta_diant_e, porta_diant_d, porta_tras_e, porta_tras_d, porta_lateral_corredica, retrovisor_e, retrovisor_d, soleira_e, soleira_d, coluna_a_e, coluna_a_d, parabrisa, vidro_tras, farol_e, farol_d, lanterna_e, lanterna_d, grade, roda_diant_e, roda_diant_d, roda_tras_e, roda_tras_d`
  - `PANEL_CHOICES` (rótulos PT, ex.: `("porta_diant_e", "Porta dianteira esquerda")`)
  - `TextChoices`: `DamageType` (`amassado, risco, trinca, quebra, corrosao, pintura, faltando`), `DamageSeverity` (`leve, moderada, grave`), `DamageRelation` (`sinistro, pre_existente, nao_sei`), `BudgetMatch` (`no_orcamento, fora_do_orcamento, sem_orcamento`), `BodyType` (`hatch, sedan, suv, pickup, van`), `SignatureStatus` (`pendente, presencial, remoto`)
  - `EXTERIOR_STOPS = ("frente", "lado_direito", "lado_esquerdo", "traseira", "teto")`
- `models/checklist.py` (todos `PaddockBaseModel`, `class Meta(PaddockBaseModel.Meta)`):
  - `EntryChecklist`: `service_order` FK (related `entry_checklists`), `checklist_type` (default `"entrada"`), `stops_done` JSON (`{stop_key: "done" | "sem_dano"}`), `body_type` (BodyType, blank), `finalized_at` null, `finalized_by` FK GlobalUser null, `version` int default 1, `pdf` FK `documents.DocumentGeneration` null, `pdf_sha256` CharField(64, blank), `signature_status` (default `pendente`), `signature` FK `signatures.Signature` null, `remote_token_hash` CharField(64, blank, db_index), `remote_expires_at` null. Unique (`service_order`, `checklist_type`). Property `is_locked -> bool` (= `finalized_at is not None`).
  - `EntryChecklistVersion`: `checklist` FK (related `versions`), `version`, `pdf` FK, `pdf_sha256`, `signature_status`, `signature` FK null, `reopened_reason` TextField, `reopened_by` FK GlobalUser.
  - `ChecklistDamage`: `service_order` FK (related `checklist_damages`), `checklist_type`, `number` PositiveInt, `panel_key` (PANEL_CHOICES), `damage_type`, `severity`, `relation` (default `nao_sei`), `point` JSON null, `notes`, `photos` M2M `ServiceOrderPhoto` (related `checklist_damages`), `budget_match` (default `sem_orcamento`), `matched_budget_items` JSON default list, `client_uuid` CharField(36, unique, null, editable=False). Unique (`service_order`, `checklist_type`, `number`).
  - `CustomerBelonging`: `service_order` FK (related `belongings`), `description` CharField(200), `photo` FK `ServiceOrderPhoto` null, `returned_at` null, `returned_by` FK GlobalUser null, `client_uuid` (como acima).
  - `BudgetPanelRule`: `pattern` CharField(200, unique) já normalizado, `panel_keys` JSON list, `source` (`seed | manual`).
  - `FamilyBodyType`: `family` FK `vehicle_catalog.VehicleFamily` (PK inteiro; `on_delete=PROTECT`, unique), `body_type`.
- `ActivityType` ganha `CHECKLIST_FINALIZED="checklist_finalized"`, `CHECKLIST_REOPENED="checklist_reopened"`, `CHECKLIST_SIGNED="checklist_signed"`.
- `OSPhotoFolder` não muda; o slot `teto` é texto livre (nada a migrar).

- [ ] **Step 1: Teste que falha** — `test_checklist_models.py` (`TenantTestCase`, criação de user/OS como em `tests/test_photos.py`):
  - `test_damage_number_unique_per_os`: dois `ChecklistDamage` com `number=1` na mesma OS → `IntegrityError`.
  - `test_entry_checklist_unique_per_os_and_type`: segundo `EntryChecklist(checklist_type="entrada")` na mesma OS → `IntegrityError`.
  - `test_is_locked_follows_finalized_at`: `is_locked` é `False` e vira `True` depois de preencher `finalized_at`.
  - `test_panel_keys_count`: `len(PANEL_KEYS) == 32` e `"cacamba" in PANEL_KEYS`.
- [ ] **Step 2:** Rodar → FAIL (import error).
- [ ] **Step 3:** Implementar as constantes, os models, os exports e o `ActivityType`; `python manage.py makemigrations service_orders -n entry_checklist` dentro do container.
- [ ] **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `feat(os): models do checklist de entrada 3D`.

### Task 3: API de danos e pertences

**Files:**
- Create: `backend/core/apps/service_orders/services/checklist_service.py`, `backend/core/apps/service_orders/serializers/checklist.py`, `backend/core/apps/service_orders/views/checklist.py`
- Modify: `backend/core/apps/service_orders/urls.py` (router aninhado antes de `path("", include(router.urls))`, no mesmo padrão de `apontamentos`), `serializers/__init__.py`, `views/__init__.py`
- Test: `backend/core/apps/service_orders/tests/test_checklist_damages_api.py`

**Interfaces — Consumes:** models da Task 2; `find_by_client_uuid` (`apps/service_orders/offline.py:24`).
**Produces:**
- `class ChecklistLocked(APIException)`: `status_code=409`, `default_code="checklist_locked"`.
- `get_or_create_checklist(order: ServiceOrder, checklist_type: str = "entrada") -> EntryChecklist`
- `assert_editable(order: ServiceOrder) -> None` (levanta `ChecklistLocked` se o checklist existir e estiver travado)
- `create_damage(order, data: dict, user) -> tuple[ChecklistDamage, bool]` — número sequencial via `select_for_update` no `EntryChecklist`; resolve fotos por `photo_ids` (UUID) **ou** `photo_client_uuids`; se alguma foto não existir → `ValidationError({"photos": "pending"})` (o mobile reenvia depois).
- Rotas (prefixo `/api/v1/service-orders/<uuid:service_order_pk>/`):
  - `checklist-damages/` GET (ativos, ordenados por `number`) / POST · `checklist-damages/<uuid:pk>/` PATCH · `checklist-damages/<uuid:pk>/deactivate/` POST
  - `belongings/` GET / POST · `belongings/<uuid:pk>/` PATCH · `belongings/<uuid:pk>/return/` POST (preenche `returned_at`/`returned_by`)
- Serializer de dano expõe: `id, number, panel_key, damage_type, severity, relation, point, notes, photo_ids, photos` (lista `{id, url}`)`, budget_match, matched_budget_items, client_uuid`.
- Permissões: leitura `HasTenantPermission("os.view")`, escrita `HasTenantPermission("os.edit")`.
- Toda escrita chama `assert_editable` antes, **inclusive `return/` de pertence? Não**: devolver pertence é permitido com o checklist travado (acontece na entrega).

- [ ] **Step 1: Testes que falham:**
  - `test_create_damage_assigns_sequential_numbers`: dois POSTs → `number` 1 e 2.
  - `test_same_client_uuid_returns_existing` (Review Focus 1): POST duas vezes com o mesmo `client_uuid` → segunda resposta 200, mesmo `id`, `ChecklistDamage.objects.count() == 1`.
  - `test_damage_requires_known_photos`: `photo_client_uuids=["nao-existe"]` → 400 com `photos == "pending"`.
  - `test_edit_after_finalize_is_409` (Review Focus 2): com `finalized_at` preenchido, POST e PATCH → 409, `code == "checklist_locked"`, contagem inalterada.
  - `test_return_belonging_allowed_when_locked`: checklist travado, `return/` → 200 e `returned_at` preenchido.
  - `test_no_delete_route`: DELETE em `checklist-damages/<pk>/` → 405.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar o service, os serializers, os viewsets (`GenericViewSet` lendo `self.kwargs["service_order_pk"]`, como `views/apontamento.py:70`) e as rotas.
- [ ] **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `feat(os): api de danos e pertences do checklist`.

### Task 4: Estado do checklist e carroceria

**Files:**
- Modify: `services/checklist_service.py`, `serializers/checklist.py`, `views/checklist.py`, `urls.py`
- Test: `backend/core/apps/service_orders/tests/test_checklist_state_api.py`

**Produces:**
- `suggest_body_type(order) -> str | None` — `FamilyBodyType` de `order.catalog_family_id`; `None` se não houver família ou registro.
- `set_body_type(checklist, body_type: str) -> None` — grava no checklist e faz upsert em `FamilyBodyType` quando a OS tem `catalog_family_id`.
- Rota `checklist/entrada/` GET/PATCH (`<str:checklist_type>` aceita só `entrada`; outro valor → 404). GET devolve:
  `{id, body_type, suggested_body_type, stops_done, finalized_at, version, signature_status, pdf_url, vehicle_color_hex, customer_type, items_summary}`.
  - `vehicle_color_hex`: `COR_HEX[order.vehicle_color]` de `apps/vehicle_catalog/normalize.py`, e `"#9a9a9a"` quando a cor for `FANTASIA`, `NAO_INFORMADA`, vazia ou ausente no mapa. (Conferir o nome do campo de cor da OS no model antes de usar.)
  - PATCH aceita `body_type` e `stops_done` (merge por chave; valores só `done`/`sem_dano`) e respeita `assert_editable`.
- Rota `checklist/entrada/history/` GET → checklists finalizados de **outras** OS com a mesma `plate`, mais recentes primeiro: `[{os_number, finalized_at, pdf_url, damage_count}]`.

- [ ] **Step 1: Testes que falham:**
  - `test_get_creates_checklist_lazily`: GET numa OS sem checklist → 200 e `EntryChecklist.objects.count() == 1`.
  - `test_body_type_suggested_from_family`: `FamilyBodyType(family=F, body_type="suv")` + OS com `catalog_family=F` → `suggested_body_type == "suv"`.
  - `test_patch_body_type_upserts_family`: PATCH `{"body_type": "pickup"}` → `FamilyBodyType.objects.get(family=F).body_type == "pickup"`.
  - `test_unknown_color_falls_back_to_gray`: OS com cor `NAO_INFORMADA` → `vehicle_color_hex == "#9a9a9a"`.
  - `test_stops_done_rejects_invalid_value`: `{"stops_done": {"frente": "ok"}}` → 400.
  - `test_saida_type_is_404`: GET `checklist/saida/` → 404.
  - `test_history_lists_other_os_same_plate`: duas OS com a mesma placa, a outra finalizada → `history` devolve 1 item com o `os_number` da outra; a OS atual não aparece.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(os): estado do checklist e carroceria por familia`.

### Task 5: Finalizar, PDF, versões e reabrir

**Files:**
- Create: `backend/core/apps/documents/templates/pdf_engine/checklist_entrada.html`
- Modify: `apps/documents/models.py` (`DocumentType.CHECKLIST_ENTRADA = "checklist_entrada"`, + migration), `apps/documents/pdf_service.py` (`_DOCUMENT_TEMPLATES`), `services/checklist_service.py`, `views/checklist.py`, `urls.py`
- Test: `backend/core/apps/service_orders/tests/test_checklist_finalize.py`

**Consumes:** `DocumentService.generate(order_id, document_type, data, user)` (`apps/documents/services.py:44`).
**Produces:**
- `finalize(checklist: EntryChecklist, snapshots: dict[str, str], user) -> EntryChecklist`
  - Pré-condições (todas, senão `ValidationError` com lista `missing`): cada uma das `EXTERIOR_STOPS` em `stops_done`; todo dano ativo com ≥ 1 foto; `body_type` preenchido; `snapshots` com as chaves `front34, rear34, left, right` (data URIs PNG).
  - Gera o PDF via `DocumentService.generate(..., document_type="checklist_entrada", data={...})`. O `data` leva o cabeçalho da OS, os snapshots, os danos (número, rótulo da peça, tipo, gravidade, relação, URL da 1ª foto), os itens `ChecklistItem` de entrada e os pertences.
  - Preenche `finalized_at`, `finalized_by`, `pdf`, `pdf_sha256` (sha256 dos bytes salvos), `signature_status="pendente"` e `signature=None`. Cria o log `CHECKLIST_FINALIZED`.
- `reopen(checklist, reason: str, user) -> EntryChecklist` — exige um `reason` não vazio. Copia `version/pdf/pdf_sha256/signature_status/signature` para `EntryChecklistVersion`; zera `finalized_at`, `pdf`, `pdf_sha256`, `signature`, `remote_token_hash` e `remote_expires_at`; faz `version += 1`, `signature_status="pendente"`; cria o log `CHECKLIST_REOPENED`.
- Rotas: `checklist/entrada/finalize/` POST `{snapshots}` (`os.edit`) · `checklist/entrada/reopen/` POST `{reason}` (`IsManagerOrAbove`).
- Template: segue `pdf_engine/base.html` + `dscar-brand` (cabeçalho preto, faixa vermelha `#ea0e03`, Montserrat). Os 4 snapshots em grade 2×2, depois a tabela de danos e então itens e pertences. Sem assinatura no PDF.

- [ ] **Step 1: Testes que falham** (`@override_settings(STORAGES=IN_MEMORY_STORAGE)`):
  - `test_finalize_requires_all_exterior_stops`: falta `teto` → 400 e `"stop:teto" in missing`.
  - `test_finalize_requires_photo_per_damage`: dano sem foto → 400 e `"damage:1:photo" in missing`.
  - `test_finalize_rejects_missing_snapshot`: sem `snapshots["rear34"]` → 400 e `"snapshot:rear34" in missing`.
  - `test_finalize_locks_and_creates_pdf`: caminho feliz → 200, `finalized_at` preenchido, `DocumentGeneration` com `document_type="checklist_entrada"` e `len(pdf_sha256) == 64`.
  - `test_reopen_requires_manager`: role `CONSULTANT` → 403.
  - `test_reopen_keeps_previous_version`: depois de reabrir → `EntryChecklistVersion.objects.count() == 1`, `checklist.version == 2`, `is_locked is False`, `signature_status == "pendente"`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(os): finalizar checklist com pdf e versoes`.

### Task 6: Assinatura presencial e link remoto

**Files:**
- Modify: `services/checklist_service.py`, `views/checklist.py`, `urls.py`, `config/urls.py` (rota pública)
- Create: `backend/core/apps/service_orders/views/checklist_public.py`
- Test: `backend/core/apps/service_orders/tests/test_checklist_signature.py`

**Consumes:** `SignatureService.capture(...)` (`apps/signatures/services.py:23`), `document_type="VISTORIA_ENTRADA"`; `settings.FRONTEND_URL`; o padrão de token do reset de senha (`apps/authentication/views.py:427-437`).
**Produces:**
- `sign_presencial(checklist, signer_name: str, png_b64: str, ip: str | None, ua: str) -> Signature` — exige `is_locked`; `method="CANVAS_TABLET"`; grava `signature_status="presencial"`; cria o log `CHECKLIST_SIGNED`.
- `create_remote_link(checklist) -> dict[str, str]` — exige `is_locked`. Gera o token com `secrets.token_urlsafe(32)` e guarda o sha256 em `remote_token_hash`, com `remote_expires_at = now + 7 dias`. Devolve `{"url": f"{FRONTEND_URL}/confirmar-checklist/{token}", "whatsapp_url": ...}`. O `whatsapp_url` é `https://wa.me/55<dígitos>?text=<msg urlencoded>` com o contato `WHATSAPP` principal do cliente (`persons.PersonContact`, `is_primary` primeiro); sem contato, vira `https://wa.me/?text=<msg>`. Mensagem: `"Olá! Segue o checklist de entrada do seu veículo {placa} na DS Car. Confira e confirme: {url}"`.
- `confirm_remote(token: str, signer_name: str, ip, ua) -> Signature` — hash não encontrado → `NotFound`; vencido ou já confirmado → `APIException` 410 `code="link_expired"`. Grava a `Signature` com `method="REMOTE_LINK"`, `signature_png_base64=""` e `notes=f"Aceite remoto · checklist v{version} · sha256 {pdf_sha256}"`. Atualiza `signature_status="remoto"`, zera o token e cria o log `CHECKLIST_SIGNED`.
- Rotas: `checklist/entrada/sign/` POST `{signer_name, signature_png_base64}` · `checklist/entrada/send-remote/` POST → `{url, whatsapp_url}` · pública `api/v1/public/checklist-confirm/<str:token>/` GET (`{placa, modelo, pdf_url, version}`) / POST `{signer_name}`, ambas `AllowAny`, com o tenant resolvido do jeito que o reset de senha resolve.

- [ ] **Step 1: Testes que falham:**
  - `test_sign_requires_finalized`: checklist aberto → 400.
  - `test_presencial_sets_status`: → `signature_status == "presencial"` e `Signature.method == "CANVAS_TABLET"`.
  - `test_remote_link_flow`: `send-remote` → POST público com o token → 200, `signature_status == "remoto"` e `"sha256" in signature.notes`.
  - `test_remote_link_expired_is_410` (Review Focus 3): `remote_expires_at` no passado → 410 e `Signature.objects.count() == 0`.
  - `test_remote_link_single_use_is_410`: segunda confirmação com o mesmo token → 410.
  - `test_reopen_invalidates_remote_link`: `send-remote`, depois `reopen` → POST público → 404.
  - `test_whatsapp_url_without_contact`: cliente sem contato → `whatsapp_url.startswith("https://wa.me/?text=")`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(os): assinatura presencial e link remoto do checklist`.

### Task 7: Dicionário de peças do orçamento

**Files:**
- Create: `backend/core/apps/service_orders/services/budget_panels.py`, data migration `0043_seed_budget_panel_rules.py`
- Test: `backend/core/apps/service_orders/tests/test_budget_panels.py` (unitário, sem DB, exceto o teste do seed)

**Produces:**
- `normalize_description(text: str) -> str`: maiúsculas, sem acento (`unicodedata`), pontuação e hífen viram espaço, espaços colapsados. Depois, uma substituição token a token:
  `DIANT|DIANTEIRA→DIANTEIRO`, `TRAS|TRAS.|TRASEIRA→TRASEIRO`, `ESQ|ESQUERDA→ESQUERDO`, `DIR|DIREITA→DIREITO`, `LD→DIREITO`, `LE→ESQUERDO`. Por fim, junta `PARA CHOQUE→PARACHOQUE` e `PARA LAMA→PARALAMA`.
- `panels_for_description(description: str, rules: list[tuple[str, list[str]]]) -> list[str]`: a regra casa quando **todos** os tokens do `pattern` estão nos tokens da descrição. Vale a regra com mais tokens; empate → união das peças. Sem regra → `[]`.
- Seed (`source="seed"`): uma regra por `PANEL_KEY`, a partir do rótulo normalizado (ex.: `"PORTA DIANTEIRO ESQUERDO"→["porta_diant_e"]`), mais sinônimos: `"TAMPA TRASEIRO"`/`"PORTA MALAS"`→`tampa_tras`, `"CAPO"`→`capo`, `"PARABRISA"`→`parabrisa`, `"VIDRO TRASEIRO"`→`vidro_tras`, `"FAROL ESQUERDO"`→`farol_e`, `"LANTERNA DIREITO"`→`lanterna_d`, `"RETROVISOR ESQUERDO"`→`retrovisor_e`, `"CACAMBA"`→`cacamba`, `"SOLEIRA ESQUERDO"`→`soleira_e`, `"GRADE"`→`grade`. Sinônimos sem lado (`"PARACHOQUE DIANTEIRO"`) apontam para a peça única.

- [ ] **Step 1: Testes que falham** (Review Focus 4):
  - `test_normalize_variants`: `normalize_description("PARA-CHOQUE DIANT.") == normalize_description("Parachoque dianteiro") == "PARACHOQUE DIANTEIRO"`.
  - `test_door_gender_and_abbrev`: `panels_for_description("PORTA DIANTEIRA ESQ", rules) == ["porta_diant_e"]`.
  - `test_more_specific_rule_wins`: com as regras `"PORTA"→[x]` e `"PORTA DIANTEIRO ESQUERDO"→["porta_diant_e"]` → `["porta_diant_e"]`.
  - `test_unknown_returns_empty`: `panels_for_description("MAO DE OBRA FUNILARIA", rules) == []`.
  - `test_seed_covers_every_panel` (DB): todo `PANEL_KEY` aparece em algum `BudgetPanelRule.panel_keys`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(os): dicionario de pecas do orcamento`.

### Task 8: Retorno "Oferecer orçamento particular"

**Files:**
- Modify: `apps/followups/models.py` (`FollowUpTrigger.PRE_EXISTING_DAMAGE = "pre_existing_damage"`), `apps/followups/services.py`
- Create: data migration em `apps/followups/migrations/` com a regra-semente
- Test: `apps/followups/tests/test_pre_existing_damage.py`

**Produces:**
- Regra-semente: `name="Oferecer orçamento particular"`, `trigger_event="pre_existing_damage"`, `delay_hours=0`, `channel="task"`, `message_template="Oferecer orçamento particular · {placa} · OS {os}"`.
- `upsert_pre_existing_damage(order, panel_labels: list[str]) -> FollowUp | None`:
  - Lista vazia: se houver `FollowUp` dessa regra para a OS com status `pending`/`scheduled` → `status="skipped"`. Retorna `None`.
  - Senão: `get_or_create(rule, service_order, defaults={due_at: now, channel: "task", assigned_to: order.consultant})`; `notes = "Peças fora do orçamento: " + ", ".join(panel_labels)`; se estava `skipped`, volta para `pending`. Respeita `customer.followup_opt_out` como `schedule_for_delivery` faz (`services.py:135`).

- [ ] **Step 1: Testes que falham:**
  - `test_creates_one_followup_per_os`: duas chamadas com rótulos → `FollowUp.objects.count() == 1` e `"Capô" in notes`.
  - `test_empty_list_skips_pending`: depois de criado, chamada com `[]` → `status == "skipped"`.
  - `test_assigned_to_consultant`: `assigned_to == order.consultant`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(followups): retorno de orcamento particular por dano pre-existente`.

### Task 9: Cruzamento com o orçamento

**Files:**
- Create: `backend/core/apps/service_orders/services/budget_match.py`
- Modify: `apps/service_orders/tasks.py` (task), `apps/cilia/services.py:306-358` (`create_version_from_parsed`), `apps/service_orders/services/versioning_service.py:281` (`apply_version_override`), `views/checklist.py`, `urls.py`
- Test: `backend/core/apps/service_orders/tests/test_budget_match.py`

**Consumes:** Task 7; Task 8 (`upsert_pre_existing_damage`); Task 5 (`finalize`); `ServiceOrderVersion.is_active_version`; `ServiceOrderVersionItem` (`description`, `item_type`, `id`).
**Produces:**
- `active_budget_items(order) -> list[ServiceOrderVersionItem]`: itens da versão mais recente com `is_active_version` verdadeiro, só `item_type in ("PART", "SERVICE", "EXTERNAL_SERVICE")`. Sem versão → `[]`.
- `@dataclass MatchSummary: inside: int; outside: list[str]; unmapped: list[dict]` (`unmapped` = `{item_id, description}`).
- `run_budget_match(order) -> MatchSummary`:
  - Para `customer_type != "insurer"` ou sem itens: todo dano ativo vira `sem_orcamento`, `matched_budget_items=[]`.
  - Senão: monta o mapa peça→itens; o dano com a peça no mapa vira `no_orcamento` (com os ids casados), o resto vira `fora_do_orcamento`.
  - No fim, chama `upsert_pre_existing_damage(order, [rótulos das peças fora])` (Task 8).
- `task_run_budget_match(self, service_order_id: str, tenant_schema: str)` em `tasks.py`, no padrão de `apps/imports/tasks.py:26-54`.
- Hooks: no fim de `create_version_from_parsed`, quando `action == "applied"`, e no fim de `apply_version_override`: `transaction.on_commit(lambda: task_run_budget_match.delay(str(order.id), connection.schema_name))`. Acrescentar no `finalize` da Task 5 uma chamada síncrona a `run_budget_match(order)` antes de gerar o PDF.
- Relatório de cruzamento: `DocumentType.CHECKLIST_CRUZAMENTO = "checklist_cruzamento"` (20 caracteres, cabe no `max_length=20`) + template `pdf_engine/checklist_cruzamento.html` (danos com o selo do cruzamento, relação declarada ao lado, itens do orçamento casados e não mapeados). `checklist/budget-match/report/` POST → gera via `DocumentService.generate` e devolve `{pdf_url}`. Esse documento não altera o PDF assinado.
- Rotas: `checklist/budget-match/` POST → `MatchSummary` em JSON · `api/v1/service-orders/checklist/panel-rules/` GET/POST (`IsAdminOrAbove`; POST grava `source="manual"` com o `pattern` normalizado e reroda o cruzamento da OS informada em `service_order_id`).

- [ ] **Step 1: Testes que falham:**
  - `test_private_os_all_sem_orcamento` (Review Focus 5): OS `customer_type="private"` com danos → todos `sem_orcamento`, e `FollowUp.objects.count() == 0`.
  - `test_insurer_inside_and_outside`: versão ativa com o item "PORTA DIANTEIRA ESQ" e danos em `porta_diant_e` e `capo` → `porta_diant_e` vira `no_orcamento` e `capo` vira `fora_do_orcamento`.
  - `test_unmapped_items_reported`: item "MAO DE OBRA" → aparece em `unmapped`.
  - `test_manual_rule_rematches`: POST `panel-rules` `{"pattern": "TAMPA COMPARTIMENTO", "panel_keys": ["tampa_tras"], "service_order_id": ...}` → o dano em `tampa_tras` vira `no_orcamento`.
  - `test_report_does_not_touch_signed_pdf`: com o checklist finalizado, `report/` → 200, um `DocumentGeneration` com `document_type="checklist_cruzamento"`, e `checklist.pdf_sha256` inalterado.
  - `test_import_hook_enqueues_match`: com `self.captureOnCommitCallbacks(execute=True)`, `create_version_from_parsed` com `action="applied"` → `budget_match` atualizado (Celery é eager no settings de teste).
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS. Rodar também `apps/cilia/tests/` e `apps/service_orders/tests/test_versioning*` e comparar as falhas com a base (não pode haver falha nova).
- [ ] **Step 5:** Commit `feat(os): cruzamento do checklist com o orcamento`.

### Task 10: Ligações com o Kanban

**Files:**
- Modify: `apps/service_orders/transition_validator.py` (`_validate_to_initial_survey` em 461-547; `_validate_to_delivered`, criar se não existir)
- Test: `apps/service_orders/tests/test_transition_validator.py` (estilo atual: `MagicMock`/`patch`)

**Produces:**
- Em `_validate_to_initial_survey`: o soft block `ValidationBlock(code="ENTRY_CHECKLIST", message="Checklist de entrada não finalizado")` aparece quando não existe `EntryChecklist` de entrada com `finalized_at`. Usa o mecanismo de override do MANAGER que já existe.
- Em `_validate_to_delivered`: o aviso (`warnings`) `ValidationBlock(code="BELONGINGS_NOT_RETURNED", message="Há pertences do cliente não devolvidos")` aparece quando há `CustomerBelonging` ativo sem `returned_at`.
- A assinatura não aparece em lugar nenhum do validador.

- [ ] **Step 1: Testes que falham:** `test_initial_survey_soft_blocks_without_finalized_checklist`, `test_initial_survey_ok_with_finalized_checklist`, `test_delivered_warns_unreturned_belongings`, `test_signature_pending_never_blocks` (checklist finalizado com `signature_status="pendente"` → nenhum bloco com "SIGN" no código).
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(os): checklist finalizado como requisito da recepcao`.

### Task 10b: Identidade do modelo 3D no estado e crédito no PDF (emenda de 09/11)

**Files:**
- Modify: `backend/core/config/settings/base.py` (`CAR3D_NC_TENANTS = config("CAR3D_NC_TENANTS", default="tenant_dscar", cast=Csv())`), `services/checklist_service.py`, `serializers/checklist.py`, `documents/templates/pdf_engine/checklist_entrada.html`
- Test: `backend/core/apps/service_orders/tests/test_checklist_state_api.py` (acrescentar), `test_checklist_finalize.py` (acrescentar)

**Produces:**
- GET `checklist/entrada/` ganha `vehicle_make` e `vehicle_family`: nomes normalizados (minúsculas, sem acento, espaços e hífens viram `_`; ex.: `"chevrolet"`, `"onix_plus"`), vindos de `order.catalog_family.make.nome` / `order.catalog_family.nome`; `null` quando a OS não tem família. Ganha também `allow_nc_models: bool` (`connection.schema_name in settings.CAR3D_NC_TENANTS`).
- `finalize` aceita `model_credit: str` opcional (≤ 300 caracteres, texto puro). Quando vem preenchido, o PDF imprime no rodapé: `Modelo 3D: {model_credit}`.

- [ ] **Step 1: Testes que falham:** `test_state_exposes_normalized_family` (família "Onix Plus" da marca "Chevrolet" → `vehicle_family == "onix_plus"`, `vehicle_make == "chevrolet"`); `test_state_family_null_without_catalog`; `test_allow_nc_models_follows_setting` (com `override_settings(CAR3D_NC_TENANTS=[<schema do teste>])` → `true`; com `[]` → `false`); `test_finalize_prints_model_credit` (o HTML renderizado contém `Modelo 3D: Polo · Ddiaz Design · CC BY-NC-SA 4.0`).
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(os): familia do veiculo e credito do modelo 3d no checklist`.

---

## Fase 2 — Pacote `packages/car-3d`

### Task 11: Pacote e regras puras

**Files:**
- Create: `packages/car-3d/package.json` (`"name": "@paddock/car-3d"`, só código-fonte, `main/types/exports: ./src/index.ts`, scripts `typecheck` e `test: vitest run`), `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, `src/panels.ts`, `src/regions.ts`, `src/stops.ts`, `src/highlight.ts`
- Modify: `apps/dscar-web/next.config.ts:17` (`transpilePackages`), `apps/dscar-web/tsconfig.json` (paths), `apps/dscar-web/vitest.config.ts` (alias), `apps/dscar-web/package.json` + `apps/mobile/package.json` (dep `"@paddock/car-3d": "*"`)
- Test: `packages/car-3d/src/*.test.ts`

**Produces:**
- `panels.ts`: `PANEL_KEYS` (mesma lista e ordem da Task 2), `type PanelKey`, `PANEL_LABELS: Record<PanelKey, string>`, `DAMAGE_TYPES`, `SEVERITIES`, `RELATIONS` (valores da Task 2 com rótulos PT), `SEVERITY_COLORS = {leve: "#ffe000", moderada: "#ff8a00", grave: "#ea0e03"}`, `NEUTRAL_PAINT = "#9a9a9a"`.
- `regions.ts`: `type Vec3 = [number, number, number]`; `type RegionBox = {center: Vec3; size: Vec3; rotationY?: number}`; `type Regions = {model: string; paintMaterials: string[]; panels: Partial<Record<PanelKey, RegionBox[]>>}`; `RegionsSchema` (Zod); `panelAt(point: Vec3, regions: Regions): PanelKey | null`. Vale a caixa de **menor volume** que contém o ponto; o ponto é rotacionado por `-rotationY` em torno do centro antes do teste.
- `stops.ts`: `type StopKey = "frente" | "lado_direito" | "lado_esquerdo" | "traseira" | "teto" | "interior_itens" | "pertences"`. `STOPS: {key: StopKey; label: string; slots: string[]; panels: PanelKey[]; view: CameraView}[]` na ordem e com os slots da tabela 5.2 do spec (`frente: ["frente","diag_diant"]`, `lado_direito: ["lateral_dir"]`, `lado_esquerdo: ["lateral_esq"]`, `traseira: ["traseira","diag_tras"]`, `teto: []`, `interior_itens: ["painel","chave","motor","step","ferramentas","combustivel"]`, `pertences: []`). `canCompleteStop(stop: StopKey, s: {photoSlots: Set<string>; damageCount: number; noDamage: boolean}): {ok: boolean; missing: string[]}` — slots obrigatórios presentes **e** (para as 5 externas) `damageCount > 0 || noDamage`.
- `highlight.ts`: `MAX_HIGHLIGHT_BOXES = 24`; `buildHighlightUniforms(highlights: {panel: PanelKey; color: string}[], regions: Regions): {centers: Float32Array; sizes: Float32Array; rotY: Float32Array; colors: Float32Array; count: number}` (corta em 24 e loga `console.warn` uma vez quando corta).
- `type CameraView = "free" | "front" | "rear" | "left" | "right" | "top" | "front34" | "rear34"`.
- `catalog.ts` (emenda de 09/11): `type ModelLicense = "CC0" | "CC-BY-4.0" | "CC-BY-NC-SA-4.0" | "PLACEHOLDER"`; `type CarModelEntry = {key: string; title: string; file: string; regionsFile: string; bodyType: BodyType; families: {make: string; family: string}[]; bodyDefault: boolean; license: ModelLicense; author: string; sourceUrl: string}`; `CAR_MODELS: CarModelEntry[]` (começa só com os 5 provisórios, `license: "PLACEHOLDER"`, um por carroceria; a Task 14 acrescenta os reais); `resolveCarModel(q: {make: string | null; family: string | null; bodyType: BodyType; allowNc: boolean}): CarModelEntry` — 1º entrada cuja `families` contém `{make, family}` e cuja licença é permitida; 2º entrada com `bodyDefault && bodyType` igual e licença permitida (a primeira da lista vence); 3º o provisório da carroceria. Licença permitida = tudo, menos `CC-BY-NC-SA-4.0` quando `allowNc` é falso. `creditLine(e: CarModelEntry): string | null` → `"{title} · {author} · {licença legível}"` (`null` para `PLACEHOLDER`).

- [ ] **Step 1: Testes que falham:**
  - `resolveCarModel` com um catálogo de teste: família casada e licença CC-BY → a entrada da família; família casada mas NC com `allowNc=false` → cai no padrão da carroceria; sem família → padrão da carroceria; carroceria sem padrão real → provisório. `creditLine` de uma entrada NC → `"Polo · Ddiaz Design · CC BY-NC-SA 4.0"`.
  - `panelAt` retorna `porta_diant_e` para um ponto dentro da caixa; retorna `null` fora de todas; com caixa grande e pequena se sobrepondo, retorna a pequena; respeita `rotationY = Math.PI/2`.
  - `RegionsSchema.parse` rejeita uma `panel_key` desconhecida.
  - `canCompleteStop("frente", {photoSlots: new Set(["frente"]), damageCount: 0, noDamage: true})` → `{ok: false, missing: ["diag_diant"]}`; com os dois slots e `noDamage` → `ok: true`; `"teto"` sem slots e sem dano nem `noDamage` → `missing: ["dano_ou_sem_dano"]`.
  - `buildHighlightUniforms` com 30 caixas → `count === 24`.
  - `PANEL_KEYS.length === 32`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar e rodar `npm i` na raiz. **Step 4:** PASS + `cd apps/dscar-web && npx tsc --noEmit`.
- [ ] **Step 5:** Commit `feat(car-3d): pacote com pecas, volumes e paradas`.

### Task 12: Componente `<Car3D>`

**Files:**
- Create: `packages/car-3d/src/Car3D.tsx`, `src/paint.ts`, `src/regionShader.ts`, `src/cameras.ts`
- Modify: `packages/car-3d/package.json` (peer deps `react`, `three`, `@react-three/fiber@^9`, `@react-three/drei@^10`), `apps/dscar-web/package.json` (as mesmas deps)
- Test: `packages/car-3d/src/cameras.test.ts`

**Consumes:** Task 11.
**Produces:**
```ts
export type Car3DHandle = { snapshot(view: CameraView): Promise<string> }; // data URL PNG 1200×900
export type Car3DProps = {
  modelUrl: string;
  regions: Regions;
  color: string;                                   // hex da lataria
  highlights?: { panel: PanelKey; color: string }[];
  pins?: { number: number; point: Vec3; color: string }[];
  view?: CameraView;                               // anima a câmera até a vista
  autoRotate?: boolean;
  showRegions?: boolean;                           // wireframe das caixas (calibração)
  onPanelTap?: (panel: PanelKey | null, point: Vec3) => void;
  className?: string;
};
export const Car3D: React.ForwardRefExoticComponent<Car3DProps & React.RefAttributes<Car3DHandle>>;
```
- `paint.ts`: `applyPaint(scene, paintMaterials: string[], color: string)` clona os materiais de nome listado e troca a `color`.
- `regionShader.ts`: `patchRegionHighlight(material, uniforms)` via `onBeforeCompile`. Passa a posição no espaço do modelo para o fragment shader e mistura a cor do volume (60%) quando o fragmento está dentro de alguma das `count` caixas. Aplicado só aos materiais de pintura.
- `cameras.ts`: `CAMERA_POSES: Record<Exclude<CameraView, "free">, {position: Vec3; target: Vec3}>`, normalizados para um carro de comprimento 1 e escalados pelo bounding box do modelo; `poseFor(view, bbox)`.
- O toque usa o evento `onPointerDown` do R3F na malha (`event.point` convertido para o espaço do modelo) → `panelAt`. Arrastar (movimento > 6 px) não conta como toque.
- `snapshot` renderiza com `preserveDrawingBuffer: true` na vista pedida e devolve `gl.domElement.toDataURL("image/png")`.
- Fundo transparente; plataforma circular com borda roxa `#ac27ce` (visual do ERP, conforme a proposta A).

- [ ] **Step 1: Teste que falha:** `poseFor("left", bbox)` coloca a câmera em `x < 0` olhando para o centro do bbox; `poseFor("front34", bbox)` tem `z > 0` e `x > 0` (frente = +z, convenção registrada no `regions.json`).
- [ ] **Step 2:** FAIL. **Step 3:** Implementar.
- [ ] **Step 4:** PASS. Verificar no navegador pela página da Task 13: o carro aparece pintado, a peça acende ao tocar e o snapshot devolve PNG.
- [ ] **Step 5:** Commit `feat(car-3d): componente Car3D com volumes e snapshot`.

### Task 13: Tela de calibração e modelo provisório

**Files:**
- Create: `apps/dscar-web/src/app/(app)/dev/car-3d/page.tsx`, `apps/dscar-web/public/car-3d/` (`.glb` e `regions/*.json`), `packages/car-3d/assets/CREDITS.md`
- Modify: `apps/dscar-web/src/components/dock/nav-config.ts` (nada no menu; a rota é só por URL)

**Produces:**
- Página só para `ADMIN+` (gate no client pelo role e `notFound()` em produção quando `NEXT_PUBLIC_ENABLE_DEV_TOOLS !== "true"`).
- Funções: escolher um modelo de `CAR_MODELS` → carrega `/car-3d/<file>` + `/car-3d/regions/<regionsFile>`; lista de `PANEL_KEYS`; selecionar uma peça mostra as caixas dela com `TransformControls` (drei) para mover e escalar e um campo para `rotationY`; `showRegions` ligado; tocar no carro mostra qual peça foi detectada; botão **Exportar JSON** (download do `regions.json` validado por `RegionsSchema`); campo para os nomes dos materiais de pintura (lista dos materiais do `.glb`).
- Modelo provisório (ruling do ledger: gerado localmente, sem baixar nada): `packages/car-3d/scripts/make-placeholder.mjs` (devDependency `@gltf-transform/core`) gera 5 carros de caixas com proporções de hatch, sedã, SUV, picape e van, com malhas nomeadas (lataria com material `paint`, vidros `glass`, rodas `tire`), salvos como `apps/dscar-web/public/car-3d/placeholder-<body>.glb`, cada um com um `regions.json` calibrado nesta tela. São as 5 entradas `PLACEHOLDER` do `CAR_MODELS`.

- [ ] **Step 1:** Implementar a página e verificar no navegador (`preview_start` do dscar-web): girar, selecionar `porta_diant_e`, mover a caixa, tocar e ver o nome certo, exportar.
- [ ] **Step 2:** Calibrar o provisório para as 32 peças (as que existirem em cada carroceria) e salvar os 5 `regions.json`.
- [ ] **Step 3:** Commit `feat(car-3d): tela de calibracao e modelo provisorio`.

### Task 14: Modelos definitivos (Thiago + agente)

Os modelos do Sketchfab exigem login para baixar, e o agente não faz login. **O download é do Thiago**, com o agente preparando e calibrando depois. A lista curada está em https://claude.ai/artifact/UZYbkSCJdg23FgsvdDTfnW.

- [ ] **Step 1 (Thiago):** Arquivos em `~/Downloads/car-3d/`. Já estão lá (09/11): `polo.glb` (Polo 170 TSI, Ddiaz Design, CC BY-NC-SA 4.0 → modelo da família Polo e padrão hatch), `virtus.glb` (Virtus TSI, Ddiaz Design, NC → família Virtus e padrão sedã), `spark_euv.glb` (Spark EUV, Ddiaz Design, NC → família Spark EUV), `onix.glb` (uzb_rx7, CC-BY 4.0 → família Onix/Onix Plus; padrão sedã para tenants sem NC). Faltam os padrões **SUV, picape e van** e os demais da lista curada. A licença, o autor e o link estão em `asset.extras` dentro de cada `.glb`; leia de lá.
- [ ] **Step 2 (agente):** Otimizar cada um com `npx @gltf-transform/cli optimize <in> <out> --compress draco --texture-compress webp --texture-size 1024` (e `simplify`/`weld` quando passar de 3 MB; o Spark EUV tem 954 mil triângulos) até ≤ 3 MB. Remover emblemas e placas: apagar as malhas de logo/placa e, se estiverem na textura, cobrir com a cor da lataria. Remover o interior se ajudar no peso (o checklist não usa).
- [ ] **Step 3 (agente):** Copiar para `apps/dscar-web/public/car-3d/<key>.glb`, calibrar o `regions.json` de cada um na tela da Task 13, acrescentar a entrada em `CAR_MODELS` (licença, autor, link, famílias e `bodyDefault`) e gerar o `CREDITS.md` a partir dele. A página `apps/dscar-web/src/app/(app)/sobre/creditos/page.tsx` lista `CAR_MODELS` (exceto `PLACEHOLDER`) com título, autor, link e licença.
- [ ] **Step 4:** Mostrar ao Thiago os carros na tela de calibração, pintados com 3 cores (branco, prata, vermelho). Ele aprova o visual antes de seguir.
- [ ] **Step 5:** Commit `feat(car-3d): modelos definitivos por carro e carroceria`.

---

## Fase 3 — Web

### Task 15: Schemas e hooks da API

**Files:**
- Create: `apps/dscar-web/src/app/(app)/os/[numero]/checklist/_schemas/checklist.schema.ts` (+ `.schema.test.ts`), `.../checklist/_hooks/useEntryChecklist.ts`

**Produces:** (o estado traz também `vehicle_make`, `vehicle_family`, `allow_nc_models` — Task 10b — e `items_summary` no formato `{ok, attention, critical, pending}` com inteiros; a cor da OS vem pronta em `vehicle_color_hex`) schemas Zod `EntryChecklistStateSchema`, `ChecklistDamageSchema`, `CustomerBelongingSchema`, `MatchSummarySchema` e `RemoteLinkSchema`, com os campos das Tasks 3–8 e enums com os valores da Task 2. Hooks no padrão de `src/hooks/useServiceOrders.ts`, query keys `["checklist", osId]`, `["checklist-damages", osId]` e `["belongings", osId]`:
`useEntryChecklist(osId)`, `usePatchChecklist(osId)`, `useChecklistDamages(osId)`, `useCreateDamage(osId)`, `usePatchDamage(osId)`, `useDeactivateDamage(osId)`, `useBelongings(osId)`, `useCreateBelonging(osId)`, `useReturnBelonging(osId)`, `useFinalizeChecklist(osId)`, `useReopenChecklist(osId)`, `useSignChecklist(osId)`, `useSendRemoteLink(osId)`, `useBudgetMatch(osId)`, `useBudgetReport(osId)`, `useChecklistHistory(osId)`, `useCreatePanelRule()`. Todos usam `apiFetch` com `offline: false` nas ações de finalizar, reabrir, assinar e enviar link.

- [ ] **Step 1: Teste que falha:** `checklist.schema.test.ts` → `ChecklistDamageSchema.parse` aceita um payload completo de exemplo e rejeita `severity: "media"`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(web): schemas e hooks do checklist`.

### Task 16: Tela de conferência `/os/[numero]/checklist`

**Files:**
- Create: `apps/dscar-web/src/app/(app)/os/[numero]/checklist/page.tsx` e `_components/` (`ChecklistViewer.tsx`, `DamagePanel.tsx`, `DamageList.tsx`, `ItemsTab.tsx`, `BelongingsTab.tsx`, `FinalizeBar.tsx`, `RemoteLinkDialog.tsx`, `BudgetDivergence.tsx`)
- Create: `apps/dscar-web/src/components/signature/SignatureSection.tsx` (movido de `os/[numero]/vistoria/_components/`)
- Modify: `ClosingTab.tsx:31` e `vistoria/page.tsx` (passam a importar o `SignatureSection` do novo local); `_v2/OSWorkspaceV2.tsx:249` e `recepcao/page.tsx:95` (apontam para `/checklist`); `nav-config.ts:286` (`FAB_HIDDEN_SUBPATHS` ganha `"/checklist"`); `vistoria/page.tsx` (o segmento Entrada vira link para `/checklist`, e a página abre em Saída)
- Modify: `vistoria/_lib/checklist-catalog.ts` → função `catalogFor(type)`, que na entrada omite `bodywork`, `glass` e `lighting`
- Test: `_components/DamagePanel.test.tsx`, `_components/BudgetDivergence.test.tsx`

**Produces (comportamento):**
- O modelo vem de `resolveCarModel({make: vehicle_make, family: vehicle_family, bodyType: body_type, allowNc: allow_nc_models})`; **Finalizar** envia `model_credit = creditLine(entrada)` junto com os snapshots (omitido quando `null`).
- Layout da proposta A: o `Car3D` à esquerda, com os chips de vista (3D/Frente/Lado E/Trás/Lado D/Teto); painel lateral com as abas **Danos (n)**, **Itens do veículo** e **Pertences (n)**. Danos acendem com a cor da gravidade, com os marcadores numerados em `point`.
- Tocar numa peça abre o `DamagePanel` (novo dano naquela peça), com chips de tipo, gravidade e relação, fotos (escolher entre as fotos da OS na pasta `checklist_entrada` ou subir uma nova pelo endpoint de fotos existente) e notas.
- Se `body_type` estiver vazio, aparece primeiro um seletor de carroceria (sugestão pré-marcada).
- `BudgetDivergence`: em cada dano, mostra um selo `no_orcamento` (verde `#0aa52b`), `fora_do_orcamento` ("Pré-existente · fora do sinistro", laranja) ou `sem_orcamento` (cinza). Quando a relação declarada é `sinistro` e o cruzamento diz `fora_do_orcamento`, os dois aparecem lado a lado com o rótulo "Divergência". Itens `unmapped` aparecem numa lista com um seletor de peça que chama `useCreatePanelRule`.
- `FinalizeBar`:
  - **Finalizar** tira os 4 snapshots (`front34, rear34, left, right`) pelo `Car3DHandle` e chama `useFinalizeChecklist`. Os `missing` voltam como lista clicável que leva à parada ou ao dano.
  - Depois de finalizado: **Cliente assina aqui** (`SignatureSection`, que grava via `sign/`) e **Enviar link pelo WhatsApp** (`RemoteLinkDialog`, que mostra a URL, um botão para copiar e um botão que abre o `whatsapp_url`).
  - O selo de assinatura mostra *pendente*, *assinado presencial* ou *assinado remoto*.
  - **Reabrir** só aparece para MANAGER+ e pede o motivo.
- Aba Pertences: cada pertence tem o botão **Devolvido** (`useReturnBelonging`), habilitado mesmo com o checklist travado.
- Abaixo do carro: "Checklists anteriores deste veículo" (rota `history` da Task 4), com a data, o nº da OS, a quantidade de danos e um link para o PDF. Some quando a lista vem vazia.
- Botão **Relatório de cruzamento** (OS de seguradora com orçamento): chama `budget-match/report/` e abre o PDF.
- Travado: os controles de edição ficam desabilitados, e um 409 `checklist_locked` mostra um toast "Checklist finalizado — peça a um gerente para reabrir".
- Estados: Skeleton do canvas enquanto carrega o `.glb`; erro com "Tentar de novo"; vazio ("Nenhum dano marcado — toque numa peça do carro").

- [ ] **Step 1: Testes que falham:**
  - `DamagePanel.test.tsx`: escolher "Amassado" + "Moderada" e salvar chama `useCreateDamage` com `{panel_key: "porta_diant_e", damage_type: "amassado", severity: "moderada", relation: "nao_sei"}`.
  - `BudgetDivergence.test.tsx`: `relation="sinistro"` + `budget_match="fora_do_orcamento"` renderiza o texto "Divergência".
- [ ] **Step 2:** FAIL. **Step 3:** Implementar (mock do `Car3D` nos testes).
- [ ] **Step 4:** PASS + `npx tsc --noEmit`. Verificar no navegador com o backend local: marcar 2 danos, finalizar, ver o PDF, assinar, gerar o link. Viewport iPad (1024×768) e monitor.
- [ ] **Step 5:** Commit `feat(web): conferencia do checklist de entrada 3D`.

### Task 17: Página pública de confirmação

**Files:**
- Create: `apps/dscar-web/src/app/(public)/confirmar-checklist/[token]/page.tsx`, `(public)/layout.tsx` (sem dock nem sidebar)
- Modify: `apps/dscar-web/src/middleware.ts:13-21` (allowlist `/confirmar-checklist`)
- Test: `.../confirmar-checklist/[token]/page.test.tsx`

**Produces:** o GET público mostra a placa, o modelo, um botão "Ver checklist (PDF)", um campo "Seu nome" e o botão **Confirmo que o veículo entrou nestas condições** (POST). 410 → "Este link venceu. Peça um novo à DS Car." 404 → "Link inválido." Sucesso → "Obrigado! Confirmação registrada." Visual escuro do ERP com o logo DS Car. A chamada sem sessão segue o mesmo caminho das páginas `esqueci-senha`/`redefinir-senha`.

- [ ] **Step 1: Teste que falha:** com o fetch mockado devolvendo 410, a página mostra "Este link venceu".
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS; verificar no navegador, em aba anônima, que a página abre sem login.
- [ ] **Step 5:** Commit `feat(web): pagina publica de confirmacao do checklist`.

---

## Fase 4 — Mobile

### Task 18: Fila offline do checklist

**Files:**
- Create: `apps/mobile/src/stores/entry-checklist.store.ts`
- Modify: `apps/mobile/src/stores/photo.store.ts:191` (`uploadPendingPhotos` envia `client_uuid: item.id` no FormData)

**Produces:**
- Store zustand `persist` + MMKV (`id: "entry-checklist-queue"`, mesmo fallback try/catch de `photo.store.ts:177-180`), por `osId`:
  `bodyType`, `stops: Record<StopKey, "done" | "sem_dano" | undefined>`, `damages: QueuedDamage[]`, `belongings: QueuedBelonging[]`.
  - `QueuedDamage = {clientUuid; panelKey; damageType; severity; relation; point: Vec3 | null; notes; photoClientUuids: string[]; syncStatus: "pending" | "synced" | "error"; serverId?: string}`
  - `QueuedBelonging = {clientUuid; description; photoClientUuid: string | null; syncStatus; serverId?}`
- Ações: `setBodyType`, `markStop`, `addDamage`, `updateDamage`, `addBelonging`, `clearOS`.
- `syncEntryChecklist(osId: string): Promise<{ok: boolean; pending: number}>`, nesta ordem: (1) `uploadPendingPhotos()`; (2) PATCH `checklist/entrada/` com `body_type` + `stops_done`; (3) POST de cada dano/pertence `pending` com `client_uuid` (`photo_client_uuids` para danos). Uma resposta 400 com `photos == "pending"` mantém o item `pending`; 409 marca `error` e guarda a mensagem "Checklist já finalizado na conferência".
- UUIDs: `Crypto.randomUUID()` (expo-crypto), como em `camera/index.tsx:176`.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** `cd apps/mobile && npx tsc --noEmit` → sem erros.
- [ ] **Step 3:** Commit `feat(mobile): fila offline do checklist de entrada`.

### Task 19: Fluxo das 7 paradas

> Resultado do spike (Task 1): **`data:` URI.** No iOS (simulador, dev build) o `file://` de `Paths.document` falha dentro do DOM component (`Could not load file:///…/car-3d/test.glb: Load failed`: a página do DOM component vem de `http://localhost:8081` e o WebKit não deixa uma origem http ler `file://`). Ler o arquivo no nativo com `new File(...).base64()` e passar `data:model/gltf-binary;base64,…` carrega; R3F renderiza, `useFrame` anima e o toque numa malha chega ao nativo pelo callback assíncrono (`onTap body`). Então `ensureModel` devolve a `data:` URI. Depende do `resolveRequest` em `apps/mobile/metro.config.js` (react da raiz no bundle web, igual ao react-dom).

**Files:**
- Create: `apps/mobile/src/components/car3d/Car3DDom.tsx` (`'use dom'`, embrulha `<Car3D>`; props serializáveis + `onPanelTap` assíncrono), `apps/mobile/src/lib/car3dAssets.ts` (`ensureModel(entry: CarModelEntry): Promise<string>`, com a entrada vinda de `resolveCarModel` usando `vehicle_make`/`vehicle_family`/`allow_nc_models` do GET de estado; baixa `${WEB_URL}/car-3d/<entry.file>` e o `regions.json` para `Paths.document/car-3d/` uma vez e devolve o caminho/URI conforme o spike), `apps/mobile/src/components/entry-checklist/` (`StopProgress.tsx`, `StopScreen.tsx`, `DamageSheet.tsx`, `BelongingsStop.tsx`, `BodyTypePicker.tsx`)
- Modify: `apps/mobile/app/(app)/vistoria/entrada/[osId].tsx` (reescrito; mantém a rota porque três telas já levam até ela), `apps/mobile/app/(app)/camera/index.tsx` (aceita `returnTo` com `stop` e devolve o `photoId` capturado), `apps/mobile/src/components/checklist/ItemChecklistGrid.tsx` (prop `categories?: string[]`)

**Produces (comportamento):**
- Sem `bodyType` (nem sugestão do GET de estado) → `BodyTypePicker` com 5 botões grandes.
- `StopProgress`: 7 segmentos (verde = feito, roxo = atual, cinza = pendente) + "PARADA n DE 7" + nome da parada.
- Paradas 1–5 (`StopScreen`):
  - Os slots daquela parada como cartões de foto (abrem a câmera com `folder="checklist_entrada"`, `checklistType="entrada"`, `slot`).
  - O `Car3DDom` pequeno na `view` da parada, com as peças da parada tocáveis (toque fora delas é ignorado) e a lista das peças da parada como alternativa ao toque.
  - O toque abre o `DamageSheet` (tipo → gravidade → relação → foto obrigatória: tirar agora ou escolher entre as fotos da parada).
  - Botões **Sem dano aqui** e **Próximo →**. "Próximo" só habilita quando `canCompleteStop` dá `ok`; senão mostra o que falta.
- Parada 6: `ItemChecklistGrid` com `categories={["tires","accessories","interior","mechanical"]}` + os 6 slots de detalhe.
- Parada 7: `BelongingsStop` → lista; "Adicionar pertence" = foto + descrição.
- Pode voltar a qualquer parada pelo `StopProgress`.
- Final: botão **Enviar para conferência** → `syncEntryChecklist` → tela "Checklist enviado. Finalize e colha a assinatura na conferência (iPad ou monitor)". Mostra os pendentes, se houver. A assinatura e a mudança de status que existiam aqui saem desta tela, porque agora são da conferência.
- Também corrige o bug atual: `CHECKLIST_TYPE` deixa de ser `'vistoria_inicial'` e vira `'entrada'`.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** `npx tsc --noEmit` → limpo.
- [ ] **Step 3:** Rodar no simulador iOS (`attach` primeiro) com o backend local: fazer as 7 paradas numa OS de teste, marcando 2 danos com foto e 1 pertence, em modo avião; voltar a rede, tocar Enviar e conferir que os registros aparecem na conferência web sem duplicar.
- [ ] **Step 4:** Commit `feat(mobile): checklist de entrada em 7 paradas com carro 3D`.

---

## Fase 5 — Verificação final

### Task 20: Verificação de ponta a ponta

- [ ] **Step 1:** Backend, por arquivo: os 9 arquivos de teste novos + `apps/cilia/tests/`, `apps/followups/tests/`, `apps/service_orders/tests/test_transition_validator.py`, `apps/service_orders/tests/test_photos.py`, `apps/documents/tests/`. Comparar as falhas com a base `docs/checklist-entrada-3d` (via `git archive` no container, ver memória da suíte). Não pode haver falha nova.
- [ ] **Step 2:** `cd packages/car-3d && npx vitest run`; `cd apps/dscar-web && npx vitest run src/app/\(app\)/os/\[numero\]/checklist src/app/\(public\)` e `npx tsc --noEmit`; `cd apps/mobile && npx tsc --noEmit`.
- [ ] **Step 3:** Roteiro manual, gravando as telas como prova:
  - OS de seguradora: checklist no celular (7 paradas) → conferência no iPad → finalizar → PDF com 4 ângulos → link remoto → confirmar em aba anônima → selo "remoto".
  - Importar um orçamento XML com a porta e sem o capô → o capô aparece como "Pré-existente · fora do sinistro" → existe o retorno "Oferecer orçamento particular" para o consultor.
  - Reabrir como gerente → versão 2, assinatura pendente, link antigo dá 404.
- [ ] **Step 4:** Abrir o PR com o resumo e as capturas.
