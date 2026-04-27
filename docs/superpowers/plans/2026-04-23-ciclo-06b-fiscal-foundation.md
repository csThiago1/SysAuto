# Plano de Implementação — Ciclo 06B: Fiscal Foundation

**Data:** 2026-04-23
**Ciclo:** 06B — Fiscal foundation (app + client + Celery)
**Branch:** `feat/ciclo-06b-fiscal-foundation`
**Spec de referência:** `docs/superpowers/specs/2026-04-23-modulo-fiscal-focus-nfe-design.md` §3.2, §4, §5, §11
**Skill:** `.claude/SKILLS.md` → `fiscal-nfe-pattern`

---

## 1. Contexto — o que já existe e o que não pode ser quebrado

### 1.1 O que já existe em `apps/fiscal`

A app `apps.fiscal` já está registrada em `TENANT_APPS` e tem rota em `config/urls.py` (`/api/v1/fiscal/`). A estrutura atual (entregue no MO-5):

| Arquivo | Estado | Conteúdo |
|---|---|---|
| `models.py` | Existe, funcional | `FiscalDocument` (stub simples), `NFeEntrada`, `NFeEntradaItem` |
| `migrations/0001_initial.py` | Existe, aplicada | Cria `fiscal_document` com `PaddockBaseModel` (UUID pk, `is_active`) |
| `migrations/0002_nfeentrada_nfeentradaitem_and_more.py` | Existe, aplicada | Cria `fiscal_nfe_entrada`, `fiscal_nfe_entrada_item` |
| `views.py` | Existe, funcional | `NFeEntradaViewSet` com `reconciliar_item` e `gerar_estoque` |
| `urls.py` | Existe, funcional | Registra `NFeEntradaViewSet` em `nfe-entrada/` |
| `serializers.py` | Existe, funcional | 4 serializers de NFeEntrada |
| `admin.py` | Existe, funcional | `FiscalDocumentAdmin`, `NFeEntradaAdmin` |
| `services/ingestao.py` | Existe, funcional | `NFeIngestaoService` + `EstoqueJaGerado` |
| `services.py` | Existe, vazio | Sem conteúdo |
| `tasks.py` | Existe, vazio | Sem conteúdo |
| `tests.py` | Existe, vazio | Sem conteúdo |
| `apps.py` | Existe | `FiscalConfig` como AppConfig (nome conflita com o novo model — ver Tarefa 1) |

### 1.2 O que falta (escopo do 06B)

- `FiscalConfigModel` — emissor com sequenciadores atômicos (CNPJ, seq_nfse/nfe/nfce, focus_token)
- `FiscalDocumentItem` — itens fiscais por documento
- `FiscalEvent` — log de auditoria de chamadas HTTP e webhooks
- `apps/fiscal/clients/focus_nfe_client.py` — cliente httpx baseado em `CiliaClient`
- `apps/fiscal/exceptions.py` — hierarquia `FocusNFeError`
- `apps/fiscal/services/ref_generator.py` — sequenciador atômico `next_fiscal_ref()`
- `apps/fiscal/services/fiscal_service.py` — skeleton `FiscalService` com stubs
- `apps/fiscal/tasks.py` — `poll_fiscal_document` com Celery retry
- `apps/fiscal/views.py` — expandir com `FocusWebhookView`
- `apps/fiscal/management/commands/register_focus_webhook.py`
- `apps/fiscal/tests/` — pasta com ≥ 25 testes usando `respx`
- Settings `FOCUS_NFE_*` em `config/settings/base.py`
- `.env.example` — 5 variáveis novas

### 1.3 O que NÃO pode ser quebrado

