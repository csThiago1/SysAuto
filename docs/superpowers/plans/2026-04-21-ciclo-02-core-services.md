# Ciclo 02 — Core Services · Módulo de Orçamentação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar toda a camada de serviços (regras de negócio) do módulo de orçamentação em cima da fundação de dados do Ciclo 01. Sem API/UI ainda — só services + testes.

**Architecture:** 4 services principais (`BudgetService`, `ServiceOrderService`, `ComplementoParticularService`, `PaymentService`), 1 helper cross-cutting (`OSEventLogger`) e 1 módulo de regras Kanban (`kanban.py`). Cada service é `@transaction.atomic` + `OSEventLogger.log_event()` + validação. Segue padrão service-layer da DS Car (CLAUDE.md).

**Tech Stack:** Django 5, PostgreSQL 16, Celery 5 (para `expire_stale_budgets` task), pytest-django, freezegun.

**Referência de design:** [`docs/superpowers/specs/2026-04-20-modulo-orcamentacao-design.md`](../specs/2026-04-20-modulo-orcamentacao-design.md) — §6, §15.1, §15.2.

**Dependências:** Ciclo 01 merged (60 testes PASS, models + migrations + seeds prontos).

**Out of scope** (outros ciclos):
- ViewSets, serializers, endpoints (Ciclo 3)
- Frontend (Ciclo 3)
- Importadores Cilia/HDI/XML (Ciclo 4) — `create_new_version_from_import` recebe `ParsedBudget` via argumento, mas o parsing é Ciclo 4
- PDF generation real (Ciclo 3) — `_render_budget_pdf` vira stub aqui
- Signals de auto-transição (Ciclo 5) — a transição automática será chamada **explicitamente** pelos services no Ciclo 2
- Fiscal/Fotos/Assinatura (Ciclo 5)

---

## Estrutura de arquivos deste ciclo

| Arquivo | Responsabilidade |
|---|---|
| `backend/core/apps/service_orders/events.py` | **NEW** — `OSEventLogger` helper centralizado |
| `backend/core/apps/service_orders/kanban.py` | **NEW** — `VALID_TRANSITIONS` + helpers; move do `services.py` |
| `backend/core/apps/service_orders/services.py` | **EVOLVE** — refatorar: mover VALID_TRANSITIONS pra kanban.py + adicionar `create_from_budget`, `create_new_version_from_import`, `approve_version`, `_can_deliver`, `_recalculate_totals`, `_copy_items_*`, `ComplementoParticularService` |
| `backend/core/apps/budgets/services.py` | **NEW** — `BudgetService` completo |
| `backend/core/apps/budgets/tasks.py` | **NEW** — Celery task `expire_stale_budgets` |
| `backend/core/apps/budgets/pdf_stub.py` | **NEW** — stub de PDF gen (substituído no Ciclo 5) |
| `backend/core/apps/payments/` | **NEW APP** — `__init__.py`, `apps.py`, `models.py`, `services.py`, `tests/` |
| `backend/core/apps/service_orders/tests/test_events.py` | **EVOLVE** — adicionar `TestOSEventLogger` |
| `backend/core/apps/service_orders/tests/test_service_orders_service.py` | **NEW** — testa ServiceOrderService + ComplementoParticularService |
| `backend/core/apps/service_orders/tests/test_kanban.py` | **NEW** — testa `VALID_TRANSITIONS` |
| `backend/core/apps/budgets/tests/test_budget_service.py` | **NEW** — testa BudgetService |
| `backend/core/apps/budgets/tests/test_expire_task.py` | **NEW** — testa `expire_stale_budgets` com freezegun |
| `backend/core/apps/payments/tests/test_payment_service.py` | **NEW** — testa PaymentService |
| `backend/core/config/celery.py` | **NEW** (ou EVOLVE) — Celery app config + beat schedule stub |
| `backend/core/config/settings.py` | **EVOLVE** — registrar `apps.payments`, importar celery |
| `backend/core/requirements.txt` | **EVOLVE** — adicionar celery + redis |
| `backend/core/scripts/smoke_ciclo2.py` | **NEW** — smoke integration do ciclo inteiro |
| `backend/core/MVP_CHECKLIST.md` | **EVOLVE** — seção Ciclo 02 |

**Ordem de execução**: os Chunks são sequenciais; dentro de cada chunk, as Tasks seguem TDD. Alguns serviços têm dependências entre si (ex: `ServiceOrderService.create_from_budget` precisa de `OSEventLogger` e `BudgetVersion`), então atenção à ordem.

---

## Task 1: `OSEventLogger` (helper cross-cutting)

**Files:**
- Create: `backend/core/apps/service_orders/events.py`
- Evolve: `backend/core/apps/service_orders/tests/test_events.py`

- [ ] **Step 1.1: Escrever teste falhando**

Adicionar em `apps/service_orders/tests/test_events.py`:

```python
import pytest
from django.utils import timezone

from apps.persons.models import Person
from apps.service_orders.events import OSEventLogger
from apps.service_orders.models import ServiceOrder, ServiceOrderEvent


@pytest.fixture
def person(db):
    return Person.objects.create(full_name="Logger Test", person_type="CLIENT")


@pytest.fixture
def os_instance(person):
    return ServiceOrder.objects.create(
        os_number="OS-LOG-1", customer=person,
        vehicle_plate="LOG1234", vehicle_description="Test",
    )


@pytest.mark.django_db
class TestOSEventLogger:

    def test_log_event_defaults(self, os_instance):
        event = OSEventLogger.log_event(os_instance, "STATUS_CHANGE")
        assert event.service_order == os_instance
        assert event.event_type == "STATUS_CHANGE"
        assert event.actor == "Sistema"
        assert event.payload == {}
        assert event.from_state == ""
        assert event.to_state == ""

    def test_log_event_full(self, os_instance):
        event = OSEventLogger.log_event(
            os_instance, "VERSION_APPROVED",
            actor="alice", payload={"version": 3},
            from_state="budget", to_state="repair",
        )
        assert event.actor == "alice"
        assert event.payload == {"version": 3}
        assert event.from_state == "budget"
        assert event.to_state == "repair"

    def test_log_event_returns_instance(self, os_instance):
        event = OSEventLogger.log_event(os_instance, "PHOTO_UPLOADED")
        assert isinstance(event, ServiceOrderEvent)
        assert event.pk is not None

    def test_log_event_respects_ordering(self, os_instance):
        e1 = OSEventLogger.log_event(os_instance, "STATUS_CHANGE")
        e2 = OSEventLogger.log_event(os_instance, "VERSION_CREATED")
        events = list(os_instance.events.all())
        # ordering is -created_at
        assert events[0].pk == e2.pk
        assert events[1].pk == e1.pk
```

- [ ] **Step 1.2: Rodar teste pra confirmar FAIL**

```bash
cd backend/core
DATABASE_URL="postgresql://paddock:paddock@localhost:5432/paddock_dev" pytest apps/service_orders/tests/test_events.py::TestOSEventLogger -v
```

Expected: ModuleNotFoundError `events` ou similar.

- [ ] **Step 1.3: Criar `events.py`**

```python
# apps/service_orders/events.py
"""Helper centralizado para logar eventos na timeline da OS.

Usado por todos os services (BudgetService, ServiceOrderService, etc) para
registrar mutações de forma consistente. Substitui o uso direto de
ServiceOrderEvent.objects.create — garante assinatura uniforme.
"""
from __future__ import annotations

from typing import Any

from .models import ServiceOrder, ServiceOrderEvent


class OSEventLogger:
    """Registra eventos na timeline de uma OS.

    Todos os services devem usar este helper em vez de criar
    ServiceOrderEvent diretamente, garantindo auditoria consistente.
    """

    @staticmethod
    def log_event(
        service_order: ServiceOrder,
        event_type: str,
        *,
        actor: str = "Sistema",
        payload: dict[str, Any] | None = None,
        from_state: str = "",
        to_state: str = "",
    ) -> ServiceOrderEvent:
        """Cria um ServiceOrderEvent.

        Args:
            service_order: instância da OS.
            event_type: um dos valores de ServiceOrderEvent.EVENT_TYPES.
            actor: nome/username de quem disparou. Default "Sistema" (auto-transition).
            payload: dict JSON-serializável com detalhes.
            from_state: estado anterior (para STATUS_CHANGE).
            to_state: estado novo (para STATUS_CHANGE).

        Returns:
            Instância recém-criada de ServiceOrderEvent.
        """
        return ServiceOrderEvent.objects.create(
            service_order=service_order,
            event_type=event_type,
            actor=actor,
            payload=payload or {},
            from_state=from_state,
            to_state=to_state,
        )
```

- [ ] **Step 1.4: Rodar teste pra confirmar PASS**

```bash
DATABASE_URL="postgresql://paddock:paddock@localhost:5432/paddock_dev" pytest apps/service_orders/tests/test_events.py::TestOSEventLogger -v
```

Expected: 4 PASS.

- [ ] **Step 1.5: Commit**

```bash
git add backend/core/apps/service_orders/events.py backend/core/apps/service_orders/tests/test_events.py
git commit -m "feat(service_orders): OSEventLogger helper para timeline unificada"
```

---

## Task 2: `kanban.py` — mover `VALID_TRANSITIONS` + adicionar re-entry

**Files:**
- Create: `backend/core/apps/service_orders/kanban.py`
- Modify: `backend/core/apps/service_orders/services.py` (remover VALID_TRANSITIONS; importar de kanban)
- Create: `backend/core/apps/service_orders/tests/test_kanban.py`

- [ ] **Step 2.1: Criar `kanban.py`**

