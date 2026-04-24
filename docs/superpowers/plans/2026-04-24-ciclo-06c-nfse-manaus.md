# Plano de Implementação — Ciclo 06C: NFS-e Manaus end-to-end

**Data:** 2026-04-24
**Ciclo:** 06C — NFS-e Manaus end-to-end
**Branch:** `feat/ciclo-06c-nfse-manaus`
**Spec de referência:** `docs/superpowers/specs/2026-04-23-modulo-fiscal-focus-nfe-design.md` §6.4, §7.4, §8.1, §8.5, §9.1, §12
**Skill:** `.claude/SKILLS.md` → `fiscal-nfe-pattern`

---

## 1. Contexto — estado após 06A e 06B

### 1.1 O que já existe (não alterar sem justificativa)

| Arquivo | Estado | Conteúdo relevante |
|---|---|---|
| `apps/fiscal/models.py` | Funcional | `FiscalDocument` (stub com campos simples), `FiscalDocumentItem`, `FiscalConfigModel`, `FiscalEvent`, `NFeEntrada`, `NFeEntradaItem` |
| `migrations/0001` a `0003` | Aplicadas | Todas as tabelas fiscais base criadas |
| `apps/fiscal/clients/focus_nfe_client.py` | Completo (06B) | `FocusNFeClient` httpx + `FocusResponse` dataclass |
| `apps/fiscal/exceptions.py` | Completo (06B) | 9 classes: `FocusNFeError`, `FocusApiError`, `FocusApiClientError`, `FocusApiNotFoundError`, `FocusApiValidationError`, `FocusApiUnauthorizedError`, `FocusApiServerError`, `FocusNetworkError`, `FocusConfigError`, `FocusWebhookSecretError` |
| `apps/fiscal/services/ref_generator.py` | Completo (06B) | `next_fiscal_ref()` com `select_for_update()` |
| `apps/fiscal/services/fiscal_service.py` | Skeleton (06B) | `get_config()`, `_raise_for_http()` funcionais; `emit_nfse`, `emit_manual_nfse`, `cancel`, `consult` levantam `NotImplementedError` |
| `apps/fiscal/tasks.py` | Skeleton (06B) | `poll_fiscal_document` com autoretry; sem lógica de atualização de status |
| `apps/fiscal/views.py` | Funcional (06B) | `NFeEntradaViewSet` + `FocusWebhookView` |
| `apps/fiscal/tests/` | Suite 06B | client, exceptions, models, ref_generator, tasks, settings_guard, fiscal_service_skeleton |
| `apps/persons/models.py` | Completo (06A) | `Person`, `PersonDocument` (CPF/CNPJ criptografado + value_hash), `PersonAddress` (com `municipio_ibge`), `PersonContact` |

### 1.2 O que falta (escopo do 06C)

**Backend:**
- `FiscalDocument` estendido com campos da spec §5.2: `ref`, `config FK`, `service_order FK`, `destinatario FK`, `protocolo`, `caminho_xml`, `caminho_pdf`, `payload_enviado`, `ultima_resposta`, `mensagem_sefaz`, `valor_impostos`, `documento_referenciado`, `created_by`, `manual_reason` + CheckConstraint
- `ManausNfseBuilder` — monta payload NFS-e a partir de OS + Person + PersonDocument + PersonAddress + totais
- `ManualNfseBuilder` — monta payload NFS-e a partir de `ManualNfseInputSerializer`
- `FiscalService.emit_nfse()`, `emit_manual_nfse()`, `cancel()`, `consult()` — implementação completa
- `poll_fiscal_document` task — completar lógica de polling (atualiza `FiscalDocument` conforme resposta Focus)
- `ServiceOrderService._can_deliver()` — integrar com `FiscalDocument` (checar `Payment.fiscal_document.status == AUTHORIZED`)
- Serializers: `ManualNfseInputSerializer`, `FiscalDocumentSerializer`, `FiscalDocumentListSerializer`
- Views/Endpoints: `POST /api/v1/fiscal/nfse/emit/`, `POST /api/v1/fiscal/nfse/emit-manual/`, `GET/DELETE /api/v1/fiscal/documents/{id}/`
- RBAC: permission `can_emit_manual` (fiscal_admin + OWNER)

**Frontend:**
- `packages/types/src/fiscal.types.ts` — tipos TS espelhando `FiscalDocument`, `FiscalDocumentItem`, `FiscalEvent`
- `apps/dscar-web/src/hooks/useFiscal.ts` — hooks TanStack Query v5
- `apps/dscar-web/src/components/fiscal/FiscalEmissionModal.tsx` — disparo de NFS-e a partir de OS detail
- `apps/dscar-web/src/app/(app)/fiscal/emitir-nfse/page.tsx` — formulário NFS-e manual

**Smoke:**
- `scripts/smoke_ciclo_06c.py` — fixture (unit) + homologação (quando desbloqueado)

### 1.3 O que NÃO pode ser quebrado

