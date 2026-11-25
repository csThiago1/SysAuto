# Tempo real só local — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a OS mudada numa janela aparece nas outras em até ~3 s, só no Docker local. Produção não muda nada.

**Architecture:** o backend publica `{"entity","id","action"}` no grupo Channels `tenant_<schema>` em `transaction.on_commit`, a partir de sinais de `ServiceOrder` e `ServiceOrderEvent`. Um processo uvicorn separado (`paddock_ws`, porta 8001) atende `ws/realtime/` e autentica com um ticket assinado de 60 s, pedido pelo proxy do Next. No navegador, um `RealtimeProvider` mantém um websocket por aba e invalida as queries do TanStack. Duas chaves desligam tudo fora do local: `REALTIME_ENABLED` (backend) e `NEXT_PUBLIC_REALTIME_WS_URL` (frontend).

**Tech Stack:** Django 5 + DRF + django-tenants + Channels 4 / channels-redis; uvicorn; Next.js 16 + TanStack Query v5 + Zod; pytest (TenantTestCase, pytest-asyncio) e vitest (jsdom).

**Spec:** `docs/superpowers/specs/2026-11-25-tempo-real-local-design.md`, que complementa a parte 2 de `docs/superpowers/specs/2026-11-25-areas-e-tempo-real-design.md`.

## Global Constraints

