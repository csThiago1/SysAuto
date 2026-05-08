# OS Transition Validation — Design Spec

> Validação de pré-requisitos de negócio nas transições de status da OS.
> Aprovado em: 2026-05-08

---

## Problema

Hoje a transição de status da OS valida **apenas** se a transição está no mapa `VALID_TRANSITIONS`. Não existe validação de pré-requisitos de negócio. Um consultor pode avançar uma OS de "Vistoria Inicial" para "Orçamento" sem nenhuma foto, ou entregar um veículo sem NFC-e.

## Solução

Sistema de validação em 3 níveis integrado ao `ServiceOrderService.transition()`, com mecanismo de override por MANAGER+ (presencial ou assíncrono via notificação).

---

## Arquitetura

### Abordagem: Validação centralizada no Service Layer

- `TransitionValidator` — classe de serviço pura (sem model), consulta dados da OS e retorna `ValidationResult`
- Chamado pelo `ServiceOrderService.transition()` antes de executar a transição
- Resultado pré-carregado no `ServiceOrderDetailSerializer` no campo `transition_requirements`
- Kanban usa campo leve `has_blocks: bool` via annotação no queryset

### Fluxo de decisão

```
1. Valida VALID_TRANSITIONS (como hoje)
2. TransitionValidator.validate(order, target_status, user_role)
3. Se hard_blocks → 422 sempre (sem override possível)
4. Se soft_blocks:
   a. Se role >= MANAGER + force=true + justificativa → executa + loga override
   b. Se role >= MANAGER + credenciais presenciais → executa + loga override
   c. Senão → 422 com can_override=true
5. Se só warnings → 200 com warnings[] no response
```

---

## Modelo de Dados

### ValidationResult (dataclass, sem persistência)

```python
@dataclass
class ValidationBlock:
    code: str       # ex: "PHOTOS_MIN_12"
    message: str    # ex: "Faltam 4 fotos de vistoria (8/12)"

@dataclass
class ValidationResult:
    can_proceed: bool
    hard_blocks: list[ValidationBlock]
    soft_blocks: list[ValidationBlock]
    warnings: list[ValidationBlock]
    has_pending_override: bool
```

### TransitionOverrideRequest (novo model)

```python
class TransitionOverrideRequest(PaddockBaseModel):
    class Status(models.TextChoices):
        PENDING  = "pending",  "Pendente"
        APPROVED = "approved", "Aprovado"
        REJECTED = "rejected", "Rejeitado"
        EXPIRED  = "expired",  "Expirado"

    service_order = FK(ServiceOrder, related_name="override_requests")
    from_status = CharField(max_length=20)
    to_status = CharField(max_length=20)
    requested_by = FK(GlobalUser, related_name="override_requests_made")
    approved_by = FK(GlobalUser, null=True, related_name="override_requests_resolved")
    status = CharField(choices=Status, default="pending")
    blocks_snapshot = JSONField(default=list)  # soft_blocks no momento
    request_reason = TextField()  # consultor preenche ao solicitar
    justification = TextField(blank=True)  # gerente preenche ao resolver
    resolved_at = DateTimeField(null=True)
    expires_at = DateTimeField()  # created_at + 24h

    class Meta:
        indexes = [
            Index(fields=["service_order", "status"]),
            Index(fields=["status", "expires_at"]),
        ]
```

### ServiceOrderEvent — novos event types

- `OVERRIDE_REQUESTED` — consultor solicitou liberação
- `OVERRIDE_APPROVED` — gerente aprovou (presencial ou remoto)
- `OVERRIDE_REJECTED` — gerente rejeitou

---

## Regras de Validação por Transição

### `reception` → `initial_survey`

| Código | Nível | Regra |
|--------|:-----:|-------|
| `VEHICLE_BASIC_DATA` | HARD | `plate`, `make`, `model` preenchidos |
| `CUSTOMER_TYPE_SET` | HARD | `customer_type` definido |
| `CUSTOMER_LINKED` | HARD | `customer_id` ou `customer_uuid` vinculado |
| `INSURER_DATA` | HARD | Se seguradora: `insurer` + `insured_type` preenchidos |
| `VEHICLE_YEAR` | WARN | `year` não preenchido |
| `VEHICLE_COLOR` | WARN | `color` não preenchido |
| `FUEL_TYPE` | WARN | `fuel_type` não preenchido |
| `MILEAGE_IN` | WARN | `mileage_in` não preenchido |