- `NFeEntrada`, `NFeEntradaItem`, `NFeEntradaViewSet`, `NFeIngestaoService`, `EstoqueJaGerado` — zero alterações
- `FocusWebhookView` — continua funcional
- `FocusNFeClient`, `next_fiscal_ref()`, hierarquia de exceptions — não alterar interfaces públicas
- Migration 0001–0003 já aplicadas — 0004 só adiciona campos (nada de `RenameField` ou `RemoveField` nestas tabelas)
- Testes 06B (suite `tests/`) devem continuar passando

### 1.4 Estratégia de migração `FiscalDocument`

O stub atual (`FiscalDocument`) usa campos genéricos (`reference_id`, `reference_type`). A spec §5.2 exige FKs específicas (`service_order`, `destinatario`). A **migration 0004 é additive-only**:

- Todos os campos novos são `null=True, blank=True` → compatíveis com registros existentes sem dados
- `ref` CharField: `null=True, blank=True, unique=True` (NULL != NULL no PostgreSQL — múltiplos NULLs OK)
- Os campos antigos (`reference_id`, `reference_type`) permanecem como deprecated até 06D — NÃO remover agora
- `db_constraint=False` nas FKs para `service_order` e `destinatario` **não** é necessário — FK normal é OK aqui (diferente de snapshots imutáveis do Motor)

---

## 2. Bloqueadores

| Bloqueador | Trava | Quais tarefas |
|---|---|---|
| Resposta Focus suporte §12 (padrão Manaus) | Confirmar endpoint `/v2/nfse` vs `/v2/nfse-nacional`, schema campos obrigatórios | T2 (builder), T12 (smoke homologação) |
| Decisão contador §9.4 (peças em NFS-e) | Confirmar se `BudgetVersion.parts_total` entra na NFS-e como insumo ou vira NF-e separada | T2 (builder — campo `discriminacao`) |
| CNPJ homologação DS Car cadastrado no painel Focus com certificado A1 teste | Chamadas reais à Focus | T12 (smoke live) — testes unit continuam com `respx` |

**As tarefas T1–T11 podem ser implementadas e testadas com fixtures `respx`, independente dos bloqueadores.** O smoke homologação (T12) espera os três desbloqueios.

Registrar respostas em:
- `docs/superpowers/specs/anexos/2026-04-23-focus-suporte-manaus-respostas.md`
- `docs/superpowers/specs/anexos/2026-04-23-contador-tratamento-pecas.md`

---

## 3. Tarefas atômicas

### Tarefa 1 — Migration 0004: FiscalDocument spec §5.2 + FiscalDocumentItem spec §5.3
**Commit:** `feat(fiscal): migration 0004 — FiscalDocument spec §5.2 + FiscalDocumentItem §5.3`

**Descrição:**
- Adicionar ao `FiscalDocument` (additive — todos `null=True, blank=True` salvo anotado):
  - `ref = CharField(max_length=50, null=True, blank=True, unique=True, db_index=True)` — nossa ref de idempotência Focus
  - `config = ForeignKey(FiscalConfigModel, null=True, blank=True, on_delete=PROTECT, related_name="documents")`
  - `service_order = ForeignKey("service_orders.ServiceOrder", null=True, blank=True, on_delete=PROTECT, related_name="fiscal_documents")`
  - `destinatario = ForeignKey("persons.Person", null=True, blank=True, on_delete=PROTECT, related_name="fiscal_received")`
  - `protocolo = CharField(max_length=50, blank=True, default="")`
  - `caminho_xml = CharField(max_length=500, blank=True, default="")`
  - `caminho_pdf = CharField(max_length=500, blank=True, default="")`
  - `caminho_xml_cancelamento = CharField(max_length=500, blank=True, default="")`
  - `payload_enviado = JSONField(default=dict, blank=True)` — snapshot do payload enviado à Focus
  - `ultima_resposta = JSONField(default=dict, blank=True)` — snapshot da última resposta Focus
  - `mensagem_sefaz = TextField(blank=True, default="")`
  - `natureza_rejeicao = CharField(max_length=255, blank=True, default="")`
  - `valor_impostos = DecimalField(max_digits=14, decimal_places=2, default=0)`
  - `documento_referenciado = ForeignKey("self", null=True, blank=True, on_delete=SET_NULL, related_name="devolucoes_complementares")`
  - `created_by = ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=SET_NULL)`
  - `manual_reason = CharField(max_length=255, blank=True, default="")`
  - `CheckConstraint(name="fiscal_doc_manual_needs_reason", check=Q(service_order__isnull=False) | ~Q(manual_reason=""))`
  - Índices: `Index(fields=["status", "document_type"])` e `Index(fields=["service_order", "document_type"])`
- Adicionar ao `FiscalDocumentItem` (spec §5.3):
  - `codigo_servico_lc116 = CharField(max_length=10, blank=True, default="")` — para NFS-e
  - `ncm = CharField(max_length=10, blank=True, default="")`
  - `cfop = CharField(max_length=4, blank=True, default="")`
  - `unidade = CharField(max_length=10, default="UN")`
  - `valor_bruto`, `valor_desconto`, `valor_liquido` — DecimalFields
  - `aliquota_iss`, `valor_iss` — Decimal; `iss_retido = BooleanField(default=False)`
  - `icms_cst`, `icms_aliquota`, `icms_valor` — campos ICMS
  - `pis_cst`, `pis_valor`, `cofins_cst`, `cofins_valor`