```python
# apps/service_orders/kanban.py
"""Regras de transição do Kanban da OS.

15 estados conforme CLAUDE.md + re-entrada em `budget` a partir dos estados de reparo
(quando nova versão importada / complemento particular cria pendência de aprovação).
"""
from __future__ import annotations

from typing import Final


# Transições permitidas. `budget` pode ser origem E destino durante reparo (pausa).
VALID_TRANSITIONS: Final[dict[str, list[str]]] = {
    "reception": ["initial_survey", "cancelled"],  # budget NÃO: segue CLAUDE.md
    "initial_survey": ["budget"],
    "budget": ["waiting_parts", "repair"],
    "waiting_parts": ["repair"],
    "repair": ["mechanic", "bodywork", "polishing", "budget"],
    "mechanic": ["bodywork", "polishing", "budget"],
    "bodywork": ["painting", "budget"],
    "painting": ["assembly", "budget"],
    "assembly": ["polishing", "budget"],
    "polishing": ["washing", "budget"],
    "washing": ["final_survey", "budget"],
    "final_survey": ["ready"],
    "ready": ["delivered"],
    "delivered": [],
    "cancelled": [],
}


# Estados que capturam o `previous_status` da OS quando entram em `budget`
# (pra retomar depois de aprovação).
STATES_WITH_BUDGET_REENTRY: Final[set[str]] = {
    "repair", "mechanic", "bodywork", "painting",
    "assembly", "polishing", "washing",
}


def is_valid_transition(from_status: str, to_status: str) -> bool:
    """Retorna True se `from_status → to_status` é transição permitida."""
    return to_status in VALID_TRANSITIONS.get(from_status, [])


def allowed_transitions(from_status: str) -> list[str]:
    """Retorna estados permitidos a partir de `from_status`."""
    return VALID_TRANSITIONS.get(from_status, [])
```

- [ ] **Step 2.2: Criar tests `test_kanban.py`**

```python
# apps/service_orders/tests/test_kanban.py
import pytest

from apps.service_orders.kanban import (
    STATES_WITH_BUDGET_REENTRY,
    VALID_TRANSITIONS,
    allowed_transitions,
    is_valid_transition,
)


class TestValidTransitions:

    def test_reception_goes_to_initial_survey(self):
        assert is_valid_transition("reception", "initial_survey")

    def test_reception_can_cancel(self):
        assert is_valid_transition("reception", "cancelled")

    def test_budget_goes_to_repair_or_waiting_parts(self):
        assert is_valid_transition("budget", "waiting_parts")
        assert is_valid_transition("budget", "repair")

    def test_repair_reenters_budget(self):
        """Re-entrada: novo complemento/importação precisa pausar reparo."""
        assert is_valid_transition("repair", "budget")

    def test_all_repair_states_can_reenter_budget(self):
        """Todos os estados de reparo (bodywork, painting, etc) permitem voltar pra budget."""
        repair_states = ["repair", "mechanic", "bodywork", "painting",
                         "assembly", "polishing", "washing"]
        for state in repair_states:
            assert is_valid_transition(state, "budget"), (
                f"{state} deveria permitir voltar para budget"
            )

    def test_final_survey_cannot_reenter_budget(self):
        """Pós-vistoria final, complementos viram nova OS."""
        assert not is_valid_transition("final_survey", "budget")

    def test_delivered_is_terminal(self):
        assert allowed_transitions("delivered") == []

    def test_cancelled_is_terminal(self):
        assert allowed_transitions("cancelled") == []

    def test_invalid_state_returns_empty(self):
        assert allowed_transitions("XXX_UNKNOWN") == []

    def test_ready_goes_only_to_delivered(self):
        assert allowed_transitions("ready") == ["delivered"]


class TestBudgetReentryStates:

    def test_contains_expected_states(self):
        expected = {"repair", "mechanic", "bodywork", "painting",
                    "assembly", "polishing", "washing"}
        assert STATES_WITH_BUDGET_REENTRY == expected

    def test_final_survey_not_reentry(self):
        assert "final_survey" not in STATES_WITH_BUDGET_REENTRY
```

- [ ] **Step 2.3: Atualizar `services.py` pra importar de kanban**

Em `backend/core/apps/service_orders/services.py`, remover a constante `VALID_TRANSITIONS` local e importar:

```python
from .kanban import VALID_TRANSITIONS, STATES_WITH_BUDGET_REENTRY
```

Substituir usos diretos no `ServiceOrderService.change_status`.

- [ ] **Step 2.4: Rodar testes**

```bash
DATABASE_URL="postgresql://paddock:paddock@localhost:5432/paddock_dev" pytest apps/service_orders/tests/test_kanban.py apps/service_orders/tests/test_service_orders.py -v
```

Expected: novos 11 PASS + existentes regressão 0.

- [ ] **Step 2.5: Commit**

```bash
git add backend/core/apps/service_orders/
git commit -m "refactor(service_orders): mover VALID_TRANSITIONS para kanban.py + adicionar re-entry em budget"
```

---

## Task 3: App `payments` — Payment model + migrations

**Files:**
- Create: `backend/core/apps/payments/` (estrutura inteira)
- Modify: `backend/core/config/settings.py` (registrar app)

- [ ] **Step 3.1: Estrutura**

```bash
mkdir -p backend/core/apps/payments/tests backend/core/apps/payments/migrations
touch backend/core/apps/payments/__init__.py
touch backend/core/apps/payments/tests/__init__.py
touch backend/core/apps/payments/migrations/__init__.py
```

- [ ] **Step 3.2: AppConfig**

```python
# apps/payments/apps.py
from django.apps import AppConfig


class PaymentsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.payments"
    verbose_name = "Pagamentos"
```

- [ ] **Step 3.3: Registrar app em settings.py**

Adicionar em `INSTALLED_APPS`:
```python
"apps.payments",
```

- [ ] **Step 3.4: Model Payment**

```python
# apps/payments/models.py
from decimal import Decimal

from django.db import models

from apps.service_orders.models import ServiceOrder


class Payment(models.Model):
    """Pagamento registrado contra uma OS e bloco financeiro específico."""

    METHOD_CHOICES = [
        ("PIX", "Pix"),
        ("BOLETO", "Boleto"),
        ("DINHEIRO", "Dinheiro"),
        ("CARTAO", "Cartão"),
        ("TRANSFERENCIA", "Transferência"),
    ]

    STATUS_CHOICES = [
        ("pending", "Pendente"),
        ("received", "Recebido"),
        ("refunded", "Estornado"),
    ]

    PAYER_BLOCK_CHOICES = [
        ("SEGURADORA", "Coberto pela Seguradora"),
        ("COMPLEMENTO_PARTICULAR", "Complemento Particular"),
        ("FRANQUIA", "Franquia"),
        ("PARTICULAR", "Particular (OS particular inteira)"),
    ]

    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.PROTECT, related_name="payments",
    )
    payer_block = models.CharField(
        max_length=30, choices=PAYER_BLOCK_CHOICES, db_index=True,
    )

    amount = models.DecimalField(max_digits=14, decimal_places=2)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    reference = models.CharField(max_length=200, blank=True, default="")

    received_at = models.DateTimeField(null=True, blank=True)
    received_by = models.CharField(max_length=120, blank=True, default="")

    fiscal_doc = models.ForeignKey(
        "fiscal.FiscalDocument", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+",
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True,
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["service_order", "payer_block", "status"],
                name="pay_so_block_status_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.method} R$ {self.amount} — {self.service_order.os_number}"
```

**⚠ Atenção**: a FK `fiscal_doc` referencia `"fiscal.FiscalDocument"` que **não existe ainda** (Ciclo 5). Django aceita lazy string, mas migration vai falhar sem a app `fiscal` registrada. **Solução pragmática**: usar `null=True, blank=True` + FK lazy string sem app registrado causa problema no migrate.

**Workaround**: criar `fiscal_doc` como campo opcional mas **comentado** no Ciclo 2. Usar em vez disso:

```python
# TODO: Ciclo 5 — descomentar quando app fiscal existir
# fiscal_doc = models.ForeignKey(
#     "fiscal.FiscalDocument", on_delete=models.SET_NULL,
#     null=True, blank=True, related_name="+",
# )
fiscal_doc_ref = models.CharField(max_length=60, blank=True, default="")  # placeholder
```

- [ ] **Step 3.5: Gerar migration**

```bash
cd backend/core
DATABASE_URL="postgresql://paddock:paddock@localhost:5432/paddock_dev" python manage.py makemigrations payments
```

Expected: `0001_initial.py` criado.

- [ ] **Step 3.6: Teste do Payment model**

```python
# apps/payments/tests/test_models.py
from decimal import Decimal

import pytest

from apps.payments.models import Payment
from apps.persons.models import Person
from apps.service_orders.models import ServiceOrder


@pytest.fixture
def person(db):
    return Person.objects.create(full_name="Pagador", person_type="CLIENT")


@pytest.fixture
def os_instance(person):
    return ServiceOrder.objects.create(
        os_number="OS-PAY-1", customer=person,
        vehicle_plate="PAY1234", vehicle_description="Test",
    )


@pytest.mark.django_db
class TestPayment:

    def test_create_particular(self, os_instance):
        p = Payment.objects.create(
            service_order=os_instance,
            payer_block="PARTICULAR",
            amount=Decimal("1500.50"),
            method="PIX",
            reference="pix-ABC-123",
        )
        assert p.status == "pending"
        assert str(p) == f"PIX R$ 1500.50 — {os_instance.os_number}"

    def test_create_franquia(self, os_instance):
        p = Payment.objects.create(
            service_order=os_instance,
            payer_block="FRANQUIA",
            amount=Decimal("2000"),
            method="CARTAO",
        )
        assert p.payer_block == "FRANQUIA"
```

- [ ] **Step 3.7: Rodar migrate + tests**

```bash
DATABASE_URL="postgresql://paddock:paddock@localhost:5432/paddock_dev" pytest apps/payments/tests/ -v
```

Expected: 2 PASS.

- [ ] **Step 3.8: Commit**

```bash
git add backend/core/apps/payments/ backend/core/config/settings.py
git commit -m "feat(payments): app payments + Payment model com payer_block"
```

---

## Task 4: `PaymentService`

**Files:**
- Create: `backend/core/apps/payments/services.py`
- Create: `backend/core/apps/payments/tests/test_payment_service.py`

- [ ] **Step 4.1: Teste**