- **`NFeEntrada` e `NFeEntradaItem`**: modelos MO-5 com migrations já aplicadas. Zero alterações.
- **`NFeEntradaViewSet`** e suas rotas: continuam funcionando sem nenhuma alteração.
- **`NFeIngestaoService`** e `EstoqueJaGerado`: continuam intactos.
- **`FiscalDocument`** existente: o stub do MO-1 NÃO é alterado neste ciclo — as FKs da spec §5.2 (para `persons.Person`, `service_orders.ServiceOrder`) ficam para migration `0004` no Ciclo 06C. O Ciclo 06B apenas **adiciona** novas tabelas.
- **`FiscalConfig` como AppConfig**: o `apps.py` usa `FiscalConfig` como nome da `AppConfig`. Resolver em Tarefa 1 (bloqueante).

### 1.4 Conflito de nomes — bloqueante

`apps/fiscal/apps.py` define `class FiscalConfig(AppConfig)`. A spec §5.1 define `class FiscalConfig(models.Model)`. **É necessário renomear a AppConfig para `FiscalAppConfig`** antes de criar o model. Isso é a Tarefa 1.

---

## 2. Tarefas atômicas

### Tarefa 1 — Renomear AppConfig + criar estrutura de diretórios
**Commit:** `refactor(fiscal): renomear FiscalConfig→FiscalAppConfig + criar estrutura clients/tests`

**Descrição:**
- Renomear `class FiscalConfig(AppConfig)` → `class FiscalAppConfig(AppConfig)` em `apps/fiscal/apps.py`
- Verificar referências a `FiscalConfig` em `INSTALLED_APPS` ou `default_app_config` e atualizar
- Criar diretórios e `__init__.py`:
  - `apps/fiscal/clients/__init__.py`
  - `apps/fiscal/tests/__init__.py`
  - `apps/fiscal/tests/fixtures/.gitkeep`
  - `apps/fiscal/management/__init__.py`
  - `apps/fiscal/management/commands/__init__.py`
- Converter `services.py` vazio em diretório `services/` (mover `services/ingestao.py` se necessário, garantindo imports em `views.py` continuam funcionando)

**Critérios de aceite:**
- `python manage.py check` retorna 0 issues
- `NFeEntradaViewSet` continua acessível em `/api/v1/fiscal/nfe-entrada/`

**Testes:** Nenhum novo — validação por `manage.py check`

---

### Tarefa 2 — Settings `FOCUS_NFE_*` + guard DEBUG/produção
**Commit:** `feat(fiscal): settings FOCUS_NFE_* + guard produção com DEBUG`

**Descrição:**
Adicionar em `config/settings/base.py`:

```python
# ─── Focus NF-e ────────────────────────────────────────────────────────────
FOCUS_NFE_TOKEN = config("FOCUS_NFE_TOKEN", default="")
FOCUS_NFE_AMBIENTE = config("FOCUS_NFE_AMBIENTE", default="homologacao")
FOCUS_NFE_BASE_URL = (
    "https://homologacao.focusnfe.com.br"
    if FOCUS_NFE_AMBIENTE == "homologacao"
    else "https://api.focusnfe.com.br"
)
FOCUS_NFE_TIMEOUT_SECONDS = config("FOCUS_NFE_TIMEOUT_SECONDS", default=60, cast=int)
FOCUS_NFE_WEBHOOK_SECRET = config("FOCUS_NFE_WEBHOOK_SECRET", default="")
CNPJ_EMISSOR = config("CNPJ_EMISSOR", default="")

if FOCUS_NFE_AMBIENTE == "producao" and DEBUG:
    from django.core.exceptions import ImproperlyConfigured
    raise ImproperlyConfigured(
        "FOCUS_NFE_AMBIENTE=producao não é permitido quando DEBUG=True."
    )
```

Atualizar `.env.example` com bloco:
```
# ─── Focus NF-e ─────────────────────────────────────────────────────────────
FOCUS_NFE_TOKEN=change-me-token-homologacao
FOCUS_NFE_AMBIENTE=homologacao
FOCUS_NFE_TIMEOUT_SECONDS=60
FOCUS_NFE_WEBHOOK_SECRET=change-me-random-secret
CNPJ_EMISSOR=00000000000000
```