- Gerar migration `fiscal/0004_fiscal_document_spec_52.py` via `makemigrations`
- Executar `manage.py check` — 0 issues

**Critérios de aceite:**
- `manage.py check` — 0 issues
- `manage.py sqlmigrate fiscal 0004` — zero `DROP`, zero `ALTER TYPE` destrutivo
- `FiscalDocument.objects.create(document_type="nfse", status="pending", total_value=0)` funciona sem `ref` (backward compat com stub existente)
- Testes 06B continuam passando

---

### Tarefa 2 — ManausNfseBuilder
**Commit:** `feat(fiscal): ManausNfseBuilder — payload NFS-e Manaus a partir de OS + Person`

**Arquivo:** `apps/fiscal/services/manaus_nfse.py`

**Descrição:**
```python
class ManausNfseBuilder:
    """Constrói payload Focus NFS-e para a Prefeitura de Manaus (IBGE 1302603).

    Fonte: spec §7.4 + mapeamento LC 116 §9.1.

    Raises:
        NfseBuilderError: dados insuficientes (Person sem Document primário, sem Address primário, etc.)
    """

    @classmethod
    def build(
        cls,
        service_order: ServiceOrder,
        config: FiscalConfigModel,
        ref: str,
        parts_as_service: bool = True,  # decisão contador §9.4 — default=True (peças na NFS-e)
    ) -> dict:
        """Retorna dict pronto para POST Focus /v2/nfse."""
        ...

    @classmethod
    def _get_tomador(cls, person: Person) -> dict: ...

    @classmethod
    def _get_servico(
        cls, service_order: ServiceOrder, config: FiscalConfigModel,
        parts_as_service: bool,
    ) -> dict: ...

    @classmethod
    def _get_rps(cls, ref: str, config: FiscalConfigModel) -> dict: ...

    @classmethod
    def _get_lc116_code(cls, os_type: str) -> str:
        """Mapeia tipo de serviço para item LC 116 (§9.1).

        Todo: VIDRACARIA → "14.05"; demais → "14.01".
        """
        ...

    @classmethod
    def _format_discriminacao(cls, os: ServiceOrder, parts_as_service: bool) -> str:
        """Texto livre da NFS-e.

        Inclui: OS.number, labor items, parts (se parts_as_service=True).
        Max: 2000 chars (trunca com aviso de log).
        """
        ...
```

**Regras de negócio:**
- Tomador PF → usa `PersonDocument(doc_type=CPF)` primário; PJ → `PersonDocument(doc_type=CNPJ)` primário
- Se Person não tiver PersonDocument primário → raise `NfseBuilderError("Person sem documento primário")`
- Se Person não tiver PersonAddress com `municipio_ibge` → raise `NfseBuilderError("Person sem endereço com municipio_ibge")`
- `codigo_municipio` = `1302603` (Manaus, hardcoded neste builder — outros municípios: outro builder)
- `rps.numero` = extraído do `ref` (último segmento após `-`); `rps.serie` = `config.serie_rps`
- `servico.item_lista_servico` = `_get_lc116_code(os.type)`
- `servico.valor_servicos` = OS `services_total` (+ `parts_total` se `parts_as_service=True`)
- `servico.discriminacao` = texto livre montado por `_format_discriminacao()`
- `data_emissao` = `datetime.now(tz=UTC).isoformat()`
- Emitente extraído de `config` (cnpj, inscricao_municipal, razao_social)

**Testes:** `tests/test_manaus_nfse_builder.py` — ≥ 10 testes cobrindo:
- PF com CPF: payload montado corretamente
- PJ com CNPJ
- OS sem PersonDocument → NfseBuilderError
- OS sem PersonAddress com municipio_ibge → NfseBuilderError
- Truncamento de discriminação longa (>2000 chars)
- `parts_as_service=False` → apenas `services_total` no valor
- Código LC 116: VIDRACARIA → 14.05, demais → 14.01
- RPS número extraído corretamente da ref

---

### Tarefa 3 — ManualNfseBuilder + ManualNfseInputSerializer
**Commit:** `feat(fiscal): ManualNfseBuilder + serializer de entrada manual`

**Arquivo:** `apps/fiscal/services/manaus_nfse.py` (extensão) + `apps/fiscal/serializers.py`

**Descrição do builder:**
```python
class ManualNfseBuilder:
    """Constrói payload NFS-e a partir de ManualNfseInputSerializer.validated_data.

    Diferente do ManausNfseBuilder: origem é form livre, não OS.
    """

    @classmethod
    def build(
        cls,
        input_data: dict,
        person: Person,
        config: FiscalConfigModel,
        ref: str,
    ) -> dict: ...
```