```python
# apps/payments/tests/test_payment_service.py
from decimal import Decimal

import pytest

from apps.payments.models import Payment
from apps.payments.services import PaymentService
from apps.persons.models import Person
from apps.service_orders.models import ServiceOrder, ServiceOrderEvent


@pytest.fixture
def person(db):
    return Person.objects.create(full_name="Cliente Pay", person_type="CLIENT")


@pytest.fixture
def os_instance(person):
    return ServiceOrder.objects.create(
        os_number="OS-PAYSVC-1", customer=person,
        vehicle_plate="PSV1234", vehicle_description="Test",
    )


@pytest.mark.django_db
class TestPaymentService:

    def test_record_creates_payment(self, os_instance):
        p = PaymentService.record(
            service_order=os_instance,
            payer_block="PARTICULAR",
            amount=Decimal("500"),
            method="PIX",
            reference="ref123",
            received_by="alice",
        )
        assert p.status == "received"
        assert p.received_by == "alice"
        assert p.received_at is not None

    def test_record_emits_event(self, os_instance):
        PaymentService.record(
            service_order=os_instance,
            payer_block="PARTICULAR",
            amount=Decimal("100"),
            method="DINHEIRO",
            reference="",
            received_by="bob",
        )
        events = os_instance.events.filter(event_type="PAYMENT_RECORDED")
        assert events.count() == 1
        ev = events.first()
        assert ev.actor == "bob"
        assert ev.payload["amount"] == "100"
        assert ev.payload["method"] == "DINHEIRO"
        assert ev.payload["block"] == "PARTICULAR"

    def test_record_atomic_on_failure(self, os_instance, monkeypatch):
        """Se log_event falhar, o payment não deve persistir."""
        from apps.service_orders.events import OSEventLogger

        def boom(*args, **kwargs):
            raise RuntimeError("boom")

        monkeypatch.setattr(OSEventLogger, "log_event", boom)

        with pytest.raises(RuntimeError):
            PaymentService.record(
                service_order=os_instance,
                payer_block="PARTICULAR",
                amount=Decimal("200"),
                method="PIX",
                reference="",
                received_by="carol",
            )
        assert Payment.objects.count() == 0
```

- [ ] **Step 4.2: Rodar (FAIL esperado)**

```bash
DATABASE_URL="postgresql://paddock:paddock@localhost:5432/paddock_dev" pytest apps/payments/tests/test_payment_service.py -v
```

Expected: FAIL (services não existe).

- [ ] **Step 4.3: Criar services.py**

```python
# apps/payments/services.py
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.service_orders.events import OSEventLogger
from apps.service_orders.models import ServiceOrder

from .models import Payment


class PaymentService:

    @classmethod
    @transaction.atomic
    def record(
        cls,
        *,
        service_order: ServiceOrder,
        payer_block: str,
        amount: Decimal,
        method: str,
        reference: str = "",
        received_by: str = "",
    ) -> Payment:
        """Registra pagamento recebido para um bloco da OS.

        Dispara evento PAYMENT_RECORDED na timeline.

        Raises:
            ValidationError: se payer_block inválido.
        """
        payment = Payment.objects.create(
            service_order=service_order,
            payer_block=payer_block,
            amount=amount,
            method=method,
            reference=reference,
            received_by=received_by,
            received_at=timezone.now(),
            status="received",
        )

        OSEventLogger.log_event(
            service_order, "PAYMENT_RECORDED",
            actor=received_by or "Sistema",
            payload={
                "amount": str(amount),
                "method": method,
                "block": payer_block,
                "payment_id": payment.pk,
            },
        )
        return payment
```

- [ ] **Step 4.4: Rodar tests**

```bash
DATABASE_URL="postgresql://paddock:paddock@localhost:5432/paddock_dev" pytest apps/payments/tests/test_payment_service.py -v
```

Expected: 3 PASS.

- [ ] **Step 4.5: Commit**

```bash
git add backend/core/apps/payments/
git commit -m "feat(payments): PaymentService.record com evento atômico"
```

---

## Task 5: `BudgetService.create` + `send_to_customer`

**Files:**
- Create: `backend/core/apps/budgets/services.py` (inicial)
- Create: `backend/core/apps/budgets/pdf_stub.py`
- Create: `backend/core/apps/budgets/tests/test_budget_service.py`

- [ ] **Step 5.1: Teste inicial**

```python
# apps/budgets/tests/test_budget_service.py
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.budgets.models import Budget, BudgetVersion, BudgetVersionItem
from apps.budgets.services import BudgetService
from apps.items.models import ItemOperation, ItemOperationType, LaborCategory
from apps.persons.models import Person


@pytest.fixture
def person(db):
    return Person.objects.create(full_name="Cliente Budget", person_type="CLIENT")


@pytest.mark.django_db
class TestBudgetServiceCreate:

    def test_create_allocates_number_and_v1(self, person):
        budget = BudgetService.create(
            customer=person,
            vehicle_plate="abc1d23",
            vehicle_description="Honda Fit 2019",
            created_by="alice",
        )
        assert budget.number.startswith("OR-")
        assert budget.vehicle_plate == "ABC1D23"  # uppercase
        assert budget.customer == person
        assert budget.active_version.version_number == 1
        assert budget.active_version.status == "draft"
        assert budget.active_version.created_by == "alice"

    def test_create_different_allocates_different_numbers(self, person):
        b1 = BudgetService.create(
            customer=person, vehicle_plate="A1", vehicle_description="x", created_by="a",
        )
        b2 = BudgetService.create(
            customer=person, vehicle_plate="A2", vehicle_description="y", created_by="a",
        )
        assert b1.number != b2.number


@pytest.mark.django_db
class TestBudgetServiceSend:

    def _create_budget_with_items(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="SND1", vehicle_description="Fit",
            created_by="alice",
        )
        v = budget.active_version
        item = BudgetVersionItem.objects.create(
            version=v, description="AMORTECEDOR",
            quantity=Decimal("2"), unit_price=Decimal("500"),
            discount_pct=Decimal("0"), net_price=Decimal("1000"),
            item_type="PART",
        )
        ItemOperation.objects.create(
            item_budget=item,
            operation_type=ItemOperationType.objects.get(code="TROCA"),
            labor_category=LaborCategory.objects.get(code="FUNILARIA"),
            hours=Decimal("2"), hourly_rate=Decimal("40"),
            labor_cost=Decimal("80"),
        )
        return budget, v, item

    def test_send_congela_version(self, person):
        budget, v, _ = self._create_budget_with_items(person)
        sent = BudgetService.send_to_customer(version=v, sent_by="alice")
        assert sent.status == "sent"
        assert sent.sent_at is not None
        assert sent.valid_until is not None
        delta = sent.valid_until - sent.sent_at
        assert 29 <= delta.days <= 31  # 30 dias

    def test_send_calculates_totals(self, person):
        budget, v, _ = self._create_budget_with_items(person)
        BudgetService.send_to_customer(version=v, sent_by="alice")
        v.refresh_from_db()
        # 1 item de 1000 em peça + 80 de MO = 1080
        assert v.parts_total == Decimal("1000")
        assert v.labor_total == Decimal("80")
        assert v.net_total == Decimal("1080")

    def test_send_generates_pdf_stub(self, person):
        _, v, _ = self._create_budget_with_items(person)
        sent = BudgetService.send_to_customer(version=v, sent_by="alice")
        assert sent.pdf_s3_key  # não vazio
        assert sent.pdf_s3_key.startswith("stub://")

    def test_send_computes_content_hash(self, person):
        _, v, _ = self._create_budget_with_items(person)
        sent = BudgetService.send_to_customer(version=v, sent_by="alice")
        assert len(sent.content_hash) == 64  # sha256 hex

    def test_send_only_draft(self, person):
        _, v, _ = self._create_budget_with_items(person)
        v.status = "sent"
        v.save()
        with pytest.raises(ValidationError):
            BudgetService.send_to_customer(version=v, sent_by="alice")
```

- [ ] **Step 5.2: PDF stub**

```python
# apps/budgets/pdf_stub.py
"""Stub de geração de PDF. Substituído por WeasyPrint real no Ciclo 5.

Retorna uma chave S3 simulada; não gera arquivo real.
"""
from __future__ import annotations

import uuid


def render_budget_pdf_stub(budget_number: str, version_number: int) -> str:
    """Retorna S3 key simulado. No Ciclo 5, substituído por WeasyPrint + upload real."""
    return f"stub://budgets/{budget_number}/v{version_number}-{uuid.uuid4().hex[:8]}.pdf"
```

- [ ] **Step 5.3: BudgetService (create + send)**

```python
# apps/budgets/services.py
from __future__ import annotations

import hashlib
import json
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.items.services import NumberAllocator
from apps.persons.models import Person

from .models import Budget, BudgetVersion, BudgetVersionItem
from .pdf_stub import render_budget_pdf_stub


BUDGET_VALIDITY_DAYS = 30


class BudgetService:

    @classmethod
    @transaction.atomic
    def create(
        cls,
        *,
        customer: Person,
        vehicle_plate: str,
        vehicle_description: str,
        created_by: str,
    ) -> Budget:
        """Cria Budget novo + BudgetVersion v1 em status draft."""
        budget = Budget.objects.create(
            number=NumberAllocator.allocate("BUDGET"),
            customer=customer,
            vehicle_plate=vehicle_plate.upper(),
            vehicle_description=vehicle_description,
        )
        BudgetVersion.objects.create(
            budget=budget, version_number=1,
            status="draft", created_by=created_by,
        )
        return budget

    @classmethod
    @transaction.atomic
    def send_to_customer(
        cls,
        *,
        version: BudgetVersion,
        sent_by: str,
    ) -> BudgetVersion:
        """Congela versão, calcula totais, gera PDF stub, marca 'sent' + validade 30d."""
        if version.status != "draft":
            raise ValidationError(
                {"status": f"Só versões em 'draft' podem ser enviadas (atual: {version.status})"}
            )

        cls._recalculate_totals(version)

        now = timezone.now()
        version.status = "sent"
        version.sent_at = now
        version.valid_until = now + timedelta(days=BUDGET_VALIDITY_DAYS)
        version.pdf_s3_key = render_budget_pdf_stub(
            version.budget.number, version.version_number,
        )
        version.content_hash = cls._compute_hash(version)
        version.save()

        return version

    # ---- Helpers privados ----

    @classmethod
    def _recalculate_totals(cls, version: BudgetVersion) -> None:
        """Soma items + operations pra popular totais cache."""
        labor = Decimal("0")
        parts = Decimal("0")
        subtotal = Decimal("0")
        discount = Decimal("0")

        items = version.items.all().prefetch_related("operations")
        for item in items:
            gross = item.unit_price * item.quantity
            item_discount = gross - item.net_price
            discount += item_discount
            if item.item_type == "PART":
                parts += item.net_price
            subtotal += item.net_price
            for op in item.operations.all():
                labor += op.labor_cost

        version.labor_total = labor
        version.parts_total = parts
        version.subtotal = subtotal + labor
        version.discount_total = discount
        version.net_total = version.subtotal - version.discount_total
        version.save(update_fields=[
            "labor_total", "parts_total", "subtotal", "discount_total", "net_total",
        ])

    @classmethod
    def _compute_hash(cls, version: BudgetVersion) -> str:
        """SHA256 dos items da versão. Snapshot imutável pós-send."""
        payload = []
        for item in version.items.all().order_by("sort_order", "pk"):
            payload.append({
                "description": item.description,
                "qty": str(item.quantity),
                "unit_price": str(item.unit_price),
                "net_price": str(item.net_price),
                "item_type": item.item_type,
            })
        serialized = json.dumps(payload, sort_keys=True)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
```