**Critérios de aceite:**
- `FOCUS_NFE_AMBIENTE=producao` + `DEBUG=True` → `ImproperlyConfigured`
- `FOCUS_NFE_AMBIENTE=homologacao` + `DEBUG=True` → OK

**Testes:** `test_settings_guard.py` — 2 testes

---

### Tarefa 3 — Hierarquia de exceptions
**Commit:** `feat(fiscal): hierarquia FocusNFeError + filhos`

**Arquivo criado:** `apps/fiscal/exceptions.py`

```python
class FocusNFeError(Exception): ...        # base
class FocusAuthError(FocusNFeError): ...   # 401/403
class FocusValidationError(FocusNFeError): # 400/415/422
class FocusNotFoundError(FocusNFeError): . # 404
class FocusRateLimitError(FocusNFeError): .# 429
class FocusServerError(FocusNFeError): ... # 5xx
class FocusSEFAZError(FocusNFeError): ...  # rejeição SEFAZ
class FocusTimeout(FocusNFeError): ...     # timeout de rede
class FocusConflict(FocusNFeError): ...    # 409 conflito de ref
```

**Testes:** `test_exceptions.py` — 3 testes (hierarquia, catch base, separação retry vs não-retry)

---

### Tarefa 4 — `FocusNFeClient` httpx
**Commit:** `feat(fiscal): FocusNFeClient httpx + FocusResponse dataclass`

**Arquivo criado:** `apps/fiscal/clients/focus_nfe_client.py`

Padrão copiado de `cilia_client.py`. Regras da skill `fiscal-nfe-pattern`:
- **Nunca levanta exception em 4xx/5xx** — retorna `FocusResponse(status_code, data, duration_ms, raw_text, headers)`
- Autenticação HTTP Basic: `httpx.Client(auth=(token, ""))`
- Timeout via `settings.FOCUS_NFE_TIMEOUT_SECONDS`
- Context manager (`__enter__`/`__exit__`)
- Método privado `_request(method, path, **kwargs)` que mede `duration_ms`
- Body não-JSON → `data=None`, `raw_text` preenchido (sem exceção)
- Timeout `httpx.TimeoutException` propagado (Celery cuida do retry)

Métodos: `emit_nfse`, `consult_nfse`, `cancel_nfse`, `emit_nfe`, `consult_nfe`, `cancel_nfe`, `cce`, `inutilizar`, `emit_nfce`, `consult_nfce`, `cancel_nfce`, `manifestar`, `listar_nfes_recebidas`

**Testes:** `test_client.py` — 7 testes (todos com `respx.mock`)

---

### Tarefa 5 — Models `FiscalConfigModel`, `FiscalDocumentItem`, `FiscalEvent`
**Commit:** `feat(fiscal): models FiscalConfig + FiscalDocumentItem + FiscalEvent`

**Arquivo modificado:** `apps/fiscal/models.py` — apenas adicionar, sem tocar nos modelos existentes

**`FiscalConfigModel`** (usar este nome para evitar conflito com AppConfig):
```python
class FiscalConfigModel(models.Model):
    cnpj = models.CharField(max_length=14, unique=True)
    inscricao_estadual = models.CharField(max_length=20, blank=True, default="")
    inscricao_municipal = models.CharField(max_length=20, blank=True, default="")
    razao_social = models.CharField(max_length=200)
    nome_fantasia = models.CharField(max_length=200, blank=True, default="")
    regime_tributario = models.PositiveSmallIntegerField(default=1)
    endereco = models.JSONField(default=dict)
    focus_token = models.CharField(max_length=255, blank=True, default="")  # EncryptedField no 06C
    seq_nfse = models.PositiveIntegerField(default=1)
    seq_nfe = models.PositiveIntegerField(default=1)
    seq_nfce = models.PositiveIntegerField(default=1)
    serie_rps = models.CharField(max_length=5, default="1")
    environment = models.CharField(max_length=15, default="homologacao")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fiscal_config"
```