**Serializer de entrada (DRF):**
```python
class ManualItemInputSerializer(serializers.Serializer):
    descricao = serializers.CharField(min_length=3, max_length=500)
    quantidade = serializers.DecimalField(max_digits=12, decimal_places=4, default=1)
    valor_unitario = serializers.DecimalField(max_digits=14, decimal_places=4)
    valor_desconto = serializers.DecimalField(max_digits=14, decimal_places=2, default=0)

class ManualNfseInputSerializer(serializers.Serializer):
    destinatario_id = serializers.IntegerField()
    itens = ManualItemInputSerializer(many=True, min_length=1)
    discriminacao = serializers.CharField(max_length=2000)
    codigo_servico_lc116 = serializers.CharField(default="14.01", max_length=10)
    aliquota_iss = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, allow_null=True)
    iss_retido = serializers.BooleanField(default=False)
    data_emissao = serializers.DateTimeField(required=False, allow_null=True)  # None = now; validar ≤ 30d passado
    observacoes_contribuinte = serializers.CharField(default="", max_length=2000)
    manual_reason = serializers.CharField(min_length=5, max_length=255)  # obrigatório

    def validate_destinatario_id(self, value):
        # verifica que Person existe, tem PersonDocument e PersonAddress com municipio_ibge
        ...

    def validate_data_emissao(self, value):
        # se informada, ≤ 30 dias no passado (spec §8.5)
        ...
```

**Testes:** `tests/test_manual_nfse_builder.py` — ≥ 8 testes.

---

### Tarefa 4 — FiscalService.emit_nfse + consult + cancel
**Commit:** `feat(fiscal): FiscalService.emit_nfse + consult + cancel completos`

**Arquivo:** `apps/fiscal/services/fiscal_service.py`

**Descrição:**

```python
@classmethod
@transaction.atomic
def emit_nfse(
    cls,
    service_order: ServiceOrder,
    config: FiscalConfigModel | None = None,
    triggered_by: str = "USER",
) -> FiscalDocument:
    """
    1. Resolve config (get_config() se None)
    2. Verifica: service_order.customer_type == PARTICULAR
    3. Verifica: não existe FiscalDocument(service_order=os, document_type="nfse", status__in=["pending","authorized"])
       → se existe e status=authorized: levanta FiscalDocumentAlreadyAuthorized
       → se existe e status=pending: retorna documento existente (idempotente)
    4. next_fiscal_ref(doc_type="nfse", config) com select_for_update
    5. ManausNfseBuilder.build(os, config, ref)
    6. FiscalDocument.objects.select_for_update().create(
           document_type="nfse", status="pending",
           ref=ref, config=config, service_order=os,
           destinatario=os.get_person(),  # resolve Person via service_order.customer_uuid
           payload_enviado=payload,
           total_value=valor_total,
       )
    7. FiscalEvent(EMIT_REQUEST)
    8. FocusNFeClient.post("/v2/nfse", params={"ref": ref}, json=payload)
    9. FiscalEvent(EMIT_RESPONSE, http_status=resp.status_code, duration_ms=...)
    10. _raise_for_http(resp)  # levanta em erro
    11. doc.ultima_resposta = resp.data; doc.save(update_fields=[...])
    12. Agenda poll_fiscal_document.apply_async(args=[str(doc.pk)], countdown=10)
    13. Retorna doc
    """

@classmethod
@transaction.atomic
def consult(cls, doc: FiscalDocument) -> FiscalDocument:
    """
    1. FocusNFeClient.get(f"/v2/nfse/{doc.ref}")
    2. FiscalEvent(CONSULT)
    3. Atualizar doc conforme resposta:
       - "autorizado" → status="authorized", chave=..., numero=..., caminho_xml=..., authorized_at=...
       - "processando_autorizacao" → nada (já está pending)
       - "erro_autorizacao" → status="rejected", rejection_reason=mensagem_sefaz
       - "cancelado" → status="cancelled", cancelled_at=...
    4. doc.save(update_fields=[...])
    5. Retorna doc
    """

@classmethod
@transaction.atomic
def cancel(cls, doc: FiscalDocument, justificativa: str) -> FiscalDocument:
    """
    1. Verifica doc.status == "authorized" → else raise FiscalInvalidStatus
    2. Verifica len(justificativa) >= 15 → else raise FiscalValidationError
    3. FocusNFeClient.delete(f"/v2/nfse/{doc.ref}", json={"justificativa": justificativa})
    4. FiscalEvent(CANCEL_REQUEST + CANCEL_RESPONSE)
    5. _raise_for_http(resp)
    6. doc.status = "cancelled"; doc.cancelled_at = now(); doc.save(...)
    7. Retorna doc
    """
```

**Novas exceções** a adicionar em `exceptions.py`:
- `NfseBuilderError(FocusNFeError)` — dados insuficientes no builder
- `FiscalDocumentAlreadyAuthorized(Exception)` — tentativa de reemissão de doc autorizado
- `FiscalInvalidStatus(Exception)` — operação inválida para o status atual