- [ ] **Step 5.4: Rodar**

Expected: 6 PASS no módulo.

- [ ] **Step 5.5: Commit**

```bash
git add backend/core/apps/budgets/
git commit -m "feat(budgets): BudgetService.create + send_to_customer com PDF stub"
```

---

## Task 6: `BudgetService.approve` + `reject` + `request_revision`

**Files:**
- Modify: `backend/core/apps/budgets/services.py`
- Modify: `backend/core/apps/budgets/tests/test_budget_service.py`
- Modify: `backend/core/apps/service_orders/services.py` (adicionar `create_from_budget`, chamado por approve)

> **Importante**: `approve` chama `ServiceOrderService.create_from_budget` pra criar OS particular. Precisamos ter ambos prontos — primeiro implementar `create_from_budget` (sem novidade além do que já foi planejado no Ciclo 01), depois `approve`.

- [ ] **Step 6.1: Criar `ServiceOrderService.create_from_budget` (stub mínimo aqui, full-featured na Task 8)**

Adicionar em `backend/core/apps/service_orders/services.py`:

```python
# apps/service_orders/services.py
from __future__ import annotations

from decimal import Decimal

from django.db import transaction

from apps.items.models import ItemOperation
from apps.items.services import NumberAllocator

from .events import OSEventLogger
from .kanban import VALID_TRANSITIONS, STATES_WITH_BUDGET_REENTRY
from .models import ServiceOrder, ServiceOrderVersion, ServiceOrderVersionItem


class ServiceOrderService:

    @classmethod
    @transaction.atomic
    def create_from_budget(cls, *, version) -> ServiceOrder:
        """Budget aprovada vira OS particular v1 com items copiados."""
        budget = version.budget
        os = ServiceOrder.objects.create(
            os_number=NumberAllocator.allocate("SERVICE_ORDER"),
            customer=budget.customer,
            customer_type="PARTICULAR",
            vehicle_plate=budget.vehicle_plate,
            vehicle_description=budget.vehicle_description,
            source_budget=budget,
            status="reception",
        )

        os_v = ServiceOrderVersion.objects.create(
            service_order=os,
            version_number=1,
            source="budget_approval",
            status="approved",
            subtotal=version.subtotal,
            discount_total=version.discount_total,
            net_total=version.net_total,
            labor_total=version.labor_total,
            parts_total=version.parts_total,
        )
        cls._copy_items_from_budget(source_version=version, target_version=os_v)

        OSEventLogger.log_event(
            os, "BUDGET_LINKED",
            payload={"budget_number": budget.number, "budget_version": version.version_number},
        )
        OSEventLogger.log_event(
            os, "VERSION_CREATED",
            payload={"version_number": 1, "source": "budget_approval"},
        )
        return os

    # ... demais métodos adicionados na Task 8

    @classmethod
    def _copy_items_from_budget(cls, *, source_version, target_version) -> None:
        """Copia BudgetVersionItem → ServiceOrderVersionItem preservando operations."""
        # Campos compartilhados via ItemFieldsMixin
        shared_fields = [
            "bucket", "payer_block", "impact_area", "item_type",
            "description", "external_code", "part_type", "supplier",
            "quantity", "unit_price", "unit_cost", "discount_pct", "net_price",
            "flag_abaixo_padrao", "flag_acima_padrao", "flag_inclusao_manual",
            "flag_codigo_diferente", "flag_servico_manual", "flag_peca_da_conta",
            "sort_order",
        ]
        for item in source_version.items.all().prefetch_related("operations"):
            new_item = ServiceOrderVersionItem.objects.create(
                version=target_version,
                **{f: getattr(item, f) for f in shared_fields},
            )
            # Default payer_block do budget é "PARTICULAR" (OS particular inteira)
            if not item.payer_block or item.payer_block == "PARTICULAR":
                new_item.payer_block = "PARTICULAR"
                new_item.save(update_fields=["payer_block"])

            for op in item.operations.all():
                ItemOperation.objects.create(
                    item_so=new_item,
                    operation_type=op.operation_type,
                    labor_category=op.labor_category,
                    hours=op.hours,
                    hourly_rate=op.hourly_rate,
                    labor_cost=op.labor_cost,
                )
```

- [ ] **Step 6.2: Testes approve/reject/revision**

Adicionar em `backend/core/apps/budgets/tests/test_budget_service.py`:

```python
@pytest.mark.django_db
class TestBudgetServiceApprove:

    def _prepare_sent_version(self, person):
        from apps.budgets.tests.test_budget_service import (
            TestBudgetServiceSend as _Helpers,
        )
        # Reuse helper (ou recriar inline)
        budget = BudgetService.create(
            customer=person, vehicle_plate="A1", vehicle_description="x",
            created_by="alice",
        )
        v = budget.active_version
        BudgetVersionItem.objects.create(
            version=v, description="PEÇA",
            quantity=Decimal("1"), unit_price=Decimal("500"),
            net_price=Decimal("500"), item_type="PART",
        )
        BudgetService.send_to_customer(version=v, sent_by="alice")
        v.refresh_from_db()
        return budget, v

    def test_approve_creates_os(self, person):
        budget, v = self._prepare_sent_version(person)
        from apps.service_orders.models import ServiceOrder
        os = BudgetService.approve(
            version=v, approved_by="cliente-whatsapp",
            evidence_s3_key="whatsapp://ok-print.jpg",
        )
        assert isinstance(os, ServiceOrder)
        assert os.customer_type == "PARTICULAR"
        assert os.source_budget == budget
        assert os.active_version.items.count() == 1

    def test_approve_marks_version_approved(self, person):
        budget, v = self._prepare_sent_version(person)
        BudgetService.approve(
            version=v, approved_by="alice", evidence_s3_key="s3://ev.pdf",
        )
        v.refresh_from_db()
        assert v.status == "approved"
        assert v.approved_by == "alice"
        assert v.approved_at is not None
        assert v.approval_evidence_s3_key == "s3://ev.pdf"

    def test_approve_supersedes_other_versions(self, person):
        budget, v1 = self._prepare_sent_version(person)
        # Cria v2 também em sent
        v2 = BudgetVersion.objects.create(
            budget=budget, version_number=2, status="sent",
        )
        BudgetService.approve(version=v1, approved_by="alice", evidence_s3_key="")
        v2.refresh_from_db()
        assert v2.status == "superseded"

    def test_approve_links_budget_to_os(self, person):
        budget, v = self._prepare_sent_version(person)
        os = BudgetService.approve(version=v, approved_by="alice", evidence_s3_key="")
        budget.refresh_from_db()
        assert budget.service_order == os

    def test_approve_rejects_non_sent(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="X", vehicle_description="y",
            created_by="alice",
        )
        v = budget.active_version  # draft
        with pytest.raises(ValidationError):
            BudgetService.approve(version=v, approved_by="alice", evidence_s3_key="")

    def test_approve_rejects_expired(self, person):
        budget, v = self._prepare_sent_version(person)
        # Forçar expired
        v.valid_until = timezone.now() - timedelta(days=1)
        v.save()
        with pytest.raises(ValidationError):
            BudgetService.approve(version=v, approved_by="alice", evidence_s3_key="")


@pytest.mark.django_db
class TestBudgetServiceReject:

    def test_reject_marks_version(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="Z", vehicle_description="w", created_by="a",
        )
        v = budget.active_version
        v.status = "sent"
        v.save()
        BudgetService.reject(version=v)
        v.refresh_from_db()
        assert v.status == "rejected"

    def test_reject_only_sent(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="Z2", vehicle_description="w", created_by="a",
        )
        v = budget.active_version  # draft
        with pytest.raises(ValidationError):
            BudgetService.reject(version=v)


@pytest.mark.django_db
class TestBudgetServiceRevision:

    def test_revision_creates_v2_draft(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="R", vehicle_description="w", created_by="a",
        )
        v = budget.active_version
        v.status = "sent"
        v.save()
        new_v = BudgetService.request_revision(version=v)
        assert new_v.version_number == 2
        assert new_v.status == "draft"
        v.refresh_from_db()
        assert v.status == "revision"

    def test_revision_copies_items(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="R2", vehicle_description="w", created_by="a",
        )
        v = budget.active_version
        BudgetVersionItem.objects.create(
            version=v, description="X",
            quantity=Decimal("1"), unit_price=Decimal("100"),
            net_price=Decimal("100"),
        )
        v.status = "sent"
        v.save()
        new_v = BudgetService.request_revision(version=v)
        assert new_v.items.count() == 1
```

- [ ] **Step 6.3: Implementar approve/reject/request_revision**

Adicionar em `apps/budgets/services.py`:

```python
    @classmethod
    @transaction.atomic
    def approve(
        cls,
        *,
        version: BudgetVersion,
        approved_by: str,
        evidence_s3_key: str = "",
    ) -> "ServiceOrder":
        """Aprova a versão enviada e cria ServiceOrder particular."""
        from apps.service_orders.services import ServiceOrderService

        if version.status != "sent":
            raise ValidationError(
                {"status": f"Só 'sent' pode ser aprovada (atual: {version.status})"}
            )
        if version.valid_until and version.valid_until < timezone.now():
            raise ValidationError(
                {"validity": "Orçamento expirado — crie um novo"}
            )

        version.status = "approved"
        version.approved_at = timezone.now()
        version.approved_by = approved_by
        version.approval_evidence_s3_key = evidence_s3_key
        version.save()

        # Supersede irmãs não-terminais
        version.budget.versions.exclude(pk=version.pk).exclude(
            status__in=["approved", "rejected", "expired", "superseded"],
        ).update(status="superseded")

        # Cria OS
        os = ServiceOrderService.create_from_budget(version=version)

        version.budget.service_order = os
        version.budget.save(update_fields=["service_order"])
        return os

    @classmethod
    @transaction.atomic
    def reject(cls, *, version: BudgetVersion) -> BudgetVersion:
        """Marca versão como rejeitada (cliente disse não)."""
        if version.status != "sent":
            raise ValidationError(
                {"status": f"Só 'sent' pode ser rejeitada (atual: {version.status})"}
            )
        version.status = "rejected"
        version.save(update_fields=["status"])
        return version

    @classmethod
    @transaction.atomic
    def request_revision(cls, *, version: BudgetVersion) -> BudgetVersion:
        """Cliente pediu alteração. Marca vN como 'revision', cria v+1 draft com items copiados."""
        if version.status != "sent":
            raise ValidationError(
                {"status": f"Só 'sent' pode entrar em revisão (atual: {version.status})"}
            )

        version.status = "revision"
        version.save(update_fields=["status"])

        new_version = BudgetVersion.objects.create(
            budget=version.budget,
            version_number=version.version_number + 1,
            status="draft",
            created_by=version.created_by,
        )
        cls._copy_items_between_versions(source=version, target=new_version)
        return new_version

    @classmethod
    def _copy_items_between_versions(
        cls, *, source: BudgetVersion, target: BudgetVersion,
    ) -> None:
        """Copia items de uma BudgetVersion pra outra, preservando operations."""
        from apps.items.models import ItemOperation
        shared_fields = [
            "bucket", "payer_block", "impact_area", "item_type",
            "description", "external_code", "part_type", "supplier",
            "quantity", "unit_price", "unit_cost", "discount_pct", "net_price",
            "flag_abaixo_padrao", "flag_acima_padrao", "flag_inclusao_manual",
            "flag_codigo_diferente", "flag_servico_manual", "flag_peca_da_conta",
            "sort_order",
        ]
        for item in source.items.all().prefetch_related("operations"):
            new_item = BudgetVersionItem.objects.create(
                version=target,
                **{f: getattr(item, f) for f in shared_fields},
            )
            for op in item.operations.all():
                ItemOperation.objects.create(
                    item_budget=new_item,
                    operation_type=op.operation_type,
                    labor_category=op.labor_category,
                    hours=op.hours,
                    hourly_rate=op.hourly_rate,
                    labor_cost=op.labor_cost,
                )
```

- [ ] **Step 6.4: Rodar tests**

Expected: todos os tests (create + send + approve + reject + revision) PASS.

- [ ] **Step 6.5: Commit**

```bash
git add backend/core/apps/budgets/ backend/core/apps/service_orders/services.py
git commit -m "feat(budgets+service_orders): BudgetService approve/reject/revision + ServiceOrderService.create_from_budget"
```

---

## Task 7: `BudgetService.clone` + `expire_stale_budgets` Celery task

**Files:**
- Modify: `backend/core/apps/budgets/services.py` (adicionar `clone`)
- Create: `backend/core/apps/budgets/tasks.py`
- Create: `backend/core/apps/budgets/tests/test_expire_task.py`
- Modify: `backend/core/requirements.txt` (adicionar celery)
- Create: `backend/core/config/celery.py`

- [ ] **Step 7.1: Adicionar celery + freezegun às deps (freezegun já está)**

Em `requirements.txt`:

```
# Celery (tasks assíncronas)
celery>=5.4,<6.0
redis>=5.0,<6.0
```

- [ ] **Step 7.2: Criar celery.py**

```python
# config/celery.py
import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("dscar")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


# Beat schedule (stub — Cilia polling vem no Ciclo 4)
app.conf.beat_schedule = {
    "expire-stale-budgets-daily": {
        "task": "apps.budgets.tasks.expire_stale_budgets",
        "schedule": 60 * 60 * 24,  # 1x por dia
    },
}
```

- [ ] **Step 7.3: Teste da task (usa freezegun)**

```python
# apps/budgets/tests/test_expire_task.py
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from freezegun import freeze_time

from apps.budgets.models import Budget, BudgetVersion
from apps.budgets.services import BudgetService
from apps.budgets.tasks import expire_stale_budgets
from apps.persons.models import Person


@pytest.fixture
def person(db):
    return Person.objects.create(full_name="Expire Test", person_type="CLIENT")


@pytest.mark.django_db
class TestExpireStaleBudgets:

    @freeze_time("2026-04-01 10:00:00")
    def test_expires_budget_past_30_days(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="E1", vehicle_description="x",
            created_by="alice",
        )
        v = budget.active_version
        BudgetService.send_to_customer(version=v, sent_by="alice")

        with freeze_time("2026-05-05 10:00:00"):  # +34 dias
            count = expire_stale_budgets()

        v.refresh_from_db()
        assert count == 1
        assert v.status == "expired"

    @freeze_time("2026-04-01 10:00:00")
    def test_doesnt_expire_recent_sent(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="E2", vehicle_description="x",
            created_by="alice",
        )
        v = budget.active_version
        BudgetService.send_to_customer(version=v, sent_by="alice")

        with freeze_time("2026-04-10 10:00:00"):  # +9 dias
            count = expire_stale_budgets()

        v.refresh_from_db()
        assert count == 0
        assert v.status == "sent"

    @freeze_time("2026-04-01 10:00:00")
    def test_doesnt_expire_approved(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="E3", vehicle_description="x",
            created_by="alice",
        )
        v = budget.active_version
        BudgetService.send_to_customer(version=v, sent_by="alice")
        v.status = "approved"
        v.save()

        with freeze_time("2026-05-05 10:00:00"):
            expire_stale_budgets()

        v.refresh_from_db()
        assert v.status == "approved"  # não muda


@pytest.mark.django_db
class TestClone:

    def test_clone_preserves_cloned_from(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="CL", vehicle_description="x", created_by="a",
        )
        v = budget.active_version
        v.status = "rejected"
        v.save()

        new_budget = BudgetService.clone(source_budget=budget, created_by="bob")
        assert new_budget.cloned_from == budget
        assert new_budget.number != budget.number
        assert new_budget.customer == budget.customer
        assert new_budget.active_version.version_number == 1
        assert new_budget.active_version.status == "draft"
```

- [ ] **Step 7.4: Implementar clone + task**

Em `apps/budgets/services.py`:

```python
    @classmethod
    @transaction.atomic
    def clone(cls, *, source_budget: Budget, created_by: str) -> Budget:
        """Clona budget arquivado (rejected/expired) pra reutilizar dados."""
        new_budget = Budget.objects.create(
            number=NumberAllocator.allocate("BUDGET"),
            customer=source_budget.customer,
            vehicle_plate=source_budget.vehicle_plate,
            vehicle_description=source_budget.vehicle_description,
            cloned_from=source_budget,
        )
        new_v = BudgetVersion.objects.create(
            budget=new_budget, version_number=1,
            status="draft", created_by=created_by,
        )
        # Copia items da última versão NÃO-draft do source
        source_v = source_budget.versions.exclude(status="draft").order_by("-version_number").first()
        if source_v:
            cls._copy_items_between_versions(source=source_v, target=new_v)
        return new_budget

    @classmethod
    def expire_stale_versions(cls) -> int:
        """Marca versões 'sent' com valid_until < now como 'expired'.

        Retorna quantidade atualizada.
        """
        return BudgetVersion.objects.filter(
            status="sent", valid_until__lt=timezone.now(),
        ).update(status="expired")
```

Criar `apps/budgets/tasks.py`:

```python
# apps/budgets/tasks.py
"""Celery tasks do módulo de orçamentos."""
from __future__ import annotations

import logging

from celery import shared_task

from .services import BudgetService


logger = logging.getLogger(__name__)


@shared_task(name="apps.budgets.tasks.expire_stale_budgets")
def expire_stale_budgets() -> int:
    """Marca budgets sent expirados (valid_until < now) como 'expired'.

    Retorna quantidade afetada.

    Agendada via Celery beat 1x por dia.
    """
    count = BudgetService.expire_stale_versions()
    logger.info("Expired %d stale budget versions", count)
    return count
```

- [ ] **Step 7.5: Rodar tests**

Expected: 4 PASS (3 expire + 1 clone).

- [ ] **Step 7.6: Commit**

```bash
git add backend/core/apps/budgets/ backend/core/requirements.txt backend/core/config/
git commit -m "feat(budgets): BudgetService.clone + expire_stale_budgets Celery task"
```

---

## Task 8: `ServiceOrderService.change_status` + trava de delivery

**Files:**
- Modify: `backend/core/apps/service_orders/services.py`
- Create: `backend/core/apps/service_orders/tests/test_service_orders_service.py`

- [ ] **Step 8.1: Testes**

```python
# apps/service_orders/tests/test_service_orders_service.py
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from apps.persons.models import Person
from apps.service_orders.models import (
    ServiceOrder, ServiceOrderEvent, ServiceOrderVersion,
)
from apps.service_orders.services import ServiceOrderService


@pytest.fixture
def person(db):
    return Person.objects.create(full_name="Service Test", person_type="CLIENT")


@pytest.fixture
def os_instance(person):
    return ServiceOrder.objects.create(
        os_number="OS-SVC-1", customer=person,
        vehicle_plate="SVC1234", vehicle_description="Test",
    )


@pytest.mark.django_db
class TestChangeStatus:

    def test_valid_transition(self, os_instance):
        ServiceOrderService.change_status(
            service_order=os_instance, new_status="initial_survey",
            changed_by="alice", notes="iniciando vistoria",
        )
        os_instance.refresh_from_db()
        assert os_instance.status == "initial_survey"

    def test_invalid_transition_raises(self, os_instance):
        with pytest.raises(ValidationError):
            ServiceOrderService.change_status(
                service_order=os_instance, new_status="painting",  # direto de reception
            )

    def test_emits_event(self, os_instance):
        ServiceOrderService.change_status(
            service_order=os_instance, new_status="initial_survey",
            changed_by="alice", notes="x",
        )
        evs = os_instance.events.filter(event_type="STATUS_CHANGE")
        assert evs.count() == 1
        ev = evs.first()
        assert ev.from_state == "reception"
        assert ev.to_state == "initial_survey"
        assert ev.actor == "alice"

    def test_auto_transition_event_type(self, os_instance):
        ServiceOrderService.change_status(
            service_order=os_instance, new_status="initial_survey",
            changed_by="Sistema", is_auto=True,
        )
        evs = os_instance.events.filter(event_type="AUTO_TRANSITION")
        assert evs.count() == 1

    def test_budget_entry_saves_previous_status(self, person):
        # Criar OS e avançar até repair
        os = ServiceOrder.objects.create(
            os_number="OS-PREV-1", customer=person,
            vehicle_plate="PRE1234", vehicle_description="Test",
            status="repair",
        )
        ServiceOrderService.change_status(
            service_order=os, new_status="budget",
            changed_by="Sistema", is_auto=True,
        )
        os.refresh_from_db()
        assert os.previous_status == "repair"


@pytest.mark.django_db
class TestDeliveryTrava:

    def test_cannot_deliver_particular_without_nfse(self, person):
        os = ServiceOrder.objects.create(
            os_number="OS-DEL-1", customer=person, customer_type="PARTICULAR",
            vehicle_plate="DEL1234", vehicle_description="x", status="ready",
        )
        with pytest.raises(ValidationError, match="NFS-e"):
            ServiceOrderService.change_status(
                service_order=os, new_status="delivered",
            )

    def test_seguradora_needs_autorizado_version(self, person):
        from apps.service_orders.models import Insurer
        yelum = Insurer.objects.get(code="yelum")
        os = ServiceOrder.objects.create(
            os_number="OS-DEL-2", customer=person, customer_type="SEGURADORA",
            insurer=yelum, casualty_number="SIN-99",
            vehicle_plate="DEL5678", vehicle_description="x",
            status="ready",
        )
        # Cria version pendente (não autorizada)
        ServiceOrderVersion.objects.create(
            service_order=os, version_number=1, source="cilia", status="em_analise",
        )
        with pytest.raises(ValidationError, match="autorizada"):
            ServiceOrderService.change_status(
                service_order=os, new_status="delivered",
            )

    def test_seguradora_delivers_when_autorizado(self, person):
        from apps.service_orders.models import Insurer
        yelum = Insurer.objects.get(code="yelum")
        os = ServiceOrder.objects.create(
            os_number="OS-DEL-3", customer=person, customer_type="SEGURADORA",
            insurer=yelum, casualty_number="SIN-100",
            vehicle_plate="DEL9999", vehicle_description="x",
            status="ready",
        )
        ServiceOrderVersion.objects.create(
            service_order=os, version_number=1, source="cilia", status="autorizado",
        )
        # Não raise
        ServiceOrderService.change_status(service_order=os, new_status="delivered")
        os.refresh_from_db()
        assert os.status == "delivered"
```