### `initial_survey` → `budget` ou `waiting_auth`

| Código | Nível | Regra |
|--------|:-----:|-------|
| `PHOTOS_MIN_12` | SOFT | Mínimo 12 fotos em `vistoria_inicial` OU `checklist_entrada` |
| `ENTRY_DATE_SET` | WARN | `entry_date` não preenchido |

### `budget` → `waiting_auth`

| Código | Nível | Regra |
|--------|:-----:|-------|
| `BUDGET_PDF_INSURER` | HARD | Se seguradora: ≥1 arquivo na pasta `orcamentos` |
| `BUDGET_ITEMS_PRIVATE` | HARD | Se particular: ≥1 peça ou ≥1 serviço cadastrado |
| `CASUALTY_NUMBER` | WARN | Se seguradora: `casualty_number` vazio |

### `waiting_auth` → `authorized`

| Código | Nível | Regra |
|--------|:-----:|-------|
| `AUTH_DATE_SET` | HARD | `authorization_date` preenchida |
| `VERSION_AUTHORIZED` | HARD | Se seguradora: ≥1 `ServiceOrderVersion` com status `autorizado` |
| `DEDUCTIBLE_SET` | HARD | Se seguradora + `insured_type=insured`: `deductible_amount` preenchido |
| `CASUALTY_NUMBER_REQUIRED` | HARD | Se seguradora: `casualty_number` preenchido |
| `SIGNATURE_APPROVAL` | HARD | Se particular: assinatura tipo `BUDGET_APPROVAL` capturada |

### `authorized` → `waiting_parts`

| Código | Nível | Regra |
|--------|:-----:|-------|
| `PARTS_EXIST` | HARD | ≥1 peça cadastrada na OS |
| `PARTS_SOURCED` | SOFT | Peças de `compra` devem ter `pedido_compra` + status ≥ `comprada` |

### `authorized` → `repair`

| Código | Nível | Regra |
|--------|:-----:|-------|
| `PARTS_OR_LABOR_EXIST` | HARD | ≥1 peça ou ≥1 serviço cadastrado |
| `PARTS_PENDING` | WARN | Listar peças com status pendente (`aguardando_cotacao`, `em_cotacao`) |

### `waiting_parts` → `repair`

| Código | Nível | Regra |
|--------|:-----:|-------|
| `PARTS_PURCHASED` | SOFT | Peças de `compra` com `pedido_compra` + status ≥ `comprada` |
| `PARTS_INCOMPLETE` | WARN | Listar peças que não estão `recebida`/`bloqueada` |

### Transições entre setores de oficina

Aplica-se a: `repair` ↔ `mechanic` ↔ `bodywork` ↔ `painting` ↔ `assembly` ↔ `polishing` ↔ `washing`

| Código | Nível | Regra |
|--------|:-----:|-------|
| `TIMESHEET_CLOSED` | SOFT | Apontamento de horas no setor atual com status `encerrado` |
| `PROGRESS_PHOTO` | SOFT | ≥1 foto na pasta `acompanhamento` para o setor atual |

### `washing` → `final_survey`

| Código | Nível | Regra |
|--------|:-----:|-------|
| `TIMESHEET_CLOSED` | SOFT | Apontamento do setor atual encerrado |
| `PROGRESS_PHOTO` | SOFT | Foto de acompanhamento do setor |
| `ALL_PARTS_RECEIVED` | HARD | Todas as peças com status `recebida` ou `bloqueada` |
| `ALL_TIMESHEETS_CLOSED` | HARD | Todos os apontamentos de todos os setores `encerrado` |

### `final_survey` → `ready`

| Código | Nível | Regra |
|--------|:-----:|-------|
| `FINAL_PHOTOS_12` | SOFT | Mínimo 12 fotos na pasta `vistoria_final` |
| `EXIT_CHECKLIST` | SOFT | Checklist de saída preenchido |