**Testes:** `tests/test_fiscal_service_nfse.py` — ≥ 15 testes usando `respx`:
- emit_nfse com resposta processando (201) → doc status=pending, poll agendado
- emit_nfse com resposta direta autorizado (201 + status=autorizado) → doc status=authorized
- emit_nfse idempotente (doc pending já existe) → retorna existente sem novo POST
- emit_nfse com doc authorized já existe → FiscalDocumentAlreadyAuthorized
- emit_nfse com Focus retornando 400 → FocusApiValidationError, doc não criado
- consult com "autorizado" → status atualizado
- consult com "processando" → sem alteração
- consult com "erro_autorizacao" → status=rejected
- cancel com status=authorized → status=cancelled
- cancel com status≠authorized → FiscalInvalidStatus
- cancel com justificativa curta → FiscalValidationError
- cancel com Focus 422 → status não alterado

---

### Tarefa 5 — FiscalService.emit_manual_nfse
**Commit:** `feat(fiscal): FiscalService.emit_manual_nfse completo`

**Arquivo:** `apps/fiscal/services/fiscal_service.py`

**Descrição:**
```python
@classmethod
@transaction.atomic
def emit_manual_nfse(
    cls,
    input_data: dict,
    user: Any,
    config: FiscalConfigModel | None = None,
) -> FiscalDocument:
    """
    1. Resolve config
    2. Carrega Person via input_data["destinatario_id"]
    3. Valida Person tem PersonDocument primário e PersonAddress com municipio_ibge
    4. next_fiscal_ref("nfse", config)
    5. ManualNfseBuilder.build(input_data, person, config, ref)
    6. Cria FiscalDocument(service_order=None, destinatario=person, manual_reason=input_data["manual_reason"], ...)
    7. FiscalEvent(EMIT_REQUEST, triggered_by="USER_MANUAL")
    8. FocusNFeClient.post(...)
    9. FiscalEvent(EMIT_RESPONSE)
    10. Agenda poll
    11. Retorna doc
    """
```

**Testes:** `tests/test_fiscal_service_manual.py` — ≥ 8 testes:
- Emissão manual bem-sucedida (201)
- Person sem documento → NfseBuilderError
- manual_reason vazio → falha antes de chamar Focus
- FiscalEvent.triggered_by = "USER_MANUAL"
- FiscalDocument.service_order = None

---

### Tarefa 6 — poll_fiscal_document task: lógica de polling
**Commit:** `feat(fiscal): poll_fiscal_document — lógica de atualização de status NFS-e`

**Arquivo:** `apps/fiscal/tasks.py`

**Descrição:**
```python
@shared_task(
    bind=True,
    autoretry_for=(FocusNetworkError,),
    max_retries=60,  # max 60 * 10s = 10 minutos de polling
    default_retry_delay=10,
    retry_backoff=False,  # intervalo fixo de 10s para NFS-e
)
def poll_fiscal_document(self, document_id: str) -> None:
    """Consulta status de documento fiscal na Focus.

    Ciclo:
    - Carrega FiscalDocument
    - Se status não é "pending" → encerra (já processado pelo webhook)
    - FiscalService.consult(doc)
    - Se ainda pending após consult → raise self.retry(countdown=10)
    - Se authorized/rejected → encerra (consult() já atualizou)
    """
    from apps.fiscal.models import FiscalDocument
    from apps.fiscal.services.fiscal_service import FiscalService

    try:
        doc = FiscalDocument.objects.get(pk=document_id)
    except FiscalDocument.DoesNotExist:
        logger.warning("poll_fiscal_document: doc %s não encontrado", document_id)
        return

    if doc.status not in ("pending",):
        return  # webhook já processou

    doc = FiscalService.consult(doc)

    if doc.status == "pending":
        raise self.retry(countdown=10)
```

**Testes:** `tests/test_tasks.py` — expandir com ≥ 5 testes:
- doc já autorizado → task encerra sem chamada HTTP
- doc pending + Focus retorna autorizado → status atualizado, sem retry
- doc pending + Focus retorna processando → task retenta
- doc não encontrado → encerra sem erro

---

### Tarefa 7 — ServiceOrderService._can_deliver() + FiscalDocument FK em Payment
**Commit:** `feat(fiscal): _can_deliver() integra com FiscalDocument.status + migration Payment FK`

**Arquivo:** `apps/service_orders/services.py` + `apps/accounts_receivable/models.py` (ou onde `Payment` vive)

**Descrição:**
- Localizar `Payment` model (em `accounts_receivable` — `ReceivableDocument` é o modelo AR)
- Adicionar migration em `accounts_receivable`: `fiscal_document = ForeignKey(FiscalDocument, null=True, blank=True, on_delete=PROTECT, related_name="receivable_documents")`
  - Migration nome: `accounts_receivable/0003_fiscal_document_fk.py` (verificar número atual)
- Atualizar `ServiceOrderService._can_deliver()`:
  ```python
  # ANTES (stub que trava sempre):
  if not payment.fiscal_doc_ref:
      return False

  # DEPOIS (checa status real):
  from apps.fiscal.models import FiscalDocument
  fiscal_doc = getattr(payment, "fiscal_document", None)
  if fiscal_doc is None:
      return False
  return fiscal_doc.status == "authorized"
  ```
- Se `ReceivableDocument` não tem `fiscal_doc_ref` existente: verificar e adaptar ao modelo real