- [ ] **Step 8.2: Implementar change_status + _can_deliver**

Adicionar em `apps/service_orders/services.py`:

```python
    @classmethod
    @transaction.atomic
    def change_status(
        cls,
        *,
        service_order: ServiceOrder,
        new_status: str,
        changed_by: str = "Sistema",
        notes: str = "",
        is_auto: bool = False,
    ) -> ServiceOrder:
        """Valida transição, muda status, loga evento, aplica travas."""
        current = service_order.status
        allowed = VALID_TRANSITIONS.get(current, [])
        if new_status not in allowed:
            raise ValidationError({
                "status": f"Transição inválida: {current} → {new_status}. Permitidos: {allowed}",
            })

        # Trava: delivery exige NFS-e (particular) ou versão autorizada (seguradora)
        if new_status == "delivered":
            ok, reason = cls._can_deliver(service_order)
            if not ok:
                raise ValidationError({"delivery": reason})

        # Ao entrar em 'budget' a partir de estado de reparo, salva previous_status
        if new_status == "budget" and current in STATES_WITH_BUDGET_REENTRY:
            service_order.previous_status = current

        service_order.status = new_status
        service_order.save(update_fields=["status", "previous_status", "updated_at"])

        OSEventLogger.log_event(
            service_order,
            "AUTO_TRANSITION" if is_auto else "STATUS_CHANGE",
            actor=changed_by,
            from_state=current, to_state=new_status,
            payload={"notes": notes} if notes else {},
        )
        return service_order

    @classmethod
    def _can_deliver(cls, os: ServiceOrder) -> tuple[bool, str]:
        """Aplica trava antes de ready → delivered."""
        if os.customer_type == "PARTICULAR":
            # TODO(ciclo-5): verificar FiscalDocument NFSE issued
            # Ciclo 2 stub: olha se há Payment com fiscal_doc_ref (sinaliza emissão)
            # Como fiscal ainda não existe, reusa regra simples: rejeita se não houver
            # payment.fiscal_doc_ref preenchido.
            from apps.payments.models import Payment
            has_nfse = Payment.objects.filter(
                service_order=os, payer_block="PARTICULAR",
                fiscal_doc_ref__gt="",
            ).exists()
            if not has_nfse:
                return False, "NFS-e pendente — emitir antes da entrega"
        else:  # SEGURADORA
            active = os.active_version
            if not active or active.status != "autorizado":
                return False, (
                    f"Versão {active.external_version if active else '?'} não autorizada"
                )
        return True, ""
```

- [ ] **Step 8.3: Rodar**

Expected: todos tests PASS.

- [ ] **Step 8.4: Commit**

```bash
git add backend/core/apps/service_orders/
git commit -m "feat(service_orders): change_status atômico + trava delivery + evento"
```

---

## Task 9: `ServiceOrderService.create_new_version_from_import` + `approve_version`

**Files:**
- Modify: `backend/core/apps/service_orders/services.py`
- Modify: `backend/core/apps/service_orders/tests/test_service_orders_service.py`

> **Nota**: `create_new_version_from_import` recebe um `parsed_budget: ParsedBudget` (dataclass do Ciclo 4). Neste ciclo, vamos criar um mock ParsedBudget pra teste; interface preparada mas parser real fica pro Ciclo 4.

- [ ] **Step 9.1: Testes**

Adicionar em `test_service_orders_service.py`:

```python
from dataclasses import dataclass, field
from decimal import Decimal


@dataclass
class _FakeParsedBudget:
    """Mock do ParsedBudget (dataclass real fica no Ciclo 4)."""
    source: str = "cilia"
    external_version: str = ""
    external_numero_vistoria: str = ""
    external_integration_id: str = ""
    external_status: str = "analisado"
    hourly_rates: dict = field(default_factory=dict)
    global_discount_pct: Decimal = Decimal("0")
    raw_hash: str = ""


@pytest.mark.django_db
class TestCreateNewVersionFromImport:

    def _make_os_seguradora(self, person):
        from apps.service_orders.models import Insurer
        yelum = Insurer.objects.get(code="yelum")
        return ServiceOrder.objects.create(
            os_number="OS-IMP-1", customer=person, customer_type="SEGURADORA",
            insurer=yelum, casualty_number="SIN-IMP-1",
            external_budget_number="821980",
            vehicle_plate="IMP1234", vehicle_description="Kicks",
            status="reception",
        )

    def test_creates_version_numbered_next(self, person):
        os = self._make_os_seguradora(person)
        ServiceOrderVersion.objects.create(
            service_order=os, version_number=1, source="cilia",
            external_version="821980.1", status="analisado",
        )

        parsed = _FakeParsedBudget(
            source="cilia", external_version="821980.2",
            external_status="analisado", raw_hash="abc",
        )

        new_v = ServiceOrderService.create_new_version_from_import(
            service_order=os, parsed_budget=parsed, import_attempt=None,
        )
        assert new_v.version_number == 2
        assert new_v.external_version == "821980.2"

    def test_emits_version_created_and_import_events(self, person):
        os = self._make_os_seguradora(person)
        parsed = _FakeParsedBudget(external_version="821980.1", raw_hash="h")
        ServiceOrderService.create_new_version_from_import(
            service_order=os, parsed_budget=parsed, import_attempt=None,
        )
        assert os.events.filter(event_type="VERSION_CREATED").exists()
        assert os.events.filter(event_type="IMPORT_RECEIVED").exists()

    def test_pauses_os_in_budget_if_not_reception(self, person):
        os = self._make_os_seguradora(person)
        os.status = "repair"
        os.save()

        parsed = _FakeParsedBudget(external_version="821980.2", raw_hash="h")
        ServiceOrderService.create_new_version_from_import(
            service_order=os, parsed_budget=parsed, import_attempt=None,
        )
        os.refresh_from_db()
        assert os.status == "budget"
        assert os.previous_status == "repair"

    def test_does_not_pause_if_already_in_budget(self, person):
        os = self._make_os_seguradora(person)
        os.status = "budget"
        os.save()
        parsed = _FakeParsedBudget(external_version="821980.2", raw_hash="h")
        ServiceOrderService.create_new_version_from_import(
            service_order=os, parsed_budget=parsed, import_attempt=None,
        )
        os.refresh_from_db()
        assert os.status == "budget"


@pytest.mark.django_db
class TestApproveVersion:

    def _setup(self, person):
        from apps.service_orders.models import Insurer
        yelum = Insurer.objects.get(code="yelum")
        os = ServiceOrder.objects.create(
            os_number="OS-APV-1", customer=person, customer_type="SEGURADORA",
            insurer=yelum, casualty_number="SIN-APV-1",
            vehicle_plate="APV1234", vehicle_description="x",
            status="budget",
            previous_status="repair",
        )
        v = ServiceOrderVersion.objects.create(
            service_order=os, version_number=1, source="cilia",
            external_version="999999.1", status="em_analise",
        )
        return os, v

    def test_approve_seguradora_marks_autorizado(self, person):
        os, v = self._setup(person)
        ServiceOrderService.approve_version(version=v, approved_by="manager")
        v.refresh_from_db()
        assert v.status == "autorizado"
        assert v.approved_at is not None

    def test_approve_returns_os_to_previous_status(self, person):
        os, v = self._setup(person)
        ServiceOrderService.approve_version(version=v, approved_by="manager")
        os.refresh_from_db()
        assert os.status == "repair"  # voltou

    def test_approve_particular_uses_approved_status(self, person):
        os = ServiceOrder.objects.create(
            os_number="OS-APV-2", customer=person, customer_type="PARTICULAR",
            vehicle_plate="APV5678", vehicle_description="x",
            status="budget",
            previous_status="",  # particular sem previous
        )
        v = ServiceOrderVersion.objects.create(
            service_order=os, version_number=1, source="manual", status="pending",
        )
        ServiceOrderService.approve_version(version=v, approved_by="alice")
        v.refresh_from_db()
        assert v.status == "approved"

    def test_approve_supersedes_others(self, person):
        os, v1 = self._setup(person)
        v2 = ServiceOrderVersion.objects.create(
            service_order=os, version_number=2, source="cilia",
            external_version="999999.2", status="em_analise",
        )
        ServiceOrderService.approve_version(version=v2, approved_by="manager")
        v1.refresh_from_db()
        assert v1.status == "superseded"
```

- [ ] **Step 9.2: Implementar**

Adicionar em `apps/service_orders/services.py`:

```python
    @classmethod
    @transaction.atomic
    def create_new_version_from_import(
        cls,
        *,
        service_order: ServiceOrder,
        parsed_budget,  # ParsedBudget (Ciclo 4); usamos typing loose aqui
        import_attempt=None,
    ) -> ServiceOrderVersion:
        """Cria nova ServiceOrderVersion a partir de um parse de importação.

        Se OS estiver em estado de reparo (não reception/budget/terminal), pausa em 'budget'
        para consultor revisar antes de aceitar.
        """
        next_num = 1
        if service_order.active_version:
            next_num = service_order.active_version.version_number + 1

        version = ServiceOrderVersion.objects.create(
            service_order=service_order,
            version_number=next_num,
            source=parsed_budget.source,
            external_version=getattr(parsed_budget, "external_version", ""),
            external_numero_vistoria=getattr(parsed_budget, "external_numero_vistoria", ""),
            external_integration_id=getattr(parsed_budget, "external_integration_id", ""),
            status=getattr(parsed_budget, "external_status", "analisado"),
            content_hash=getattr(parsed_budget, "raw_hash", ""),
            raw_payload_s3_key=(
                import_attempt.raw_payload_s3_key if import_attempt else ""
            ),
            hourly_rates=getattr(parsed_budget, "hourly_rates", {}),
            global_discount_pct=getattr(parsed_budget, "global_discount_pct", Decimal("0")),
        )

        # TODO(Ciclo 4): ImportService.persist_items(parsed_budget=parsed_budget, version=version)
        # Ciclo 2 mantém itens vazios; Ciclo 4 popula

        OSEventLogger.log_event(
            service_order, "VERSION_CREATED",
            payload={
                "version": next_num,
                "source": parsed_budget.source,
                "external": getattr(parsed_budget, "external_version", ""),
            },
        )
        OSEventLogger.log_event(
            service_order, "IMPORT_RECEIVED",
            payload={
                "source": parsed_budget.source,
                "attempt_id": import_attempt.pk if import_attempt else None,
            },
        )

        # Pausa se OS estava em reparo (não reception, não budget, não terminal)
        non_pausable = {"reception", "budget", "delivered", "cancelled",
                        "ready", "final_survey"}
        if service_order.status not in non_pausable:
            cls.change_status(
                service_order=service_order, new_status="budget",
                changed_by="Sistema",
                notes=f"Nova versão importada: {version.status_label}",
                is_auto=True,
            )
        return version

    @classmethod
    @transaction.atomic
    def approve_version(
        cls,
        *,
        version: ServiceOrderVersion,
        approved_by: str,
    ) -> ServiceOrderVersion:
        """Aprova versão da OS. Se OS está em 'budget', retorna ao previous_status."""
        os = version.service_order
        # Status depende do customer_type
        version.status = "autorizado" if os.customer_type == "SEGURADORA" else "approved"
        version.approved_at = timezone.now()
        version.save(update_fields=["status", "approved_at"])

        # Supersede outras
        os.versions.exclude(pk=version.pk).exclude(
            status__in=["autorizado", "approved", "rejected", "negado", "superseded"],
        ).update(status="superseded")

        OSEventLogger.log_event(
            os, "VERSION_APPROVED",
            actor=approved_by,
            payload={"version": version.version_number},
        )

        # Se OS está em 'budget' por causa de pausa, retorna ao previous_status
        if os.status == "budget" and os.previous_status:
            cls.change_status(
                service_order=os, new_status=os.previous_status,
                changed_by="Sistema",
                notes=f"Auto: versão {version.version_number} aprovada, retomando",
                is_auto=True,
            )

        return version
```

Adicionar imports no topo: `from django.utils import timezone`.

- [ ] **Step 9.3: Rodar tests**

Expected: 7 novos tests PASS.

- [ ] **Step 9.4: Commit**

```bash
git add backend/core/apps/service_orders/
git commit -m "feat(service_orders): create_new_version_from_import + approve_version com auto-return"
```

---

## Task 10: `ComplementoParticularService`

**Files:**
- Modify: `backend/core/apps/service_orders/services.py`
- Modify: `backend/core/apps/service_orders/tests/test_service_orders_service.py`

- [ ] **Step 10.1: Testes**

```python
@pytest.mark.django_db
class TestComplementoParticularService:

    def _setup_os_seguradora(self, person):
        from apps.service_orders.models import Insurer
        yelum = Insurer.objects.get(code="yelum")
        os = ServiceOrder.objects.create(
            os_number="OS-CPL-1", customer=person, customer_type="SEGURADORA",
            insurer=yelum, casualty_number="SIN-CPL",
            vehicle_plate="CPL1234", vehicle_description="x",
            status="repair", previous_status="",
        )
        v1 = ServiceOrderVersion.objects.create(
            service_order=os, version_number=1, source="cilia",
            external_version="100000.1", status="autorizado",
            net_total=Decimal("5000"), labor_total=Decimal("1000"),
            parts_total=Decimal("4000"),
        )
        from apps.service_orders.models import ServiceOrderVersionItem
        ServiceOrderVersionItem.objects.create(
            version=v1, description="PEÇA SEGURADORA",
            payer_block="SEGURADORA",
            quantity=Decimal("1"), unit_price=Decimal("4000"), net_price=Decimal("4000"),
        )
        return os, v1

    def test_add_complement_creates_new_version(self, person):
        from apps.service_orders.services import ComplementoParticularService
        os, v1 = self._setup_os_seguradora(person)
        new_v = ComplementoParticularService.add_complement(
            service_order=os,
            items_data=[
                {
                    "description": "PINTURA EXTRA",
                    "quantity": Decimal("1"),
                    "unit_price": Decimal("300"),
                    "net_price": Decimal("300"),
                    "item_type": "SERVICE",
                }
            ],
            approved_by="alice",
        )
        assert new_v.version_number == 2
        # Item seguradora copiado + 1 item complemento
        assert new_v.items.count() == 2

    def test_complement_item_has_correct_payer_block(self, person):
        from apps.service_orders.services import ComplementoParticularService
        os, _ = self._setup_os_seguradora(person)
        new_v = ComplementoParticularService.add_complement(
            service_order=os,
            items_data=[{
                "description": "X", "quantity": Decimal("1"),
                "unit_price": Decimal("100"), "net_price": Decimal("100"),
                "item_type": "SERVICE",
            }],
            approved_by="alice",
        )
        complements = new_v.items.filter(payer_block="COMPLEMENTO_PARTICULAR")
        assert complements.count() == 1

    def test_complement_only_on_seguradora(self, person):
        from apps.service_orders.services import ComplementoParticularService
        os = ServiceOrder.objects.create(
            os_number="OS-CPL-PART", customer=person, customer_type="PARTICULAR",
            vehicle_plate="X", vehicle_description="y",
        )
        with pytest.raises(ValidationError):
            ComplementoParticularService.add_complement(
                service_order=os,
                items_data=[{
                    "description": "X", "quantity": Decimal("1"),
                    "unit_price": Decimal("100"), "net_price": Decimal("100"),
                }],
                approved_by="alice",
            )
```

- [ ] **Step 10.2: Implementar**

Em `apps/service_orders/services.py`, adicionar no final:

```python
class ComplementoParticularService:
    """Adiciona itens de complemento particular a OS-seguradora existente.

    Complemento cria nova versão da OS, copiando itens da anterior e adicionando
    os complementos com payer_block=COMPLEMENTO_PARTICULAR. A nova versão entra
    em status 'approved' diretamente (cliente já aprovou verbalmente/WhatsApp).
    """

    @classmethod
    @transaction.atomic
    def add_complement(
        cls,
        *,
        service_order: ServiceOrder,
        items_data: list[dict],
        approved_by: str,
    ) -> ServiceOrderVersion:
        if service_order.customer_type != "SEGURADORA":
            raise ValidationError({
                "customer_type": "Complemento particular só em OS seguradora. Para OS particular, use BudgetService.",
            })

        prev = service_order.active_version
        if prev is None:
            raise ValidationError({"version": "OS precisa ter pelo menos uma versão ativa"})

        next_num = prev.version_number + 1
        new_v = ServiceOrderVersion.objects.create(
            service_order=service_order,
            version_number=next_num,
            source="manual",
            status="approved",
            hourly_rates=prev.hourly_rates,
        )

        # Copia items anteriores
        ServiceOrderService._copy_items_from_version(source=prev, target=new_v)

        # Adiciona complementos
        for data in items_data:
            data_copy = dict(data)
            data_copy["payer_block"] = "COMPLEMENTO_PARTICULAR"
            ServiceOrderVersionItem.objects.create(version=new_v, **data_copy)

        # Recalcula totais
        ServiceOrderService._recalculate_totals(new_v)

        # Supersede anterior
        prev.status = "superseded"
        prev.save(update_fields=["status"])

        OSEventLogger.log_event(
            service_order, "VERSION_CREATED",
            actor=approved_by,
            payload={
                "version": next_num,
                "reason": "complemento_particular",
                "items_added": len(items_data),
            },
        )
        return new_v
```

Também adicionar `_copy_items_from_version` e `_recalculate_totals` ao `ServiceOrderService`:

```python
    @classmethod
    def _copy_items_from_version(cls, *, source, target) -> None:
        """Copia ServiceOrderVersionItem entre versões."""
        from apps.items.models import ItemOperation
        shared_fields = [
            "bucket", "payer_block", "impact_area", "item_type",
            "description", "external_code", "part_type", "supplier",
            "quantity", "unit_price", "unit_cost", "discount_pct", "net_price",
            "flag_abaixo_padrao", "flag_acima_padrao", "flag_inclusao_manual",
            "flag_codigo_diferente", "flag_servico_manual", "flag_peca_da_conta",
            "sort_order",
        ]
        for item in source.items.all().prefetch_related("operations"):
            new_item = ServiceOrderVersionItem.objects.create(
                version=target,
                **{f: getattr(item, f) for f in shared_fields},
            )
            for op in item.operations.all():
                ItemOperation.objects.create(
                    item_so=new_item,
                    operation_type=op.operation_type,
                    labor_category=op.labor_category,
                    hours=op.hours,
                    hourly_rate=op.hourly_rate,
                    labor_cost=op.labor_cost,
                )

    @classmethod
    def _recalculate_totals(cls, version: ServiceOrderVersion) -> None:
        """Calcula totais + totais-por-bloco da versão."""
        labor = Decimal("0")
        parts = Decimal("0")
        subtotal = Decimal("0")
        discount = Decimal("0")
        seguradora = Decimal("0")
        complemento = Decimal("0")
        franquia = Decimal("0")

        items = version.items.all().prefetch_related("operations")
        for item in items:
            gross = item.unit_price * item.quantity
            item_discount = gross - item.net_price
            discount += item_discount
            if item.item_type == "PART":
                parts += item.net_price
            subtotal += item.net_price
            if item.payer_block == "SEGURADORA":
                seguradora += item.net_price
            elif item.payer_block == "COMPLEMENTO_PARTICULAR":
                complemento += item.net_price
            elif item.payer_block == "FRANQUIA":
                franquia += item.net_price
            for op in item.operations.all():
                labor += op.labor_cost

        version.labor_total = labor
        version.parts_total = parts
        version.subtotal = subtotal + labor
        version.discount_total = discount
        version.net_total = version.subtotal - version.discount_total
        version.total_seguradora = seguradora
        version.total_complemento_particular = complemento
        version.total_franquia = franquia
        version.save(update_fields=[
            "labor_total", "parts_total", "subtotal", "discount_total",
            "net_total", "total_seguradora", "total_complemento_particular",
            "total_franquia",
        ])
```