**`FiscalDocumentItem`**: FK `FiscalDocument`, campos fiscais (ncm, cfop, alíquotas ISS/ICMS/PIS/COFINS), `source_budget_item` e `source_os_item` com `db_constraint=False`.

**`FiscalEvent`**: FK nullable `FiscalDocument`, `event_type`, `http_status`, `payload` (JSONField), `response` (JSONField), `duration_ms`, `error_type`, `error_message`, `triggered_by` choices (`USER`, `CELERY`, `WEBHOOK`, `USER_MANUAL`), `created_at`.

**Migration 0003:**
- Arquivo: `apps/fiscal/migrations/0003_fiscal_config_item_event.py`
- APENAS `CREATE TABLE` — verificar com `sqlmigrate fiscal 0003`
- Zero `AlterField`/`RemoveField` em modelos existentes

**Testes:** `test_models.py` — 5 testes

---

### Tarefa 6 — `ref_generator.next_fiscal_ref()`
**Commit:** `feat(fiscal): ref_generator com sequenciadores atômicos select_for_update`

**Arquivo criado:** `apps/fiscal/services/ref_generator.py`

Implementação exata da skill `fiscal-nfe-pattern`:
```python
SEQ_FIELD_BY_TYPE = {
    "NFSE": "seq_nfse",
    "NFE": "seq_nfe",
    "NFE_DEV": "seq_nfe",
    "NFCE": "seq_nfce",
}

def next_fiscal_ref(config: FiscalConfigModel, doc_type: str) -> tuple[str, int]:
    """Retorna (ref, seq). Para NFS-e o seq é também o numero_rps."""
    field = SEQ_FIELD_BY_TYPE.get(doc_type)
    if field is None:
        raise ValueError(f"doc_type não suportado: {doc_type!r}")
    today = timezone.now().strftime("%Y%m%d")
    with transaction.atomic():
        FiscalConfigModel.objects.filter(pk=config.pk).select_for_update().update(
            **{field: F(field) + 1}
        )
        config.refresh_from_db(fields=[field])
    seq = getattr(config, field) - 1
    return f"{config.cnpj[:8]}-{doc_type}-{today}-{seq:06d}", seq
```

**Testes:** `test_ref_generator.py` — 6 testes (formato, incremento, contadores independentes, ValueError)

---

### Tarefa 7 — `FiscalService` skeleton
**Commit:** `feat(fiscal): FiscalService skeleton com stubs tipados`

**Arquivo criado:** `apps/fiscal/services/fiscal_service.py`

Apenas `get_config()`, `_client` property e `_raise_for_http()` são funcionais. Os demais métodos (`emit_nfse`, `emit_manual_nfse`, `cancel`, `consult`) levantam `NotImplementedError`.

`_raise_for_http()` é implementado completamente (usado pelo `poll_fiscal_document`):
- 401/403 → `FocusAuthError`
- 404 → `FocusNotFoundError`
- 429 → `FocusRateLimitError`
- 4xx → `FocusValidationError`
- 5xx → `FocusServerError`

**Testes:** `test_fiscal_service_skeleton.py` — 10 testes

---

### Tarefa 8 — Celery task `poll_fiscal_document`
**Commit:** `feat(fiscal): Celery task poll_fiscal_document com retry e FiscalEvent`

**Arquivo modificado:** `apps/fiscal/tasks.py`

```python
POLL_TERMINAL_STATES = {"AUTHORIZED", "DENIED", "ERROR", "CANCELLED"}
POLL_MAX_ATTEMPTS = 60

@shared_task(
    bind=True,
    autoretry_for=(FocusServerError, FocusRateLimitError, httpx.TimeoutException),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=10,
)
def poll_fiscal_document(self, document_id: str, attempt: int = 1) -> dict:
    ...
```

Fluxo:
1. Buscar `FiscalDocument` por UUID
2. Skip se status já é terminal
3. Mapear `doc_type` → método do client
4. Chamar método + criar `FiscalEvent(event_type="CONSULT")`
5. Mapear status Focus → status local via `_map_focus_status()`
6. Se não terminal e `attempt < POLL_MAX_ATTEMPTS`: `apply_async(countdown=10)`