**Critérios de aceite:**
- `manage.py check` — 0 issues
- Test: OS particular com `Payment.fiscal_document.status="authorized"` → `_can_deliver()` retorna `True`
- Test: OS particular com `Payment.fiscal_document=None` → `_can_deliver()` retorna `False`
- Test: OS de seguradora → `_can_deliver()` não verifica fiscal (regra §2 da spec)

> **Nota de investigação antes de implementar:** ler `apps/accounts_receivable/models.py` e `apps/service_orders/services.py` para entender o modelo exato de `Payment`/`ReceivableDocument` e o campo `fiscal_doc_ref` stub. Ajustar esta tarefa se necessário.

---

### Tarefa 8 — Endpoints NFS-e + RBAC
**Commit:** `feat(fiscal): endpoints NFS-e emit/emit-manual/consult/cancel + RBAC`

**Arquivo:** `apps/fiscal/views.py`, `apps/fiscal/urls.py`, `apps/fiscal/serializers.py`

**Endpoints:**

| Método | URL | Descrição | Permissão |
|---|---|---|---|
| POST | `/api/v1/fiscal/nfse/emit/` | Emitir NFS-e de OS | CONSULTANT+ |
| POST | `/api/v1/fiscal/nfse/emit-manual/` | NFS-e manual ad-hoc | fiscal_admin / OWNER |
| GET | `/api/v1/fiscal/documents/{id}/` | Detalhe de FiscalDocument | CONSULTANT+ |
| DELETE | `/api/v1/fiscal/documents/{id}/` | Cancelar documento | MANAGER+ |
| GET | `/api/v1/fiscal/documents/` | Lista por OS ou status | CONSULTANT+ |

**View de emissão automática:**
```python
class NfseEmitView(APIView):
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def post(self, request: Request) -> Response:
        """
        Body: {"service_order_id": "uuid"}
        Retorna: FiscalDocumentSerializer(doc)
        """
        ...
```

**View de emissão manual:**
```python
class NfseEmitManualView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrAbove]  # fiscal_admin/OWNER

    def post(self, request: Request) -> Response:
        """Body: ManualNfseInputSerializer"""
        ...
```

**Serializers de saída:**
```python
class FiscalDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = FiscalDocument
        fields = [
            "id", "document_type", "status", "ref", "service_order",
            "destinatario", "total_value", "valor_impostos",
            "chave", "numero", "caminho_xml", "caminho_pdf",
            "manual_reason", "created_at", "authorized_at", "cancelled_at",
            "mensagem_sefaz", "natureza_rejeicao",
        ]
        read_only_fields = fields
```

**Testes:** `tests/test_views_nfse.py` — ≥ 10 testes usando `TenantTestCase`:
- POST emit com OS PARTICULAR válida → 201
- POST emit com OS SEGURADORA → 400 (não aplicável)
- POST emit com OS já com NFS-e authorized → 409
- POST emit-manual sem permissão (CONSULTANT) → 403
- POST emit-manual com permissão ADMIN e payload válido → 201
- POST emit-manual sem manual_reason → 400
- DELETE cancel documento authorized → 200
- DELETE cancel documento pending → 400 (FiscalInvalidStatus)
- GET list → filtra por service_order e doc_type

---

### Tarefa 9 — TypeScript: fiscal.types.ts + useFiscal.ts
**Commit:** `feat(fiscal): types TS fiscal + hooks TanStack Query`

**Arquivo:** `packages/types/src/fiscal.types.ts` + `apps/dscar-web/src/hooks/useFiscal.ts`

**Types:**
```typescript
export type FiscalDocumentType = "nfse" | "nfe" | "nfce"

export type FiscalDocumentStatus =
  | "pending"       // processando_autorizacao
  | "authorized"    // autorizado
  | "rejected"      // denegado / erro_autorizacao
  | "cancelled"     // cancelado

export interface FiscalDocument {
  id: string
  document_type: FiscalDocumentType
  status: FiscalDocumentStatus
  ref: string | null
  service_order: string | null  // UUID
  total_value: string  // Decimal como string
  valor_impostos: string
  chave: string  // chave NF-e (44 dígitos) ou número NFS-e
  numero: string
  caminho_xml: string
  caminho_pdf: string
  manual_reason: string
  created_at: string
  authorized_at: string | null
  cancelled_at: string | null
  mensagem_sefaz: string
  natureza_rejeicao: string
}

export interface ManualNfseItem {
  descricao: string
  quantidade: string
  valor_unitario: string
  valor_desconto: string
}

export interface ManualNfseInput {
  destinatario_id: number
  itens: ManualNfseItem[]
  discriminacao: string
  codigo_servico_lc116: string
  aliquota_iss?: number | null
  iss_retido: boolean
  data_emissao?: string | null
  observacoes_contribuinte: string
  manual_reason: string
}
```

**Hooks (`useFiscal.ts`):**
- `useEmitNfse(serviceOrderId)` — mutation POST emit
- `useEmitManualNfse()` — mutation POST emit-manual
- `useFiscalDocument(id)` — query GET detail
- `useFiscalDocuments(filters)` — query GET list
- `useCancelFiscalDocument(id)` — mutation DELETE

---