- [ ] **Step 10.3: Rodar**

Expected: 3 novos tests PASS.

- [ ] **Step 10.4: Commit**

```bash
git add backend/core/apps/service_orders/
git commit -m "feat(service_orders): ComplementoParticularService + helpers _copy_items/_recalculate"
```

---

## Task 11: Smoke integration test + MVP_CHECKLIST

**Files:**
- Create: `backend/core/scripts/smoke_ciclo2.py`
- Modify: `backend/core/MVP_CHECKLIST.md`
- Modify: `backend/core/README.md`

- [ ] **Step 11.1: Smoke**

```python
# backend/core/scripts/smoke_ciclo2.py
"""Smoke test integration do Ciclo 02 — Core Services.

Exercita:
- BudgetService (create + send + approve → cria OS)
- ServiceOrderService (change_status + trava delivery)
- ComplementoParticularService
- PaymentService
- OSEventLogger (timeline consistente)

Uso: python manage.py shell < scripts/smoke_ciclo2.py
"""
from decimal import Decimal

from apps.budgets.services import BudgetService
from apps.budgets.models import BudgetVersionItem
from apps.items.models import ItemOperation, ItemOperationType, LaborCategory
from apps.payments.services import PaymentService
from apps.persons.models import Person
from apps.service_orders.models import Insurer, ServiceOrder, ServiceOrderVersion
from apps.service_orders.services import ComplementoParticularService, ServiceOrderService


def check(cond: bool, msg: str) -> None:
    status = "OK" if cond else "FAIL"
    print(f"[{status}] {msg}")
    assert cond, msg


def main() -> None:
    print("=== Smoke Ciclo 02 ===\n")

    person, _ = Person.objects.get_or_create(
        full_name="Smoke C2", defaults={"person_type": "CLIENT"},
    )

    # 1) Budget particular completo
    budget = BudgetService.create(
        customer=person, vehicle_plate="SMC1234",
        vehicle_description="Honda Fit C2", created_by="smoke",
    )
    v = budget.active_version
    item = BudgetVersionItem.objects.create(
        version=v, description="TESTE",
        quantity=Decimal("1"), unit_price=Decimal("1000"),
        net_price=Decimal("1000"), item_type="PART",
    )
    ItemOperation.objects.create(
        item_budget=item,
        operation_type=ItemOperationType.objects.get(code="TROCA"),
        labor_category=LaborCategory.objects.get(code="FUNILARIA"),
        hours=Decimal("2"), hourly_rate=Decimal("40"), labor_cost=Decimal("80"),
    )
    BudgetService.send_to_customer(version=v, sent_by="smoke")
    v.refresh_from_db()
    check(v.net_total == Decimal("1080"), f"Budget net_total={v.net_total}")

    # 2) Approve → OS particular criada
    os = BudgetService.approve(
        version=v, approved_by="smoke", evidence_s3_key="whatsapp://ok",
    )
    check(os.customer_type == "PARTICULAR", "OS particular criada")
    check(os.source_budget == budget, "OS amarrada ao budget")
    check(os.active_version.items.count() == 1, "Items copiados")

    # 3) Transição Kanban
    ServiceOrderService.change_status(
        service_order=os, new_status="initial_survey", changed_by="smoke",
    )
    check(os.events.filter(event_type="STATUS_CHANGE").count() == 1, "Evento STATUS_CHANGE")

    # 4) OS Seguradora com complemento
    yelum = Insurer.objects.get(code="yelum")
    os_seg = ServiceOrder.objects.create(
        os_number="SMOKE-SEG-1", customer=person, customer_type="SEGURADORA",
        insurer=yelum, casualty_number="SMOKE-CPL-1",
        vehicle_plate="SEG1234", vehicle_description="x", status="repair",
    )
    ServiceOrderVersion.objects.create(
        service_order=os_seg, version_number=1, source="cilia",
        external_version="111.1", status="autorizado",
        net_total=Decimal("2000"),
    )

    new_v = ComplementoParticularService.add_complement(
        service_order=os_seg,
        items_data=[{
            "description": "EXTRA",
            "quantity": Decimal("1"), "unit_price": Decimal("200"),
            "net_price": Decimal("200"), "item_type": "SERVICE",
        }],
        approved_by="smoke",
    )
    check(new_v.version_number == 2, "Complemento cria v2")
    check(new_v.total_complemento_particular == Decimal("200"), "Total complemento correto")

    # 5) Payment
    p = PaymentService.record(
        service_order=os_seg, payer_block="COMPLEMENTO_PARTICULAR",
        amount=Decimal("200"), method="PIX",
        reference="pix-smoke", received_by="smoke",
    )
    check(p.status == "received", "Payment received")
    check(os_seg.events.filter(event_type="PAYMENT_RECORDED").count() == 1, "Payment event")

    # Cleanup
    os.delete()
    os_seg.delete()
    budget.delete()
    print("\n[DONE] Ciclo 02 smoke OK")


main()
```

- [ ] **Step 11.2: Atualizar MVP_CHECKLIST**

Em `backend/core/MVP_CHECKLIST.md`, adicionar seção:

```markdown
## Entregue no ciclo 4 — Módulo de Orçamentação (Core Services)

- [x] `OSEventLogger` helper centralizado para timeline
- [x] `kanban.py` com `VALID_TRANSITIONS` + re-entrada em budget dos estados de reparo
- [x] `BudgetService`: create, send_to_customer, approve, reject, request_revision, clone
- [x] Celery task `expire_stale_budgets` (beat diário)
- [x] `ServiceOrderService`: change_status atômico, _can_deliver (trava NFS-e particular / autorizado seguradora), create_from_budget, create_new_version_from_import, approve_version com auto-return
- [x] `ComplementoParticularService.add_complement` com copy de items + recalculate totais por bloco
- [x] App `payments` com Payment model + PaymentService.record
- [x] ~130 testes PASS (60 Ciclo 01 + ~70 Ciclo 02)
- [x] Smoke integration `scripts/smoke_ciclo2.py`

## Próximo ciclo — API + Frontend base (Ciclo 3)

- [ ] ViewSets DRF + serializers (Budget, OS, Payment)
- [ ] Endpoints REST conforme §8 da spec
- [ ] Frontend Next.js consumindo API real
- [ ] PDF engine real (WeasyPrint) substituindo pdf_stub
- [ ] Zod schemas frontend
```

- [ ] **Step 11.3: Atualizar README**

Adicionar seção "Services disponíveis após Ciclo 02":

```markdown
### Services — Ciclo 02

\`\`\`python
from apps.budgets.services import BudgetService
from apps.service_orders.services import ServiceOrderService, ComplementoParticularService
from apps.payments.services import PaymentService
from apps.service_orders.events import OSEventLogger

# Fluxo particular completo
budget = BudgetService.create(customer=person, vehicle_plate="ABC", vehicle_description="x", created_by="alice")
# ... adicionar items
BudgetService.send_to_customer(version=budget.active_version, sent_by="alice")
os = BudgetService.approve(version=budget.active_version, approved_by="cliente", evidence_s3_key="whatsapp://ok.jpg")

# Kanban
ServiceOrderService.change_status(service_order=os, new_status="initial_survey", changed_by="alice")

# Complemento em OS-seguradora
new_v = ComplementoParticularService.add_complement(
    service_order=os_seg,
    items_data=[{"description": "extra", ...}],
    approved_by="alice",
)

# Pagamento
PaymentService.record(service_order=os, payer_block="PARTICULAR", amount=Decimal("1000"), method="PIX", received_by="alice")

# Evento manual
OSEventLogger.log_event(os, "PHOTO_UPLOADED", actor="alice", payload={"s3_key": "..."})
\`\`\`

### Task Celery

\`\`\`bash
# Expire budgets vencidos (1x/dia via beat)
celery -A config call apps.budgets.tasks.expire_stale_budgets
\`\`\`
```

- [ ] **Step 11.4: Rodar suite completa**

```bash
DATABASE_URL="postgresql://paddock:paddock@localhost:5432/paddock_dev" pytest apps/ -v --tb=line
```

Expected: todos PASS (60 do Ciclo 1 + ~60-70 do Ciclo 2).

- [ ] **Step 11.5: Commit final**

```bash
git add backend/core/
git commit -m "chore(ciclo-02): smoke integration + checklist + README atualizados"
```

---

## Verificação final

- [ ] `pytest apps/ -v` passa tudo
- [ ] `python manage.py check` passa
- [ ] `python manage.py makemigrations --check --dry-run` diz "No changes detected"
- [ ] Smoke script roda ✅ em todos os passos (quando DB disponível)
- [ ] `git log` mostra ~11 commits incrementais
- [ ] CLAUDE.md honrado: type hints, sem print, soft-delete, @transaction.atomic em services

---

## Notas pro Ciclo 3

Arquivos que serão criados no Ciclo 3 (API + Frontend):
- `apps/budgets/serializers.py` + `viewsets.py`
- `apps/service_orders/serializers.py` + `viewsets.py`
- `apps/payments/serializers.py` + `viewsets.py`
- `apps/pdf_engine/` — WeasyPrint real
- `apps/dscar-web/src/api/budgets.ts` + hooks + schemas Zod
- `apps/dscar-web/src/components/Budget*.tsx`

Dependências prontas do Ciclo 02:
- Services completos e testados ✓
- Event logging consistente ✓
- Trava de delivery ✓
- Auto-return pós-approval ✓

**Fim do Plano Ciclo 02.**