**Imports lazy** (dentro da função): evitar import circular com `FiscalService` e `FiscalDocument`.

**Testes:** `test_tasks.py` — 6 testes (todos `@respx.mock` + `@pytest.mark.django_db`)

---

### Tarefa 9 — `FocusWebhookView`
**Commit:** `feat(fiscal): FocusWebhookView com validação path-secret e idempotência`

**Arquivo modificado:** `apps/fiscal/views.py` — adicionar view sem tocar em `NFeEntradaViewSet`

```python
class FocusWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, secret: str) -> Response:
        if secret != settings.FOCUS_NFE_WEBHOOK_SECRET:
            return Response(status=403)
        # Validar campos obrigatórios (ref, evento)
        # Idempotência: (ref, evento) já processado → 200 imediato
        # Criar FiscalEvent(event_type="WEBHOOK", triggered_by="WEBHOOK")
        # Se FiscalDocument encontrado: poll_fiscal_document.apply_async(countdown=2)
        # Se não encontrado: registrar evento orphan e retornar 200
```

URL: `POST /api/v1/fiscal/webhooks/focus/{secret}/`

**Testes:** `test_webhook.py` — 6 testes

---

### Tarefa 10 — Management command `register_focus_webhook`
**Commit:** `feat(fiscal): management command register_focus_webhook`

**Arquivo criado:** `apps/fiscal/management/commands/register_focus_webhook.py`

- Lê `FOCUS_NFE_TOKEN`, `FOCUS_NFE_BASE_URL`, `FOCUS_NFE_WEBHOOK_SECRET`
- POST para `{FOCUS_NFE_BASE_URL}/v2/hooks` com URL pública do webhook
- Aceita `--base-url` para ngrok em dev
- Em erro: imprime mensagem + exit code 1 (nunca falha silenciosamente)

```
python manage.py register_focus_webhook --base-url https://meusite.ngrok.io
```

**Testes:** `test_management_commands.py` — 2 testes

---

### Tarefa 11 — Admin expandido para novos models
**Commit:** `feat(fiscal): admin FiscalConfigModel + FiscalEvent + FiscalDocumentItem`

**Arquivo modificado:** `apps/fiscal/admin.py`

- `FiscalConfigModelAdmin`: `seq_*` como `readonly_fields` (nunca editar manualmente)
- `FiscalEventAdmin`: readonly total + `has_add_permission = False` (log imutável)
- `FiscalDocumentItemInline` como `TabularInline` em `FiscalDocumentAdmin`

**Testes:** Nenhum novo — validação por `manage.py check`

---

### Tarefa 12 — Fixtures de teste + conftest
**Commit:** `test(fiscal): fixtures JSON Focus + conftest.py`

**Arquivos criados** em `apps/fiscal/tests/fixtures/`:
- `focus_nfse_processando.json` — `{"status": "processando_autorizacao"}`
- `focus_nfse_autorizado.json` — `{"status": "autorizado", "numero": "42", "codigo_verificacao": "ABCD1234", ...}`
- `focus_nfe_autorizado.json` — `{"status": "autorizado", "chave_nfe": "35260412345678000195550010000000011234567890", ...}`
- `focus_erro_422.json` — `{"codigo": "requisicao_invalida", "mensagem": "Campo obrigatório ausente"}`
- `focus_webhook_nfse_autorizado.json` — `{"ref": "12345678-NFSE-20260423-000001", "evento": "autorizado", ...}`

**`apps/fiscal/tests/conftest.py`** com fixtures `fiscal_config` e `fiscal_document` para reutilização.

**Testes:** `test_fixtures.py` — 1 teste (valida que todos os JSONs são válidos)

---

### Tarefa 13 — Verificação final e type check
**Commit:** `chore(fiscal): type check limpo + testes completos 06B`