- Nada na Oracle nem na Vercel. Nenhum passo pede ação manual do Thiago.
- `REALTIME_ENABLED` tem padrão `False` em `base.py` e vale `True` só em `dev.py`. Com ele desligado, nenhuma ida ao Redis ao salvar uma OS.
- Sem `NEXT_PUBLIC_REALTIME_WS_URL`, o provider não cria `WebSocket` nem pede ticket.
- Ticket: `TimestampSigner(salt="realtime.ticket")`, `max_age=60`, conteúdo `{"u": "<id do usuário>", "s": "<schema>"}`. Nada de PII no ticket, nos eventos nem nos logs.
- Evento: `{"entity": "service_order", "id": "<uuid>", "action": "changed"}`. Só avisa, o dado vem pela API de sempre.
- Falha ao publicar é logada (`logger.warning`, sem PII) e nunca quebra a gravação.
- Regras do CLAUDE.md: type hints, Black/isort, `logging` (nunca `print`), TS strict sem `any`, Zod em dado externo (ticket e evento).
- Branch `feat/tempo-real-local` (empilhada sobre `docs/areas-tempo-real`, PR #51), no worktree `/Users/thiagocampos/Documents/Projetos/00-EMPRESAS/ds-car/.worktrees/tempo-real-local`.
- Testes do backend rodam contra o código do **worktree**, porque o `paddock_django` monta o checkout principal. Use, a partir da raiz do worktree:
  `docker run --rm --network docker_default --env-file /Users/thiagocampos/Documents/Projetos/grupo-dscar/grupo-dscar/.env -v "$PWD/backend/core:/app" -w /app paddock-django:dev timeout 1800 pytest <paths> -q -p no:cacheprovider -o addopts=""`
  O container usa `config.settings.dev` (env da imagem), não o `test.py`. Rode só os arquivos do plano, nunca a suíte inteira.
- Frontend: `npm install` na raiz do worktree uma vez; testes com `npx vitest run <arquivo>` em `apps/dscar-web`; `npm run typecheck` em `apps/dscar-web`.

## Review Focus

1. Rajada de eventos: uma importação do Cilia cria dezenas de itens em 1 s. A tela deve buscar de novo uma vez, não dezenas. O provider agrupa invalidações por 300 ms (Task 6).
2. Ticket vencido ou forjado: o consumer fecha com código 4401. O cliente pede ticket novo e reconecta com espera crescente, sem laço rápido (Tasks 2 e 6).
3. Isolamento de tenant: quem conectou com ticket do schema A não recebe evento do schema B (Task 2).
4. Redis fora do ar ao salvar OS: a gravação responde normalmente e o erro vai para o log (Task 3).
5. Gravação desfeita (rollback): nenhum evento sai, porque só se publica no `on_commit` (Task 3).

---

### Task 1: Ticket do websocket

**Files:**
- Create: `backend/core/apps/realtime/__init__.py`, `backend/core/apps/realtime/tickets.py`, `backend/core/apps/realtime/views.py`, `backend/core/apps/realtime/urls.py`
- Create: `backend/core/apps/realtime/tests/__init__.py`, `backend/core/apps/realtime/tests/test_ticket.py`
- Modify: `backend/core/config/urls.py` (adicionar `path("api/v1/realtime/", include("apps.realtime.urls"))` junto aos outros `api/v1/`)

`apps/realtime` é um pacote comum, **sem** models e **fora** do `INSTALLED_APPS`. Não precisa de migration.

**Interfaces:**
- Produces: `make_ticket(user_id: str, schema: str) -> str`; `read_ticket(ticket: str) -> tuple[str, str] | None` (devolve `(user_id, schema)`, ou `None` se a assinatura for inválida ou passar de 60 s); `GET /api/v1/realtime/ticket/` → `200 {"ticket": "<str>"}`, com as permissões padrão do DRF (`IsAuthenticated`).

- [ ] **Step 1: Testes que falham** em `test_ticket.py`:
  - `test_ticket_ida_e_volta`: `read_ticket(make_ticket("u1", "tenant_dscar")) == ("u1", "tenant_dscar")`.
  - `test_ticket_vencido`: com `unittest.mock.patch("django.core.signing.time.time")` avançado 61 s, `read_ticket(...) is None`.
  - `test_ticket_forjado`: `read_ticket("lixo") is None` e `read_ticket(t[:-2] + "xx") is None`.
  - `test_endpoint_devolve_ticket_do_tenant` (TenantTestCase, montado como em `apps/service_orders/tests/test_color_enum.py`: `GlobalUser.objects.create_user` com `email_hash`, `APIClient` com `HTTP_HOST=self.domain.domain`, `force_authenticate`): `GET /api/v1/realtime/ticket/` → 200, e `read_ticket(r.data["ticket"]) == (str(self.user.pk), self.tenant.schema_name)`.
  - `test_endpoint_sem_login_401`: sem `force_authenticate` → 401.
- [ ] **Step 2: Rodar e ver falhar** com `pytest apps/realtime/tests/test_ticket.py` (comando dos Global Constraints). Esperado: `ModuleNotFoundError: apps.realtime`.
- [ ] **Step 3: Implementar.** `tickets.py` com `TimestampSigner(salt="realtime.ticket").sign_object(...)` / `unsign_object(..., max_age=60)`, capturando `BadSignature` (inclui `SignatureExpired`). A view é uma `APIView` que usa `connection.schema_name` e `str(request.user.pk)`. A rota `ticket/` tem `name="realtime-ticket"`.
- [ ] **Step 4: Rodar e ver passar.** Esperado: `5 passed`.
- [ ] **Step 5: Commit** `feat(realtime): ticket assinado para o websocket`

### Task 2: Consumer `ws/realtime/` e ASGI

**Files:**
- Create: `backend/core/apps/realtime/consumers.py`, `backend/core/apps/realtime/routing.py`, `backend/core/apps/realtime/tests/test_consumer.py`
- Modify: `backend/core/config/asgi.py` (rotear `apps.realtime.routing.websocket_urlpatterns`; tirar o `AuthMiddlewareStack`; manter o `AllowedHostsOriginValidator`)
- Delete: `backend/core/apps/service_orders/consumers.py`, `backend/core/apps/service_orders/routing.py` (esqueleto sem uso; nada no frontend abre `ws/service-orders/`)

**Interfaces:**
- Consumes: `read_ticket` (Task 1).
- Produces: `group_name(schema: str) -> str` em `apps/realtime/consumers.py`, que devolve `f"tenant_{schema}"`. `RealtimeConsumer(AsyncJsonWebsocketConsumer)` em `ws/realtime/`, que lê `?ticket=` de `scope["query_string"]`, fecha com `code=4401` se `read_ticket` der `None` e, se não, entra em `group_name(schema)`. O handler `realtime_event(self, message: dict) -> None` repassa `message["event"]` ao cliente. O consumer não faz query no banco.

- [ ] **Step 1: Testes que falham** em `test_consumer.py` (funções `@pytest.mark.asyncio`, fixture `settings` com `settings.CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}`, `WebsocketCommunicator(RealtimeConsumer.as_asgi(), "/ws/realtime/?ticket=...")`):
  - `test_ticket_valido_conecta_e_recebe`: conecta; `group_send(group_name("tenant_a"), {"type": "realtime.event", "event": EV})` → `receive_json_from() == EV`.
  - `test_sem_ticket_fecha_4401` e `test_ticket_forjado_fecha_4401`: `connected, code = await c.connect()` → `connected is False` e `code == 4401`.
  - `test_nao_recebe_de_outro_tenant`: conectado com ticket de `tenant_a`, envio para `group_name("tenant_b")` → `await c.receive_nothing() is True`.
- [ ] **Step 2: Rodar e ver falhar** (`pytest apps/realtime/tests/test_consumer.py`).
- [ ] **Step 3: Implementar** consumer, routing (`path("ws/realtime/", RealtimeConsumer.as_asgi())`) e o `asgi.py`.
- [ ] **Step 4: Rodar e ver passar** os 4 testes, mais `python -c "import config.asgi"` dentro do mesmo `docker run`, que deve terminar sem erro.
- [ ] **Step 5: Commit** `feat(realtime): consumer por tenant com ticket; remove esqueleto antigo`

### Task 3: Publicação dos eventos de OS, com chave liga/desliga

**Files:**
- Create: `backend/core/apps/realtime/publish.py`, `backend/core/apps/service_orders/signals.py`, `backend/core/apps/realtime/tests/test_publish.py`
- Modify: `backend/core/config/settings/base.py` (`REALTIME_ENABLED = config("REALTIME_ENABLED", default=False, cast=bool)`, perto de `CHANNEL_LAYERS`), `backend/core/config/settings/dev.py` (`REALTIME_ENABLED = True`), `backend/core/apps/service_orders/apps.py` (método `ready()` que importa `.signals`)

**Interfaces:**
- Consumes: `group_name` (Task 2).
- Produces: `publish_change(entity: str, obj_id: object) -> None`. Com `settings.REALTIME_ENABLED` falso, retorna sem fazer nada. Com ele ligado, lê `connection.schema_name` agora e registra `transaction.on_commit` para um `async_to_sync(get_channel_layer().group_send)(group_name(schema), {"type": "realtime.event", "event": {"entity": entity, "id": str(obj_id), "action": "changed"}})` dentro de `try/except Exception`, com `logger.warning("realtime: falha ao publicar %s", entity)`.
- Sinais em `signals.py`: `post_save` de `ServiceOrder` → `publish_change("service_order", instance.pk)`. `post_save` de `ServiceOrderEvent` → `publish_change("service_order", instance.service_order_id)`. Esse segundo cobre itens, fotos, pagamentos e assinatura, que passam pelo `OSEventLogger`.

- [ ] **Step 1: Testes que falham** em `test_publish.py` (TenantTestCase, `override_settings(REALTIME_ENABLED=..., CHANNEL_LAYERS=InMemory)`, `unittest.mock.patch("apps.realtime.publish.async_to_sync")` onde for preciso):
  - `test_desligado_nao_publica`: `REALTIME_ENABLED=False`, `with self.captureOnCommitCallbacks(execute=True) as cbs: publish_change("service_order", uuid4())` → `cbs == []` e o mock do `async_to_sync` não foi chamado.
  - `test_ligado_publica_no_grupo_do_tenant`: `REALTIME_ENABLED=True` → o `group_send` é chamado uma vez com `group_name(self.tenant.schema_name)` e o evento exato da Global Constraints.
  - `test_redis_fora_nao_quebra`: o mock do `group_send` levanta `ConnectionError` → nenhuma exceção sai do `captureOnCommitCallbacks(execute=True)`, e `assertLogs("apps.realtime.publish", "WARNING")` captura o aviso.
  - `test_rollback_nao_publica`: `captureOnCommitCallbacks(execute=False)` envolvendo um `transaction.atomic()` que levanta exceção depois do `publish_change` → os callbacks da transação desfeita não são executados (o mock não é chamado).
  - `test_salvar_os_dispara_evento`: criar uma OS pela API, como em `test_color_enum.create_os`, dentro de `captureOnCommitCallbacks(execute=True)` com o mock → pelo menos uma chamada com `"id": <id da OS>`.
- [ ] **Step 2: Rodar e ver falhar** (`pytest apps/realtime/tests/test_publish.py`).
- [ ] **Step 3: Implementar** `publish.py`, `signals.py`, o `ready()` e os settings.
- [ ] **Step 4: Rodar e ver passar** `apps/realtime` inteiro, mais `apps/service_orders/tests/test_color_enum.py` (garante que o sinal não quebra a criação de OS).
- [ ] **Step 5: Commit** `feat(realtime): eventos de OS após o commit, desligados por padrão`

### Task 4: Processo websocket no Docker local

**Files:**
- Modify: `backend/core/requirements/dev.txt` (`uvicorn[standard]==0.32.1`, a mesma versão do `prod.txt`)
- Modify: `infra/docker/docker-compose.dev.yml` (serviço novo `ws`, logo depois de `django`)

O serviço `ws` usa `image: paddock-django:dev`, `container_name: paddock_ws`, o mesmo `env_file` e o mesmo volume do `django`, `ports: ["8001:8001"]`, `depends_on` com `redis` (`service_healthy`) e o comando `uvicorn config.asgi:application --host 0.0.0.0 --port 8001 --reload`. Comentário de uma linha: é o mesmo desenho planejado para a VM paga (gunicorn para HTTP, um processo só para websocket).

- [ ] **Step 0: `.env` no worktree**: o compose lê `../../.env`, e o worktree não tem esse arquivo. Rode `ln -s /Users/thiagocampos/Documents/Projetos/grupo-dscar/grupo-dscar/.env .env` na raiz do worktree. O arquivo já é gitignored (`*.env`). Use um link, não uma cópia, para os segredos não ficarem duplicados.
- [ ] **Step 1: Rebuild da imagem**: `docker compose -f infra/docker/docker-compose.dev.yml build django`. Esperado: build termina; `docker run --rm paddock-django:dev python -c "import uvicorn"` sem erro.
- [ ] **Step 2: Subir só o ws**: `docker compose -f infra/docker/docker-compose.dev.yml up -d --no-deps ws`. Os outros containers do projeto `docker` não podem ser recriados. Confira com `docker ps` que `paddock_django` mantém o mesmo tempo de "Up".
- [ ] **Step 3: Verificar**: `docker logs paddock_ws` mostra `Uvicorn running on http://0.0.0.0:8001`. `curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGVzdA==" -H "Origin: http://localhost:3001" "http://localhost:8001/ws/realtime/?ticket=x"` faz o handshake, e o consumer fecha em seguida (4401).
- [ ] **Step 4: Commit** `chore(infra): processo de websocket no docker local`

### Task 5: Base do tempo real no frontend

**Files:**
- Create: `apps/dscar-web/src/lib/realtime.ts`, `apps/dscar-web/src/lib/realtime.test.ts`

**Interfaces:**
- Produces:
  - `RealtimeEventSchema`: Zod `{ entity: z.enum(["service_order"]), id: z.string(), action: z.literal("changed") }`. Tipo `RealtimeEvent`.
  - `TicketResponseSchema`: Zod `{ ticket: z.string().min(1) }`.
  - `REALTIME_INVALIDATIONS: Record<RealtimeEvent["entity"], readonly QueryKey[]>`, com `service_order` → `[["service-orders"], ["service-order"], ["service-order-history"], ["dashboard-stats"]]`. São os prefixos usados hoje pela lista, pelo Kanban, pelo detalhe, pela timeline e pelo dashboard.
  - `reconnectDelayMs(attempt: number): number`, que dá `min(1000 * 2 ** attempt, 30000)`.
  - `realtimeUrl(): string | null`, que devolve `process.env.NEXT_PUBLIC_REALTIME_WS_URL` ou `null` quando vazia ou ausente.

- [ ] **Step 1: Testes que falham** em `realtime.test.ts`: o schema aceita o evento exato da spec e recusa `entity: "foo"` e `action: "deleted"`; `reconnectDelayMs(0) === 1000`, `reconnectDelayMs(3) === 8000`, `reconnectDelayMs(10) === 30000`; `realtimeUrl()` dá `null` com `vi.stubEnv("NEXT_PUBLIC_REALTIME_WS_URL", "")` e dá a URL quando definida.
- [ ] **Step 2: Rodar e ver falhar**: `npx vitest run src/lib/realtime.test.ts`.
- [ ] **Step 3: Implementar** `realtime.ts`.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** `feat(web): base do tempo real (schemas, invalidações, espera)`

### Task 6: `RealtimeProvider` no layout

**Files:**
- Create: `apps/dscar-web/src/components/RealtimeProvider.tsx`, `apps/dscar-web/src/components/RealtimeProvider.test.tsx`
- Modify: `apps/dscar-web/src/app/(app)/layout.tsx` (renderizar `<RealtimeProvider />` junto do `<CommandPalette />`)

**Interfaces:**
- Consumes: tudo da Task 5; `GET /api/proxy/realtime/ticket/` (Task 1, via proxy existente).
- Produces: `RealtimeProvider(): null`, componente `"use client"` que não renderiza nada. Comportamento:
  1. Se `realtimeUrl()` for `null`, não faz nada.
  2. Pede o ticket com `fetch("/api/proxy/realtime/ticket/")`, valida com `TicketResponseSchema` e abre `new WebSocket(\`${url}?ticket=${encodeURIComponent(ticket)}\`)`.
  3. Cada mensagem passa por `RealtimeEventSchema.safeParse`. Mensagem inválida é ignorada. As chaves de `REALTIME_INVALIDATIONS` se acumulam e são invalidadas de uma vez 300 ms depois do primeiro evento da rajada.
  4. No `close`, ou se o ticket falhar, reconecta após `reconnectDelayMs(tentativa)` com ticket novo. A tentativa volta a 0 no `open`.
  5. No `open` depois de uma reconexão (não na primeira), roda `queryClient.invalidateQueries()` para cobrir eventos perdidos.
  6. No unmount, fecha o socket e cancela os timers.
  - A aba em segundo plano mantém o socket aberto *(decisão do plano: mais simples, e o custo é só local)*.

- [ ] **Step 1: Testes que falham** em `RealtimeProvider.test.tsx` (vitest com fake timers, `WebSocket` falso via `vi.stubGlobal`, `fetch` falso, `QueryClient` real com `vi.spyOn(qc, "invalidateQueries")`):
  - `sem env não cria WebSocket nem pede ticket`: o construtor falso e o `fetch` têm 0 chamadas.
  - `evento de OS invalida os prefixos uma vez por rajada`: 5 mensagens válidas em sequência, avança 300 ms → `invalidateQueries` é chamado exatamente uma vez para cada uma das 4 chaves de `service_order`.
  - `mensagem inválida é ignorada`: `"{"` e `{"entity":"foo"}` não chamam `invalidateQueries` nem lançam erro.
  - `reconexão espera e pede ticket novo`: `close` → nada antes de 1000 ms; em 1000 ms, um segundo `fetch` do ticket e um segundo `WebSocket`; no `open` dele, `invalidateQueries()` sem argumentos.
- [ ] **Step 2: Rodar e ver falhar**: `npx vitest run src/components/RealtimeProvider.test.tsx`.
- [ ] **Step 3: Implementar** o provider e montá-lo no layout.
- [ ] **Step 4: Rodar e ver passar**, mais `npm run typecheck` e `npx vitest run src/lib/realtime.test.ts`.
- [ ] **Step 5: Commit** `feat(web): provider de tempo real no layout, desligado sem a env`

### Task 7: Verificação local de ponta a ponta

**Files:**
- Modify: `apps/dscar-web/.env.local` do worktree, que é gitignored e por isso não tem commit: `NEXT_PUBLIC_REALTIME_WS_URL=ws://localhost:8001/ws/realtime/` (copie o `.env.local` do checkout principal antes, se existir).
- Modify: `docs/superpowers/specs/2026-11-25-areas-e-tempo-real-design.md`, seção "Ordem de entrega", item 2: uma frase dizendo que o tempo real foi entregue só no ambiente local, com link para a spec curta.

- [ ] **Step 1: Subir o front do worktree**: `npm run dev` em `apps/dscar-web` (porta 3001), em segundo plano. O backend HTTP é o `paddock_django`, que monta o checkout principal. As Tasks 1 e 3 precisam estar lá também. Por isso, antes de testar, aponte o `paddock_django` para o worktree com `docker compose -f infra/docker/docker-compose.dev.yml up -d --no-deps django` **a partir do worktree**, que monta `backend/core` do worktree. No fim, volte rodando o mesmo comando a partir do checkout principal.
- [ ] **Step 2: Duas janelas** no navegador interno, logadas com o admin do seed (`backend/core/setup_tenant.py`), ambas em `/os/kanban`. Mova uma OS na janela A. Esperado: a janela B mostra a mudança em ≤ 3 s, sem recarregar. Tire um print.
- [ ] **Step 3: Queda e volta**: `docker restart paddock_ws`, mude a OS na janela A durante a queda. Esperado: quando o socket volta, a janela B mostra o estado atual.
- [ ] **Step 4: Situação de produção**: pare o front, tire a env do `.env.local` e suba de novo. Esperado: nenhuma conexão para `:8001` em `read_network_requests`.
- [ ] **Step 5: Devolver o `paddock_django` ao checkout principal** (Step 1) e confirmar `docker ps` saudável.
- [ ] **Step 6: Commit** `docs(erp): tempo real entregue só no ambiente local`