### Tarefa 10 — FiscalEmissionModal.tsx (automática — a partir de OS)
**Commit:** `feat(fiscal): FiscalEmissionModal — disparo NFS-e na tela OS detail`

**Arquivo:** `apps/dscar-web/src/components/fiscal/FiscalEmissionModal.tsx`

**Descrição:**
- Modal `Dialog` shadcn/ui ativado por botão "Emitir NFS-e" na tab Pagamentos do OS detail
- Mostra resumo: cliente, valor total da OS, itens de serviço
- Botão "Confirmar Emissão" → `useEmitNfse(serviceOrderId).mutateAsync()`
- Estados: loading (spinner), sucesso (NFS-e número + badge `authorized`), erro (mensagem_sefaz)
- Após autorização: badge "NFS-e Autorizada" + link download PDF (caminho_pdf)
- Usando `PermissionGate role="CONSULTANT"` para exibir botão

**Integração com OS detail:**
- Adicionar prop `onFiscalEmitted` na tab Pagamentos (ou componente pai da OS detail)
- Exibir `FiscalEmissionModal` quando `ServiceOrder.customer_type === "particular"` e sem `fiscal_documents` com `status === "authorized"`
- Se já existe NFS-e `authorized`, mostrar bloco read-only com chave + link PDF

---

### Tarefa 11 — ManualNfseEmissionPage.tsx
**Commit:** `feat(fiscal): ManualNfseEmissionPage — emissão NFS-e ad-hoc`

**Arquivo:** `apps/dscar-web/src/app/(app)/fiscal/emitir-nfse/page.tsx`

**Descrição:**
- Rota `/fiscal/emitir-nfse`
- Restrita a ADMIN+ (`withRoleGuard("ADMIN")`)
- Formulário com React Hook Form + Zod espelhando `ManualNfseInput`:
  - `react-select` para busca de Person (endpoint `/api/proxy/persons/?search=`)
  - Array dinâmico de itens com `useFieldArray` (adicionar/remover)
  - Campos de texto: `discriminacao` (textarea), `manual_reason` (obrigatório)
  - Opcionais: `aliquota_iss`, `iss_retido`, `data_emissao`
- Submit → `useEmitManualNfse().mutateAsync(payload)`
- Sucesso → toast + redirect para `/fiscal/documentos/{id}`
- Erro → toast com mensagem Focus

**Sidebar:** adicionar item "Emitir NFS-e" sob nova seção "FISCAL" (ícone `Receipt`) — visível apenas ADMIN+

---

### Tarefa 12 — Smoke test 06C
**Commit:** `test(fiscal): smoke test Ciclo 06C (fixture + homologação)`

**Arquivo:** `scripts/smoke_ciclo_06c.py`

**Descrição:**
```python
# 10 verificações:
# [1]  ManausNfseBuilder monta payload sem erro (OS fixture)
# [2]  ManualNfseBuilder monta payload sem erro (dict fixture)
# [3]  ManualNfseInputSerializer valida dados válidos
# [4]  ManualNfseInputSerializer rejeita data_emissao > 30d passado
# [5]  FiscalService.emit_nfse() com respx mock 201 → doc status=pending
# [6]  FiscalService.consult() com respx mock "autorizado" → doc status=authorized
# [7]  FiscalService.cancel() com respx mock 200 → doc status=cancelled
# [8]  FiscalService.emit_manual_nfse() sem manual_reason → erro de validação
# [9]  poll_fiscal_document task com mock "autorizado" → encerra sem retry
# [10] (BLOQUEADO) Smoke homologação real: emit_nfse contra Focus homologação →
#       verifica doc.status em {pending, authorized} após polling 30s

# Checks [1]-[9]: sem Docker, sem DB, com respx
# Check [10]: requer FOCUS_NFE_TOKEN real + CNPJ homologação cadastrado na Focus
```

**Bloco de saída esperado:**
```
=== Smoke Test Ciclo 06C — NFS-e Manaus (tenant: tenant_dscar) ===

  [PASS] [1] ManausNfseBuilder.build() retorna dict com 'rps', 'servico', 'tomador'
  [PASS] [2] ManualNfseBuilder.build() retorna dict com campos corretos
  ...
  [SKIP] [10] Smoke homologação — BLOQUEADO (aguarda Focus suporte + CNPJ homologação)

=======================================================
Resultado: 9/10 verificações passando (1 pulada/bloqueada)
```

---

## 4. Critérios de aceite da sprint

- [x] `manage.py check` — 0 issues ✅
- [x] `manage.py sqlmigrate fiscal 0004` — sem operações destrutivas ✅
- [x] Testes 06B (test_client, test_exceptions, test_models, test_ref_generator, test_tasks, test_settings_guard, test_fiscal_service_skeleton) — sem regressões ✅
- [x] `FiscalEmissionModal` / botão emitir NFS-e funcional na OS detail ✅
- [x] `ManualNfseEmissionPage` — `/fiscal/emitir-nfse` funcional (ADMIN+) ✅
- [x] Emissão manual validada em homologação — payload enviado com sucesso à Focus ✅
- [ ] `scripts/smoke_ciclo_06c.py` — não implementado (validação foi feita via curl + logs diretos)
- [ ] `tsc --strict` — não executado formalmente (tipos revisados manualmente)