- `mypy apps/fiscal/ --ignore-missing-imports` → 0 errors
- `pytest apps/fiscal/tests/ -v` → ≥ 25 testes passando
- Verificar que nenhum teste existente fora de `apps/fiscal/` quebrou

---

## 3. Dependências entre tarefas

```
Tarefa 1 (rename + estrutura)  ← BLOQUEANTE
    ├─► Tarefa 2 (settings)
    ├─► Tarefa 3 (exceptions)
    │       └─► Tarefa 4 (FocusNFeClient)
    ├─► Tarefa 5 (models)
    │       ├─► Tarefa 6 (ref_generator)
    │       └─► Tarefa 7 (FiscalService skeleton)
    │               └─► Tarefa 8 (poll_fiscal_document)
    │                       └─► Tarefa 9 (WebhookView)
    │                               └─► Tarefa 10 (management command)
    ├─► Tarefa 11 (admin)
    └─► Tarefa 12 (fixtures + conftest)
Tarefa 13 (type check) ← depende de tudo
```

**Paralelo possível após T1:** T2 + T3 são independentes. T11 + T12 podem ser feitas em paralelo com T6–T10.

---

## 4. Riscos e mitigações

| # | Risco | Prob | Impacto | Mitigação |
|---|-------|------|---------|-----------|
| R1 | Conflito de nome `FiscalConfig` (AppConfig vs Model) | **Alta** | Alto | Tarefa 1 é bloqueante — resolver antes de qualquer outra |
| R2 | Migration 0003 alterando dados existentes | Baixa | **Alto** | Apenas `CREATE TABLE` — validar com `sqlmigrate fiscal 0003` |
| R3 | Import circular `tasks.py` ↔ `services/fiscal_service.py` | Média | Médio | Imports lazy (dentro da função) em `tasks.py` para `FiscalService` |
| R4 | `FiscalDocument.status` legado (`pending`) vs spec (`PROCESSING`) | Média | Baixo | `_apply_status` funciona com strings livres; unificação fica para 06C |
| R5 | Guard `ImproperlyConfigured` quebrando startup dos testes | Média | Médio | `config/settings/test.py` sempre faz override: `FOCUS_NFE_AMBIENTE = "homologacao"` |
| R6 | Chamadas HTTP reais escapando de `respx.mock` | Baixa | Médio | Usar `respx.mock(assert_all_mocked=True)` em todos os testes do client |

---

## 5. Critérios de fechamento do Ciclo 06B

### Qualidade de código
- [ ] `python manage.py check` → 0 issues
- [ ] `mypy apps/fiscal/ --ignore-missing-imports` → 0 errors
- [ ] `black --check apps/fiscal/` → 0 arquivos com formatação errada
- [ ] `isort --check-only apps/fiscal/` → 0 arquivos fora de ordem

### Testes
- [ ] `pytest apps/fiscal/tests/ -v` → ≥ 25 testes, 0 failures
- [ ] Nenhum teste do restante da suíte quebrado
- [ ] Cobertura `apps/fiscal/clients/` e `apps/fiscal/services/` ≥ 80%
- [ ] Zero chamadas HTTP reais (`respx.mock(assert_all_mocked=True)`)

### Migrations
- [ ] `python manage.py migrate_schemas` sem erros
- [ ] Rollback `migrate fiscal 0002` funciona
- [ ] `sqlmigrate fiscal 0003` mostra apenas `CREATE TABLE`
- [ ] `makemigrations --check` retorna 0 pendências

### Funcionalidade
- [ ] `from apps.fiscal.clients.focus_nfe_client import FocusNFeClient` importa sem erro
- [ ] `from apps.fiscal.exceptions import FocusNFeError` importa sem erro
- [ ] `from apps.fiscal.services.ref_generator import next_fiscal_ref` importa sem erro
- [ ] `from apps.fiscal.tasks import poll_fiscal_document` importa sem erro
- [ ] `NFeEntradaViewSet` retorna 200 em `GET /api/v1/fiscal/nfe-entrada/` (regressão)
- [ ] `POST /api/v1/fiscal/webhooks/focus/wrong-secret/` retorna 403
- [ ] `.env.example` contém as 5 variáveis `FOCUS_NFE_*`