### `ready` → `delivered`

| Código | Nível | Regra |
|--------|:-----:|-------|
| `NFCE_ISSUED` | HARD | Se particular: NFC-e emitida |
| `CLIENT_SIGNATURE` | HARD | Assinatura tipo `OS_DELIVERY` capturada |
| `MILEAGE_OUT` | HARD | `mileage_out` preenchido |
| `RECEIVABLE_CREATED` | HARD | Contas a receber geradas |
| `COMPLEMENT_BILLED` | HARD | Se complemento particular: todos com `billing_status=billed` |

### Qualquer → `cancelled`

| Código | Nível | Regra |
|--------|:-----:|-------|
| `CANCEL_JUSTIFICATION` | HARD | Justificativa obrigatória (texto) |

---

## TransitionValidator — Estrutura

```python
# backend/core/apps/service_orders/transition_validator.py

class TransitionValidator:
    """Valida pré-requisitos de negócio para transições de status da OS."""

    # Mapeamento status_destino → método de validação
    _VALIDATORS: dict[str, Callable] = {
        "initial_survey": "_validate_to_initial_survey",
        "budget":         "_validate_to_budget_or_waiting_auth",
        "waiting_auth":   "_validate_to_budget_or_waiting_auth",
        "authorized":     "_validate_to_authorized",
        "waiting_parts":  "_validate_to_waiting_parts",
        "repair":         "_validate_to_repair",
        "mechanic":       "_validate_workshop_transition",
        "bodywork":       "_validate_workshop_transition",
        "painting":       "_validate_workshop_transition",
        "assembly":       "_validate_workshop_transition",
        "polishing":      "_validate_workshop_transition",
        "washing":        "_validate_workshop_transition",
        "final_survey":   "_validate_to_final_survey",
        "ready":          "_validate_to_ready",
        "delivered":      "_validate_to_delivered",
        "cancelled":      "_validate_to_cancelled",
    }

    @classmethod
    def validate(cls, order, target_status, user_role=None) -> ValidationResult:
        """Entrada principal."""

    @classmethod
    def validate_all_targets(cls, order, user_role=None) -> dict[str, ValidationResult]:
        """Valida todos os targets permitidos — usado pelo serializer de detalhe."""

    # --- Métodos privados por transição ---
    @classmethod
    def _validate_to_initial_survey(cls, order) -> ValidationResult: ...

    # ... um método por grupo de transição

    # --- Helpers ---
    @classmethod
    def _count_photos(cls, order, folders: list[str]) -> int: ...
    @classmethod
    def _has_signature(cls, order, sig_type: str) -> bool: ...
    @classmethod
    def _all_timesheets_closed(cls, order) -> bool: ...
    @classmethod
    def _sector_timesheet_closed(cls, order, sector_status: str) -> bool: ...
    @classmethod
    def _has_pending_override(cls, order, target_status: str) -> bool: ...
```

---

## Fluxo de Override — 3 Canais

### Canal 1 — Presencial (credencial do gerente)

```
POST /service-orders/{id}/transition/
{
  "new_status": "budget",
  "force": true,
  "manager_email": "gerente@dscar.com",
  "manager_password": "...",
  "justification": "Fotos serão importadas amanhã"
}
```

- Autentica credenciais do gerente via dev-credentials ou Keycloak
- Verifica role >= MANAGER
- Executa transição imediatamente
- Cria `TransitionOverrideRequest` com status `approved` (auditoria)
- Loga `OVERRIDE_APPROVED` em ServiceOrderEvent

### Canal 2 — Assíncrono via web

```
POST /service-orders/{id}/override-request/
{
  "target_status": "budget",
  "reason": "Veículo fotografado externamente pelo perito"
}
```

- Cria `TransitionOverrideRequest` com status `pending`
- Loga `OVERRIDE_REQUESTED`
- Notifica MANAGER+ via feed de notificações (sino)

**Resolução:**
```
POST /service-orders/{id}/override-request/{override_id}/resolve/
{
  "action": "approved",
  "justification": "OK, tirar fotos amanhã"
}
```

- Se `approved`: executa transição automaticamente
- Loga `OVERRIDE_APPROVED` ou `OVERRIDE_REJECTED`
- Notifica consultor