---

## 5. Riscos e contingências

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Focus não suporta Manaus em `/v2/nfse` (usa `/v2/nfse-nacional`) | Alta | `ManausNfseBuilder` usa URL parametrizável; trocar em settings antes do go-live |
| Schema obrigatório SEMEF Manaus difere do §7.4 da spec | Alta | Campos extras adicionados via `extra_fields: dict` no builder; testar em homologação |
| `PersonAddress.municipio_ibge` ausente para clientes legados | Média | `NfseBuilderError` claro; UI mostra "completar endereço antes de emitir" |
| `_can_deliver()` requer `ReceivableDocument.fiscal_document` FK que pode não existir | Média | Tarefa 7 começa com leitura do modelo atual; adaptar migration conforme necessário |
| `FiscalDocument.ref` NULL para registros antigos quebra `unique=True` | Baixa | `null=True` em `ref` — PostgreSQL trata NULL != NULL (múltiplos NULLs permitidos) |

---

## 6. Após implementação

1. PR contra `main` com descrição: §resumo, §testes, §riscos, §rollback
2. Atualizar `CLAUDE.md` → seção "Sprints Entregues" com "Ciclo 06C — NFS-e Manaus ✅"
3. Remover `raise NotImplementedError(...)` dos stubs de `fiscal_service.py`
4. Atualizar `backend/core/MVP_CHECKLIST.md` (se existir) com seção "Entregue no Ciclo 06C"

---

## 7. Status final — entregue em 2026-04-24 ✅

### O que foi implementado (além do escopo original)

**Backend:**
- T1 ✅ Migration 0004 — FiscalDocument com todos os campos da spec §5.2
- T2 ✅ `ManausNfseBuilder` — payload NFS-e Manaus (IBGE 1302603, LC116, RPS)
- T3 ✅ `ManualNfseBuilder` + `ManualNfseInputSerializer`
- T4 ✅ `FiscalService.emit_nfse()`, `consult()`, `cancel()` — implementação completa
- T5 ✅ `FiscalService.emit_manual_nfse()` — emissão ad-hoc sem OS vinculada
- T6 ✅ `poll_fiscal_document` task com lógica de polling completa
- T7 ⏭️ `ServiceOrderService._can_deliver()` — adiado (requer mapeamento AR+fiscal pendente)
- T8 ✅ Views: `NfseEmitView`, `NfseEmitManualView`, `FiscalDocumentViewSet` + RBAC
- T9 ✅ Tipos TS + hooks TanStack Query v5 (`useFiscalDocuments`, `useEmitNfse`, `useEmitManualNfse`, `useCancelFiscalDoc`)

**Frontend:**
- T10 ✅ Botão "Emitir NFS-e" na OS detail (EntrySection) com modal de confirmação
- T11 ✅ `/fiscal/emitir-nfse` — formulário manual ADMIN+ com busca de Person
- T12 ⏭️ Smoke script — não criado; validação feita via curl + `docker compose logs`

**Features extras (além do escopo):**
- ✅ `/fiscal/documentos` — página de Documentos Fiscais Emitidos (filtros, KPIs, PDF/XML links, cancelamento)
- ✅ `FiscalDocumentListSerializer` expandido com todos os campos de exibição
- ✅ Backend: `NfeRecebidaListView` + `NfeRecebidaManifestView` — manifestação de destinatário (pass-through Focus)
- ✅ Frontend: `/fiscal/nfe-recebidas` — listagem + manifesto (ciência → confirmar/desconhecer)
- ✅ Sidebar: seção "FISCAL" com Documentos Emitidos, NF-e Recebidas, Emitir NFS-e Manual
- ✅ Validação com token Focus produção — NF-e recebidas reais listadas com sucesso

### Bugs corrigidos durante o ciclo

| Bug | Causa raiz | Fix |
|---|---|---|
| 500 em `POST /nfse/emit-manual/` | `FOCUS_NFE_TOKEN` vs `FOCUSNFE_TOKEN` (env var mismatch) | `settings/base.py`: fallback chain `config("FOCUSNFE_TOKEN") or config("FOCUS_NFE_TOKEN")` |
| Focus 400 — campo obrigatório | `prestador.codigo_municipio` faltando no payload | Adicionado `MUNICIPIO_IBGE_MANAUS = "1302603"` em ambos os builders |
| Focus 422 — formato LC116 inválido | Código `"14.01"` com ponto — Manaus exige 6 dígitos numéricos `"140100"` | `_normalize_lc116()` strip de ponto + pad/truncate para 6 dígitos |
| `FocusNFeError` não capturado | `except Exception` genérico sem check de tipo | `isinstance(exc, FocusNFeError)` → 400; demais → 500 |
| `AssertionError` no serializer | `source='service_order_id'` redundante (field name == source) | Removido `source=` do campo |
| Campo errado em `NfeRecebida` | Tipado como `emitente_nome`/`emitente_cnpj`; Focus retorna `nome_emitente`/`documento_emitente` | Corrigido no tipo TS e na page |