### Entregáveis completos
- [ ] `apps/fiscal/clients/focus_nfe_client.py`
- [ ] `apps/fiscal/exceptions.py`
- [ ] `apps/fiscal/services/ref_generator.py`
- [ ] `apps/fiscal/services/fiscal_service.py` (skeleton + `_raise_for_http` funcional)
- [ ] `apps/fiscal/tasks.py` (`poll_fiscal_document`)
- [ ] `apps/fiscal/views.py` expandido (`FocusWebhookView`)
- [ ] `apps/fiscal/management/commands/register_focus_webhook.py`
- [ ] `apps/fiscal/migrations/0003_fiscal_config_item_event.py`
- [ ] `apps/fiscal/tests/` com ≥ 5 arquivos de teste + fixtures JSON
- [ ] `config/settings/base.py` com `FOCUS_NFE_*`
- [ ] `.env.example` atualizado

---

## 6. Contagem de testes por tarefa

| Tarefa | Arquivo | Testes |
|--------|---------|--------|
| T2 | `test_settings_guard.py` | 2 |
| T3 | `test_exceptions.py` | 3 |
| T4 | `test_client.py` | 7 |
| T5 | `test_models.py` | 5 |
| T6 | `test_ref_generator.py` | 6 |
| T7 | `test_fiscal_service_skeleton.py` | 10 |
| T8 | `test_tasks.py` | 6 |
| T9 | `test_webhook.py` | 6 |
| T10 | `test_management_commands.py` | 2 |
| T12 | `test_fixtures.py` | 1 |
| **Total** | | **48 testes** |

Meta do ciclo: ≥ 25. Estimativa: 48.

---

## 7. Estrutura de arquivos ao final do 06B

```
apps/fiscal/
├── __init__.py
├── apps.py                      # FiscalAppConfig (renomeado)
├── models.py                    # FiscalDocument+NFeEntrada (MO-1/MO-5)
│                                # + FiscalConfigModel, FiscalDocumentItem, FiscalEvent (06B)
├── exceptions.py                # FocusNFeError + 8 filhos (NOVO)
├── admin.py                     # expandido
├── serializers.py               # inalterado (MO-5)
├── views.py                     # NFeEntradaViewSet + FocusWebhookView (NOVO)
├── urls.py                      # nfe-entrada/ + webhooks/focus/<secret>/ (NOVO)
├── tasks.py                     # poll_fiscal_document (NOVO)
├── clients/
│   ├── __init__.py
│   └── focus_nfe_client.py      # FocusNFeClient + FocusResponse (NOVO)
├── services/
│   ├── __init__.py
│   ├── ingestao.py              # inalterado (MO-5)
│   ├── ref_generator.py         # next_fiscal_ref() (NOVO)
│   └── fiscal_service.py        # FiscalService skeleton (NOVO)
├── management/
│   ├── __init__.py
│   └── commands/
│       ├── __init__.py
│       └── register_focus_webhook.py  # NOVO
├── migrations/
│   ├── 0001_initial.py
│   ├── 0002_nfeentrada_...py
│   └── 0003_fiscal_config_item_event.py  # NOVO (06B)
└── tests/
    ├── __init__.py
    ├── conftest.py
    ├── fixtures/
    │   ├── focus_nfse_processando.json
    │   ├── focus_nfse_autorizado.json
    │   ├── focus_nfe_autorizado.json
    │   ├── focus_erro_422.json
    │   └── focus_webhook_nfse_autorizado.json
    ├── test_settings_guard.py
    ├── test_exceptions.py
    ├── test_client.py
    ├── test_models.py
    ├── test_ref_generator.py
    ├── test_fiscal_service_skeleton.py
    ├── test_tasks.py
    ├── test_webhook.py
    ├── test_management_commands.py
    └── test_fixtures.py
```