### Canal 3 — Assíncrono via mobile

- Mesmo endpoint do Canal 2
- Push notification para MANAGER+ com deeplink
- Tela de aprovação no app: OS + bloqueios + justificativa + Aprovar/Rejeitar
- Push de volta ao consultor com resultado

### Expiração

- Celery task periódica (a cada hora)
- Marca `expired` requests com `expires_at < now()`
- Consultor pode solicitar novamente

### Permissões

| Ação | Role mínima |
|------|:-----------:|
| Solicitar override | CONSULTANT+ |
| Aprovar/rejeitar | MANAGER+ |
| Override presencial (force) | MANAGER+ |

---

## API Endpoints (novos)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/service-orders/{id}/transition-check/?target={status}` | Retorna ValidationResult para um target específico |
| POST | `/service-orders/{id}/override-request/` | Solicita override assíncrono |
| GET | `/service-orders/{id}/override-request/` | Lista overrides da OS |
| POST | `/service-orders/{id}/override-request/{oid}/resolve/` | Aprova/rejeita override |
| GET | `/service-orders/pending-overrides/` | Lista overrides pendentes (para MANAGER+) |

### Alterações em endpoints existentes

| Endpoint | Alteração |
|----------|-----------|
| `POST /service-orders/{id}/transition/` | Aceita `force`, `manager_email`, `manager_password`, `justification` |
| `GET /service-orders/{id}/` (detalhe) | Novo campo `transition_requirements` |
| `GET /service-orders/` (listagem) | Novo campo leve `has_transition_blocks` por OS |

---

## UX/UI

### Painel de pré-requisitos (detalhe da OS)

Visível na barra de status, mostra checklist para o próximo status:

- ✅ Item atendido
- ❌ Hard block (obrigatório, sem override)
- 🔒 Soft block (obrigatório, override possível)
- ⚠️ Warning (opcional)

Botões condicionais:
- **Sem bloqueios:** `[Avançar Status ✓]` habilitado
- **Só soft blocks:** `[Avançar Status]` desabilitado + `[Solicitar Liberação ao Gerente]`
- **Hard blocks:** `[Avançar Status]` desabilitado + texto "(Preencha os campos obrigatórios)"

### Modal de solicitação de override

1. Mostra bloqueios pendentes
2. Campo "Motivo da solicitação" (obrigatório)
3. Dois botões de canal: "Gerente presente (credencial)" ou "Enviar para aprovação remota"
4. Se presencial: campos email + senha do gerente
5. Se remoto: confirmação "Solicitação enviada"

### Kanban — indicadores visuais

Badges por card:
- 🟢 Sem bloqueios para próximo status
- 🟡 Tem soft blocks
- 🔴 Tem hard blocks

### Notificações do gerente

- **Web:** Badge numérico no sino + página de overrides pendentes
- **Mobile:** Push notification com deeplink + tela de aprovação

### Feedback ao consultor

- Aprovado: toast verde + OS avança automaticamente + log no histórico
- Rejeitado: toast vermelho + motivo visível no histórico
- Expirado: toast cinza "Solicitação expirada após 24h"

---

## Escopo de Implementação

### Backend
1. `TransitionValidator` — classe de serviço com todas as regras
2. `TransitionOverrideRequest` — model + migration
3. Alterar `ServiceOrderService.transition()` — integrar validator
4. Novos endpoints: override-request, transition-check, pending-overrides
5. Alterar serializers: `transition_requirements` no detalhe
6. Celery task de expiração
7. Testes unitários por transição

### Frontend Web
1. Painel de pré-requisitos no detalhe da OS
2. Modal de solicitação de override (2 canais)
3. Badges no Kanban
4. Página de overrides pendentes (gerente)
5. Notificação no sino
6. Integração com `useTransitionStatus` hook

### Mobile
1. Painel de pré-requisitos no detalhe
2. Modal de override (2 canais)
3. Badges no Kanban mobile
4. Tela de aprovação de override (gerente)
5. Push notifications (solicitação + resolução)

---

*Paddock Solutions · paddock.solutions · Manaus, AM*
