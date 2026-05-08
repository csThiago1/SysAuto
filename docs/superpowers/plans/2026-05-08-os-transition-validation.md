# OS Transition Validation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 3-tier validation (hard block / soft block / warning) for all OS status transitions, with override mechanism for soft blocks via presencial credentials or async notification.

**Architecture:** `TransitionValidator` service class validates business rules per transition. `TransitionOverrideRequest` model tracks override requests. Validation results are pre-loaded in the OS detail serializer (`transition_requirements` field) so frontend has everything on GET. Override flows use existing push notification infrastructure.

**Tech Stack:** Django 5 + DRF (backend), React/Next.js (web), React Native/Expo (mobile), Celery (expiration task), Expo Push (notifications)

**Spec:** `docs/superpowers/specs/2026-05-08-os-transition-validation-design.md`

---

## File Structure

### Backend — New files
| File | Responsibility |
|------|---------------|
| `backend/core/apps/service_orders/transition_validator.py` | `TransitionValidator` class — all validation rules |
| `backend/core/apps/service_orders/tests/test_transition_validator.py` | Unit tests for every validation rule |
| `backend/core/apps/service_orders/tests/test_override.py` | Tests for override request flow |
| `backend/core/apps/service_orders/migrations/0029_transition_override_request.py` | Migration for new model |

### Backend — Modified files
| File | Changes |
|------|---------|
| `backend/core/apps/service_orders/models.py` | Add `TransitionOverrideRequest` model + new event types |
| `backend/core/apps/service_orders/services.py` | Integrate `TransitionValidator` into `transition()` |
| `backend/core/apps/service_orders/serializers.py` | Add `transition_requirements` to detail serializer, new override serializers |
| `backend/core/apps/service_orders/views.py` | Add override-request endpoints, modify transition endpoint |
| `backend/core/apps/service_orders/urls.py` | Register new endpoints |
| `backend/core/apps/service_orders/tasks.py` | Add expiration task + override notification task |
| `packages/types/src/service-order.types.ts` | Add TypeScript types for validation result + override |

---

## Task 1: TransitionOverrideRequest Model + Migration

**Files:**
- Modify: `backend/core/apps/service_orders/models.py` (append after `ImpactAreaLabel` class, ~line 1712)
- Create: `backend/core/apps/service_orders/migrations/0029_transition_override_request.py` (auto-generated)

- [ ] **Step 1: Add the model to models.py**

Append at the end of `backend/core/apps/service_orders/models.py`:

```python
# ── Override de Transição ─────────────────────────────────────────────────────


class TransitionOverrideRequest(PaddockBaseModel):
    """Solicitação de override para transição bloqueada por soft block.

    Criado quando um CONSULTANT tenta avançar mas tem soft blocks.
    Resolvido por um MANAGER+ (presencial ou assíncrono via notificação).
    Expira automaticamente após 24h se não resolvido.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        APPROVED = "approved", "Aprovado"
        REJECTED = "rejected", "Rejeitado"
        EXPIRED = "expired", "Expirado"

    service_order = models.ForeignKey(
        ServiceOrder,
        on_delete=models.CASCADE,
        related_name="override_requests",
        verbose_name="OS",
    )
    from_status = models.CharField(max_length=20, verbose_name="Status atual")
    to_status = models.CharField(max_length=20, verbose_name="Status desejado")
    requested_by = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.PROTECT,
        related_name="override_requests_made",
        verbose_name="Solicitado por",
    )
    approved_by = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="override_requests_resolved",
        verbose_name="Resolvido por",
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
        verbose_name="Status",
    )
    blocks_snapshot = models.JSONField(
        default=list,
        help_text="Soft blocks no momento da solicitação",
    )
    request_reason = models.TextField(verbose_name="Motivo da solicitação")
    justification = models.TextField(
        blank=True, default="", verbose_name="Justificativa do gerente"
    )
    resolved_at = models.DateTimeField(null=True, blank=True, verbose_name="Resolvido em")
    expires_at = models.DateTimeField(verbose_name="Expira em")

    class Meta:
        db_table = "service_orders_override_request"
        ordering = ["-created_at"]
        verbose_name = "Solicitação de Override"
        verbose_name_plural = "Solicitações de Override"
        indexes = [
            models.Index(fields=["service_order", "status"]),
            models.Index(fields=["status", "expires_at"]),
        ]

    def __str__(self) -> str:
        return (
            f"Override OS #{self.service_order.number}: "
            f"{self.from_status} → {self.to_status} ({self.status})"
        )
```

- [ ] **Step 2: Add new event types to ServiceOrderEvent**

In `backend/core/apps/service_orders/models.py`, find `EVENT_TYPES` list in `ServiceOrderEvent` class (~line 1603) and add these entries after `("COMPLEMENT_ADDED", "Complemento particular adicionado")`:

```python
        ("OVERRIDE_REQUESTED",   "Override solicitado"),
        ("OVERRIDE_APPROVED",    "Override aprovado"),
        ("OVERRIDE_REJECTED",    "Override rejeitado"),
```

- [ ] **Step 3: Generate migration**

Run: `cd /Users/thiagocampos/Documents/Projetos/grupo-dscar && python backend/core/manage.py makemigrations service_orders --name transition_override_request`
Expected: Migration file created in `backend/core/apps/service_orders/migrations/`

- [ ] **Step 4: Apply migration**

Run: `cd /Users/thiagocampos/Documents/Projetos/grupo-dscar && python backend/core/manage.py migrate_schemas`
Expected: Migration applied successfully

- [ ] **Step 5: Commit**

```bash
git add backend/core/apps/service_orders/models.py backend/core/apps/service_orders/migrations/0029_*
git commit -m "feat(service_orders): add TransitionOverrideRequest model + new event types"
```

---

## Task 2: TransitionValidator — Core Dataclass + Structure

**Files:**
- Create: `backend/core/apps/service_orders/transition_validator.py`
- Create: `backend/core/apps/service_orders/tests/test_transition_validator.py`

- [ ] **Step 1: Write failing test for ValidationResult dataclass**

Create `backend/core/apps/service_orders/tests/test_transition_validator.py`:

```python
"""Tests for TransitionValidator."""
import pytest

from apps.service_orders.transition_validator import ValidationBlock, ValidationResult


class TestValidationResult:
    def test_can_proceed_when_no_blocks(self):
        result = ValidationResult(
            hard_blocks=[],
            soft_blocks=[],
            warnings=[ValidationBlock(code="TEST", message="test warning")],
            has_pending_override=False,
        )
        assert result.can_proceed is True

    def test_cannot_proceed_with_hard_blocks(self):
        result = ValidationResult(
            hard_blocks=[ValidationBlock(code="TEST", message="blocked")],
            soft_blocks=[],
            warnings=[],
            has_pending_override=False,
        )
        assert result.can_proceed is False

    def test_cannot_proceed_with_soft_blocks(self):
        result = ValidationResult(
            hard_blocks=[],
            soft_blocks=[ValidationBlock(code="TEST", message="soft blocked")],
            warnings=[],
            has_pending_override=False,
        )
        assert result.can_proceed is False

    def test_to_dict(self):
        result = ValidationResult(
            hard_blocks=[ValidationBlock(code="A", message="hard")],
            soft_blocks=[],
            warnings=[ValidationBlock(code="B", message="warn")],
            has_pending_override=False,
        )
        d = result.to_dict()
        assert d["can_proceed"] is False
        assert len(d["hard_blocks"]) == 1
        assert d["hard_blocks"][0]["code"] == "A"
        assert len(d["warnings"]) == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/thiagocampos/Documents/Projetos/grupo-dscar && python -m pytest backend/core/apps/service_orders/tests/test_transition_validator.py::TestValidationResult -v --no-header 2>&1 | head -20`
Expected: FAIL — `ModuleNotFoundError: No module named 'apps.service_orders.transition_validator'`

- [ ] **Step 3: Write the dataclass + validator skeleton**

Create `backend/core/apps/service_orders/transition_validator.py`:

```python
"""
Paddock Solutions — OS Transition Validator

Valida pré-requisitos de negócio para transições de status.
3 níveis: hard_blocks (sem override), soft_blocks (MANAGER+ override), warnings (apenas alerta).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.service_orders.models import ServiceOrder

logger = logging.getLogger(__name__)


@dataclass
class ValidationBlock:
    """Um bloqueio ou aviso individual."""

    code: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return {"code": self.code, "message": self.message}


@dataclass
class ValidationResult:
    """Resultado da validação de uma transição."""

    hard_blocks: list[ValidationBlock] = field(default_factory=list)
    soft_blocks: list[ValidationBlock] = field(default_factory=list)
    warnings: list[ValidationBlock] = field(default_factory=list)
    has_pending_override: bool = False

    @property
    def can_proceed(self) -> bool:
        """True se não há hard blocks nem soft blocks."""
        return not self.hard_blocks and not self.soft_blocks

    def to_dict(self) -> dict:
        return {
            "can_proceed": self.can_proceed,
            "hard_blocks": [b.to_dict() for b in self.hard_blocks],
            "soft_blocks": [b.to_dict() for b in self.soft_blocks],
            "warnings": [w.to_dict() for w in self.warnings],
            "has_pending_override": self.has_pending_override,
        }


class TransitionValidator:
    """Valida pré-requisitos de negócio para transições de status da OS."""

    @classmethod
    def validate(
        cls,
        order: ServiceOrder,
        target_status: str,
    ) -> ValidationResult:
        """Valida pré-requisitos para transição order.status → target_status."""
        method_name = f"_validate_to_{target_status}"
        validator = getattr(cls, method_name, None)
        if validator is None:
            return ValidationResult()
        return validator(order)

    @classmethod
    def validate_all_targets(
        cls,
        order: ServiceOrder,
    ) -> dict[str, dict]:
        """Valida todos os targets permitidos — usado pelo serializer de detalhe."""
        from apps.service_orders.models import VALID_TRANSITIONS

        allowed = VALID_TRANSITIONS.get(order.status, [])
        results: dict[str, dict] = {}
        for target in allowed:
            result = cls.validate(order, target)
            # Verificar se tem override pendente para este target
            result.has_pending_override = cls._has_pending_override(order, target)
            results[target] = result.to_dict()
        return results

    # ── Helpers ────────────────────────────────────────────────────────────────

    @staticmethod
    def _count_photos(order: ServiceOrder, folders: list[str]) -> int:
        """Conta fotos ativas nas pastas especificadas."""
        return order.photos.filter(folder__in=folders, is_active=True).count()

    @staticmethod
    def _has_signature(order: ServiceOrder, doc_type: str) -> bool:
        """Verifica se existe assinatura do tipo especificado para a OS."""
        from apps.signatures.models import Signature

        return Signature.objects.filter(
            service_order=order, document_type=doc_type
        ).exists()

    @staticmethod
    def _has_pending_override(order: ServiceOrder, target_status: str) -> bool:
        """Verifica se existe override pendente para esta transição."""
        return order.override_requests.filter(
            to_status=target_status,
            status="pending",
        ).exists()

    @staticmethod
    def _has_checklist(order: ServiceOrder, checklist_type: str) -> bool:
        """Verifica se existe pelo menos 1 item de checklist do tipo."""
        return order.checklist_items.filter(checklist_type=checklist_type).exists()

    @staticmethod
    def _sector_has_timesheet(order: ServiceOrder) -> bool:
        """Verifica se há apontamento encerrado para o status/setor atual."""
        return order.apontamentos.filter(status="encerrado").exists()

    @staticmethod
    def _all_timesheets_closed(order: ServiceOrder) -> bool:
        """Verifica se todos os apontamentos da OS estão encerrados."""
        total = order.apontamentos.count()
        if total == 0:
            return True
        closed = order.apontamentos.filter(status="encerrado").count()
        return total == closed

    @staticmethod
    def _all_parts_received(order: ServiceOrder) -> bool:
        """Verifica se todas as peças estão recebidas ou bloqueadas."""
        total = order.parts.filter(is_active=True).count()
        if total == 0:
            return True
        received = order.parts.filter(
            is_active=True,
            status_peca__in=["bloqueada", "recebida"],
        ).count()
        return total == received

    @staticmethod
    def _parts_purchased(order: ServiceOrder) -> list[str]:
        """Retorna lista de descrições de peças de compra sem OC ou sem status >= comprada."""
        from apps.service_orders.models import ServiceOrderPart

        pending: list[str] = []
        for part in order.parts.filter(is_active=True, origem="compra"):
            if not part.pedido_compra_id:
                pending.append(f"{part.description} (sem pedido de compra)")
            elif part.status_peca not in ("comprada", "recebida", "bloqueada"):
                pending.append(f"{part.description} (status: {part.get_status_peca_display()})")
        return pending

    @staticmethod
    def _parts_incomplete(order: ServiceOrder) -> list[str]:
        """Retorna descrições de peças que não estão recebidas/bloqueadas."""
        pending: list[str] = []
        for part in order.parts.filter(is_active=True).exclude(
            status_peca__in=["bloqueada", "recebida"]
        ):
            pending.append(f"{part.description} ({part.get_status_peca_display()})")
        return pending

    @staticmethod
    def _has_nfce(order: ServiceOrder) -> bool:
        """Verifica se existe NFC-e autorizada vinculada à OS."""
        if hasattr(order, "fiscal_documents"):
            return order.fiscal_documents.filter(
                document_type="nfce", status="authorized"
            ).exists()
        return False

    @staticmethod
    def _has_receivables(order: ServiceOrder) -> bool:
        """Verifica se existem contas a receber geradas."""
        from apps.accounts_receivable.models import ReceivableDocument

        return ReceivableDocument.objects.filter(
            service_order_id=str(order.pk), is_active=True
        ).exists()

    @staticmethod
    def _complement_all_billed(order: ServiceOrder) -> bool:
        """Verifica se todos os itens de complemento particular estão faturados."""
        complement_parts = order.parts.filter(
            is_active=True, source_type="complement"
        )
        complement_labor = order.labor_items.filter(
            is_active=True, source_type="complement"
        )
        if not complement_parts.exists() and not complement_labor.exists():
            return True  # Sem complemento → OK
        parts_ok = not complement_parts.exclude(billing_status="billed").exists()
        labor_ok = not complement_labor.exclude(billing_status="billed").exists()
        return parts_ok and labor_ok
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/thiagocampos/Documents/Projetos/grupo-dscar && python -m pytest backend/core/apps/service_orders/tests/test_transition_validator.py::TestValidationResult -v --no-header 2>&1 | head -20`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/core/apps/service_orders/transition_validator.py backend/core/apps/service_orders/tests/test_transition_validator.py
git commit -m "feat(service_orders): add TransitionValidator skeleton + ValidationResult dataclass"
```

---

## Task 3: TransitionValidator — Validation Rules (reception → authorized)

**Files:**
- Modify: `backend/core/apps/service_orders/transition_validator.py`
- Modify: `backend/core/apps/service_orders/tests/test_transition_validator.py`

- [ ] **Step 1: Write failing tests for reception → initial_survey**

Append to `backend/core/apps/service_orders/tests/test_transition_validator.py`:

```python
from decimal import Decimal
from unittest.mock import MagicMock, PropertyMock, patch

from apps.service_orders.transition_validator import TransitionValidator, ValidationBlock


def _make_order(**kwargs):
    """Cria mock de ServiceOrder com defaults razoáveis."""
    order = MagicMock()
    order.status = kwargs.get("status", "reception")
    order.plate = kwargs.get("plate", "ABC1D23")
    order.make = kwargs.get("make", "Toyota")
    order.model = kwargs.get("model", "Corolla")
    order.customer_type = kwargs.get("customer_type", "private")
    order.customer_id = kwargs.get("customer_id", 1)
    order.customer_uuid = kwargs.get("customer_uuid", None)
    order.insurer_id = kwargs.get("insurer_id", None)
    order.insured_type = kwargs.get("insured_type", None)
    order.year = kwargs.get("year", 2024)
    order.color = kwargs.get("color", "Branco")
    order.fuel_type = kwargs.get("fuel_type", "Flex")
    order.mileage_in = kwargs.get("mileage_in", 50000)
    order.entry_date = kwargs.get("entry_date", None)
    order.authorization_date = kwargs.get("authorization_date", None)
    order.casualty_number = kwargs.get("casualty_number", "")
    order.deductible_amount = kwargs.get("deductible_amount", None)
    order.mileage_out = kwargs.get("mileage_out", None)
    # Mock related managers
    order.photos = MagicMock()
    order.parts = MagicMock()
    order.labor_items = MagicMock()
    order.checklist_items = MagicMock()
    order.apontamentos = MagicMock()
    order.override_requests = MagicMock()
    order.versions = MagicMock()
    return order


class TestValidateToInitialSurvey:
    def test_passes_with_complete_private_data(self):
        order = _make_order(customer_type="private")
        result = TransitionValidator.validate(order, "initial_survey")
        assert len(result.hard_blocks) == 0

    def test_hard_block_missing_plate(self):
        order = _make_order(plate="")
        result = TransitionValidator.validate(order, "initial_survey")
        codes = [b.code for b in result.hard_blocks]
        assert "VEHICLE_BASIC_DATA" in codes

    def test_hard_block_missing_customer_type(self):
        order = _make_order(customer_type=None)
        result = TransitionValidator.validate(order, "initial_survey")
        codes = [b.code for b in result.hard_blocks]
        assert "CUSTOMER_TYPE_SET" in codes

    def test_hard_block_missing_customer(self):
        order = _make_order(customer_id=None, customer_uuid=None)
        result = TransitionValidator.validate(order, "initial_survey")
        codes = [b.code for b in result.hard_blocks]
        assert "CUSTOMER_LINKED" in codes

    def test_hard_block_insurer_missing_data(self):
        order = _make_order(
            customer_type="insurer", insurer_id=None, insured_type=None
        )
        result = TransitionValidator.validate(order, "initial_survey")
        codes = [b.code for b in result.hard_blocks]
        assert "INSURER_DATA" in codes

    def test_warnings_for_missing_optional_fields(self):
        order = _make_order(year=None, color="", fuel_type="", mileage_in=None)
        result = TransitionValidator.validate(order, "initial_survey")
        codes = [w.code for w in result.warnings]
        assert "VEHICLE_YEAR" in codes
        assert "VEHICLE_COLOR" in codes
        assert "FUEL_TYPE" in codes
        assert "MILEAGE_IN" in codes
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/thiagocampos/Documents/Projetos/grupo-dscar && python -m pytest backend/core/apps/service_orders/tests/test_transition_validator.py::TestValidateToInitialSurvey -v --no-header 2>&1 | head -20`
Expected: FAIL — `_validate_to_initial_survey` returns empty `ValidationResult`

- [ ] **Step 3: Implement _validate_to_initial_survey**

In `backend/core/apps/service_orders/transition_validator.py`, add method to `TransitionValidator` class after the helpers section:

```python
    # ── Validators por transição ──────────────────────────────────────────────

    @classmethod
    def _validate_to_initial_survey(cls, order: ServiceOrder) -> ValidationResult:
        """reception → initial_survey"""
        hard: list[ValidationBlock] = []
        soft: list[ValidationBlock] = []
        warn: list[ValidationBlock] = []

        # HARD: dados básicos do veículo
        if not order.plate or not order.make or not order.model:
            missing = []
            if not order.plate:
                missing.append("placa")
            if not order.make:
                missing.append("marca")
            if not order.model:
                missing.append("modelo")
            hard.append(ValidationBlock(
                code="VEHICLE_BASIC_DATA",
                message=f"Dados do veículo incompletos: falta {', '.join(missing)}",
            ))

        # HARD: tipo de atendimento
        if not order.customer_type:
            hard.append(ValidationBlock(
                code="CUSTOMER_TYPE_SET",
                message="Tipo de atendimento não definido (seguradora ou particular)",
            ))

        # HARD: cliente vinculado
        if not order.customer_id and not order.customer_uuid:
            hard.append(ValidationBlock(
                code="CUSTOMER_LINKED",
                message="Cliente não vinculado à OS",
            ))

        # HARD: dados de seguradora
        if order.customer_type == "insurer":
            if not order.insurer_id or not order.insured_type:
                missing = []
                if not order.insurer_id:
                    missing.append("seguradora")
                if not order.insured_type:
                    missing.append("tipo de segurado")
                hard.append(ValidationBlock(
                    code="INSURER_DATA",
                    message=f"Dados de seguradora incompletos: falta {', '.join(missing)}",
                ))

        # WARN: campos opcionais
        if not order.year:
            warn.append(ValidationBlock(code="VEHICLE_YEAR", message="Ano do veículo não informado"))
        if not order.color:
            warn.append(ValidationBlock(code="VEHICLE_COLOR", message="Cor do veículo não informada"))
        if not order.fuel_type:
            warn.append(ValidationBlock(code="FUEL_TYPE", message="Combustível não informado"))
        if not order.mileage_in:
            warn.append(ValidationBlock(code="MILEAGE_IN", message="KM de entrada não informado"))

        return ValidationResult(hard_blocks=hard, soft_blocks=soft, warnings=warn)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/thiagocampos/Documents/Projetos/grupo-dscar && python -m pytest backend/core/apps/service_orders/tests/test_transition_validator.py::TestValidateToInitialSurvey -v --no-header 2>&1 | head -20`
Expected: 6 tests PASS

- [ ] **Step 5: Write failing tests for initial_survey → budget/waiting_auth**

Append to test file:

```python
class TestValidateToBudgetOrWaitingAuth:
    def test_soft_block_missing_photos(self):
        order = _make_order(status="initial_survey")
        order.photos.filter.return_value.count.return_value = 5
        result = TransitionValidator.validate(order, "budget")
        codes = [b.code for b in result.soft_blocks]
        assert "PHOTOS_MIN_12" in codes

    def test_passes_with_12_photos_vistoria(self):
        order = _make_order(status="initial_survey")
        order.photos.filter.return_value.count.return_value = 12
        order.entry_date = "2026-01-01"
        result = TransitionValidator.validate(order, "budget")
        assert len(result.soft_blocks) == 0

    def test_warn_no_entry_date(self):
        order = _make_order(status="initial_survey", entry_date=None)
        order.photos.filter.return_value.count.return_value = 12
        result = TransitionValidator.validate(order, "budget")
        codes = [w.code for w in result.warnings]
        assert "ENTRY_DATE_SET" in codes

    def test_waiting_auth_insurer_requires_pdf(self):
        order = _make_order(status="budget", customer_type="insurer")
        order.photos.filter.return_value.count.return_value = 12  # vistoria ok
        # Pasta orcamentos vazia
        def side_effect(*args, **kwargs):
            mock = MagicMock()
            folders = kwargs.get("folder__in", [])
            if "orcamentos" in folders:
                mock.count.return_value = 0
            else:
                mock.count.return_value = 12
            return mock
        order.photos.filter.side_effect = side_effect
        result = TransitionValidator.validate(order, "waiting_auth")
        codes = [b.code for b in result.hard_blocks]
        assert "BUDGET_PDF_INSURER" in codes

    def test_waiting_auth_private_requires_items(self):
        order = _make_order(status="budget", customer_type="private")
        order.photos.filter.return_value.count.return_value = 12
        order.parts.filter.return_value.exists.return_value = False
        order.labor_items.filter.return_value.exists.return_value = False
        result = TransitionValidator.validate(order, "waiting_auth")
        codes = [b.code for b in result.hard_blocks]
        assert "BUDGET_ITEMS_PRIVATE" in codes
```

- [ ] **Step 6: Implement _validate_to_budget and _validate_to_waiting_auth**

Add to `TransitionValidator`:

```python
    @classmethod
    def _validate_to_budget(cls, order: ServiceOrder) -> ValidationResult:
        """initial_survey → budget (ou retorno de oficina → budget via importação)"""
        hard: list[ValidationBlock] = []
        soft: list[ValidationBlock] = []
        warn: list[ValidationBlock] = []

        # SOFT: mínimo 12 fotos (vistoria_inicial OU checklist_entrada)
        photo_count = cls._count_photos(order, ["vistoria_inicial", "checklist_entrada"])
        if photo_count < 12:
            soft.append(ValidationBlock(
                code="PHOTOS_MIN_12",
                message=f"Fotos de vistoria: {photo_count}/12 (faltam {12 - photo_count})",
            ))

        # WARN: data de entrada
        if not order.entry_date:
            warn.append(ValidationBlock(
                code="ENTRY_DATE_SET",
                message="Data de entrada do veículo não preenchida",
            ))

        return ValidationResult(hard_blocks=hard, soft_blocks=soft, warnings=warn)

    @classmethod
    def _validate_to_waiting_auth(cls, order: ServiceOrder) -> ValidationResult:
        """budget → waiting_auth (ou initial_survey → waiting_auth)"""
        hard: list[ValidationBlock] = []
        soft: list[ValidationBlock] = []
        warn: list[ValidationBlock] = []

        # Herdar validação de fotos se vindo de initial_survey
        if order.status == "initial_survey":
            photo_result = cls._validate_to_budget(order)
            soft.extend(photo_result.soft_blocks)
            warn.extend(photo_result.warnings)

        # HARD: seguradora precisa de PDF na pasta orcamentos
        if order.customer_type == "insurer":
            pdf_count = cls._count_photos(order, ["orcamentos"])
            if pdf_count == 0:
                hard.append(ValidationBlock(
                    code="BUDGET_PDF_INSURER",
                    message="PDF do orçamento não enviado (pasta Orçamentos vazia)",
                ))
            # WARN: sinistro
            if not order.casualty_number:
                warn.append(ValidationBlock(
                    code="CASUALTY_NUMBER",
                    message="Número do sinistro não informado",
                ))

        # HARD: particular precisa de peças ou serviços
        if order.customer_type == "private":
            has_parts = order.parts.filter(is_active=True).exists()
            has_labor = order.labor_items.filter(is_active=True).exists()
            if not has_parts and not has_labor:
                hard.append(ValidationBlock(
                    code="BUDGET_ITEMS_PRIVATE",
                    message="Orçamento vazio — adicione pelo menos 1 peça ou 1 serviço",
                ))

        return ValidationResult(hard_blocks=hard, soft_blocks=soft, warnings=warn)
```

- [ ] **Step 7: Run all tests**

Run: `cd /Users/thiagocampos/Documents/Projetos/grupo-dscar && python -m pytest backend/core/apps/service_orders/tests/test_transition_validator.py -v --no-header 2>&1 | head -30`
Expected: All tests PASS

- [ ] **Step 8: Write tests + implement _validate_to_authorized**

Append tests:

```python
class TestValidateToAuthorized:
    def test_hard_block_no_auth_date(self):
        order = _make_order(status="waiting_auth", authorization_date=None)
        result = TransitionValidator.validate(order, "authorized")
        codes = [b.code for b in result.hard_blocks]
        assert "AUTH_DATE_SET" in codes

    def test_hard_block_insurer_no_version(self):
        order = _make_order(
            status="waiting_auth",
            customer_type="insurer",
            authorization_date="2026-01-01",
            casualty_number="12345",
            deductible_amount=Decimal("1000"),
            insured_type="insured",
        )
        order.versions.filter.return_value.exists.return_value = False
        result = TransitionValidator.validate(order, "authorized")
        codes = [b.code for b in result.hard_blocks]
        assert "VERSION_AUTHORIZED" in codes

    def test_hard_block_insurer_no_casualty(self):
        order = _make_order(
            status="waiting_auth",
            customer_type="insurer",
            authorization_date="2026-01-01",
            casualty_number="",
        )
        order.versions.filter.return_value.exists.return_value = True
        result = TransitionValidator.validate(order, "authorized")
        codes = [b.code for b in result.hard_blocks]
        assert "CASUALTY_NUMBER_REQUIRED" in codes

    def test_hard_block_insurer_insured_no_deductible(self):
        order = _make_order(
            status="waiting_auth",
            customer_type="insurer",
            authorization_date="2026-01-01",
            casualty_number="12345",
            insured_type="insured",
            deductible_amount=None,
        )
        order.versions.filter.return_value.exists.return_value = True
        result = TransitionValidator.validate(order, "authorized")
        codes = [b.code for b in result.hard_blocks]
        assert "DEDUCTIBLE_SET" in codes

    @patch.object(TransitionValidator, "_has_signature", return_value=False)
    def test_hard_block_private_no_signature(self, mock_sig):
        order = _make_order(
            status="waiting_auth",
            customer_type="private",
            authorization_date="2026-01-01",
        )
        result = TransitionValidator.validate(order, "authorized")
        codes = [b.code for b in result.hard_blocks]
        assert "SIGNATURE_APPROVAL" in codes
```

Add implementation:

```python
    @classmethod
    def _validate_to_authorized(cls, order: ServiceOrder) -> ValidationResult:
        """waiting_auth → authorized"""
        hard: list[ValidationBlock] = []
        soft: list[ValidationBlock] = []
        warn: list[ValidationBlock] = []

        # HARD: data de autorização
        if not order.authorization_date:
            hard.append(ValidationBlock(
                code="AUTH_DATE_SET",
                message="Data de autorização não preenchida",
            ))

        if order.customer_type == "insurer":
            # HARD: versão autorizada
            has_authorized = order.versions.filter(
                status__in=["autorizado", "approved"]
            ).exists()
            if not has_authorized:
                hard.append(ValidationBlock(
                    code="VERSION_AUTHORIZED",
                    message="Nenhuma versão do orçamento foi autorizada pela seguradora",
                ))

            # HARD: número do sinistro
            if not order.casualty_number:
                hard.append(ValidationBlock(
                    code="CASUALTY_NUMBER_REQUIRED",
                    message="Número do sinistro não informado",
                ))

            # HARD: franquia (se segurado)
            if order.insured_type == "insured" and not order.deductible_amount:
                hard.append(ValidationBlock(
                    code="DEDUCTIBLE_SET",
                    message="Valor da franquia não informado (obrigatório para segurado)",
                ))

        if order.customer_type == "private":
            # HARD: assinatura do cliente
            if not cls._has_signature(order, "BUDGET_APPROVAL"):
                hard.append(ValidationBlock(
                    code="SIGNATURE_APPROVAL",
                    message="Assinatura de aprovação do orçamento não capturada",
                ))

        return ValidationResult(hard_blocks=hard, soft_blocks=soft, warnings=warn)
```

- [ ] **Step 9: Run all tests**

Run: `cd /Users/thiagocampos/Documents/Projetos/grupo-dscar && python -m pytest backend/core/apps/service_orders/tests/test_transition_validator.py -v --no-header 2>&1 | head -40`
Expected: All tests PASS

- [ ] **Step 10: Commit**

```bash
git add backend/core/apps/service_orders/transition_validator.py backend/core/apps/service_orders/tests/test_transition_validator.py
git commit -m "feat(service_orders): add validation rules reception → authorized"
```

---

## Task 4: TransitionValidator — Workshop + Delivery Rules

**Files:**
- Modify: `backend/core/apps/service_orders/transition_validator.py`
- Modify: `backend/core/apps/service_orders/tests/test_transition_validator.py`

- [ ] **Step 1: Write tests for authorized → waiting_parts/repair**

Append to test file:

```python
class TestValidateToWaitingParts:
    def test_hard_block_no_parts(self):
        order = _make_order(status="authorized")
        order.parts.filter.return_value.exists.return_value = False
        result = TransitionValidator.validate(order, "waiting_parts")
        codes = [b.code for b in result.hard_blocks]
        assert "PARTS_EXIST" in codes

    @patch.object(TransitionValidator, "_parts_purchased", return_value=["Parachoque (sem pedido de compra)"])
    def test_soft_block_parts_not_sourced(self, mock_pp):
        order = _make_order(status="authorized")
        order.parts.filter.return_value.exists.return_value = True
        result = TransitionValidator.validate(order, "waiting_parts")
        codes = [b.code for b in result.soft_blocks]
        assert "PARTS_SOURCED" in codes


class TestValidateToRepair:
    def test_hard_block_no_items(self):
        order = _make_order(status="authorized")
        order.parts.filter.return_value.exists.return_value = False
        order.labor_items.filter.return_value.exists.return_value = False
        result = TransitionValidator.validate(order, "repair")
        codes = [b.code for b in result.hard_blocks]
        assert "PARTS_OR_LABOR_EXIST" in codes

    @patch.object(TransitionValidator, "_parts_incomplete", return_value=["Motor (Aguardando Cotação)"])
    def test_warn_parts_pending(self, mock_pi):
        order = _make_order(status="authorized")
        order.parts.filter.return_value.exists.return_value = True
        order.labor_items.filter.return_value.exists.return_value = True
        result = TransitionValidator.validate(order, "repair")
        codes = [w.code for w in result.warnings]
        assert "PARTS_PENDING" in codes


class TestValidateWorkshopTransition:
    """Tests for transitions between workshop sectors."""

    @patch.object(TransitionValidator, "_sector_has_timesheet", return_value=False)
    @patch.object(TransitionValidator, "_count_photos", return_value=0)
    def test_soft_block_no_timesheet_no_photo(self, mock_photos, mock_ts):
        order = _make_order(status="bodywork")
        result = TransitionValidator.validate(order, "painting")
        codes = [b.code for b in result.soft_blocks]
        assert "TIMESHEET_CLOSED" in codes
        assert "PROGRESS_PHOTO" in codes

    @patch.object(TransitionValidator, "_sector_has_timesheet", return_value=True)
    @patch.object(TransitionValidator, "_count_photos", return_value=3)
    def test_passes_with_timesheet_and_photos(self, mock_photos, mock_ts):
        order = _make_order(status="bodywork")
        result = TransitionValidator.validate(order, "painting")
        assert len(result.soft_blocks) == 0


class TestValidateToFinalSurvey:
    @patch.object(TransitionValidator, "_sector_has_timesheet", return_value=True)
    @patch.object(TransitionValidator, "_count_photos", return_value=1)
    @patch.object(TransitionValidator, "_all_parts_received", return_value=False)
    @patch.object(TransitionValidator, "_all_timesheets_closed", return_value=False)
    def test_hard_blocks_parts_and_timesheets(self, mock_at, mock_ap, mock_ph, mock_ts):
        order = _make_order(status="washing")
        result = TransitionValidator.validate(order, "final_survey")
        codes = [b.code for b in result.hard_blocks]
        assert "ALL_PARTS_RECEIVED" in codes
        assert "ALL_TIMESHEETS_CLOSED" in codes


class TestValidateToReady:
    @patch.object(TransitionValidator, "_count_photos", return_value=5)
    @patch.object(TransitionValidator, "_has_checklist", return_value=False)
    def test_soft_blocks(self, mock_cl, mock_ph):
        order = _make_order(status="final_survey")
        result = TransitionValidator.validate(order, "ready")
        codes = [b.code for b in result.soft_blocks]
        assert "FINAL_PHOTOS_12" in codes
        assert "EXIT_CHECKLIST" in codes


class TestValidateToDelivered:
    @patch.object(TransitionValidator, "_has_nfce", return_value=False)
    @patch.object(TransitionValidator, "_has_signature", return_value=False)
    @patch.object(TransitionValidator, "_has_receivables", return_value=False)
    @patch.object(TransitionValidator, "_complement_all_billed", return_value=True)
    def test_hard_blocks_private(self, mock_comp, mock_recv, mock_sig, mock_nfce):
        order = _make_order(status="ready", customer_type="private", mileage_out=None)
        result = TransitionValidator.validate(order, "delivered")
        codes = [b.code for b in result.hard_blocks]
        assert "NFCE_ISSUED" in codes
        assert "CLIENT_SIGNATURE" in codes
        assert "MILEAGE_OUT" in codes
        assert "RECEIVABLE_CREATED" in codes

    @patch.object(TransitionValidator, "_has_nfce", return_value=True)
    @patch.object(TransitionValidator, "_has_signature", return_value=True)
    @patch.object(TransitionValidator, "_has_receivables", return_value=True)
    @patch.object(TransitionValidator, "_complement_all_billed", return_value=False)
    def test_hard_block_complement_not_billed(self, mock_comp, mock_recv, mock_sig, mock_nfce):
        order = _make_order(status="ready", customer_type="insurer", mileage_out=100000)
        result = TransitionValidator.validate(order, "delivered")
        codes = [b.code for b in result.hard_blocks]
        assert "COMPLEMENT_BILLED" in codes


class TestValidateToCancelled:
    def test_hard_block_no_justification(self):
        order = _make_order(status="reception")
        result = TransitionValidator.validate(order, "cancelled")
        codes = [b.code for b in result.hard_blocks]
        assert "CANCEL_JUSTIFICATION" in codes
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/thiagocampos/Documents/Projetos/grupo-dscar && python -m pytest backend/core/apps/service_orders/tests/test_transition_validator.py -k "TestValidateTo" -v --no-header 2>&1 | head -40`
Expected: New tests FAIL

- [ ] **Step 3: Implement remaining validators**

Add to `TransitionValidator` class:

```python
    @classmethod
    def _validate_to_waiting_parts(cls, order: ServiceOrder) -> ValidationResult:
        """authorized → waiting_parts"""
        hard: list[ValidationBlock] = []
        soft: list[ValidationBlock] = []
        warn: list[ValidationBlock] = []

        # HARD: pelo menos 1 peça
        if not order.parts.filter(is_active=True).exists():
            hard.append(ValidationBlock(
                code="PARTS_EXIST",
                message="Nenhuma peça cadastrada na OS",
            ))

        # SOFT: peças de compra com OC + status >= comprada
        pending = cls._parts_purchased(order)
        if pending:
            soft.append(ValidationBlock(
                code="PARTS_SOURCED",
                message=f"Peças sem pedido de compra ou não compradas: {', '.join(pending[:3])}",
            ))

        return ValidationResult(hard_blocks=hard, soft_blocks=soft, warnings=warn)

    @classmethod
    def _validate_to_repair(cls, order: ServiceOrder) -> ValidationResult:
        """authorized/waiting_parts → repair"""
        hard: list[ValidationBlock] = []
        soft: list[ValidationBlock] = []
        warn: list[ValidationBlock] = []

        # Quando vem de waiting_parts, validar compras
        if order.status == "waiting_parts":
            pending = cls._parts_purchased(order)
            if pending:
                soft.append(ValidationBlock(
                    code="PARTS_PURCHASED",
                    message=f"Peças pendentes: {', '.join(pending[:3])}",
                ))
            incomplete = cls._parts_incomplete(order)
            if incomplete:
                warn.append(ValidationBlock(
                    code="PARTS_INCOMPLETE",
                    message=f"Peças não recebidas: {', '.join(incomplete[:3])}",
                ))
        else:
            # Vindo de authorized
            has_parts = order.parts.filter(is_active=True).exists()
            has_labor = order.labor_items.filter(is_active=True).exists()
            if not has_parts and not has_labor:
                hard.append(ValidationBlock(
                    code="PARTS_OR_LABOR_EXIST",
                    message="Nenhuma peça ou serviço cadastrado na OS",
                ))

            incomplete = cls._parts_incomplete(order)
            if incomplete:
                warn.append(ValidationBlock(
                    code="PARTS_PENDING",
                    message=f"Peças com status pendente: {', '.join(incomplete[:3])}",
                ))

        return ValidationResult(hard_blocks=hard, soft_blocks=soft, warnings=warn)

    # Workshop sectors share same validator
    _WORKSHOP_STATUSES = {
        "mechanic", "bodywork", "painting", "assembly", "polishing", "washing",
    }

    @classmethod
    def _validate_workshop_transition(cls, order: ServiceOrder) -> ValidationResult:
        """Transições entre setores de oficina (repair ↔ mechanic ↔ ... ↔ washing)."""
        hard: list[ValidationBlock] = []
        soft: list[ValidationBlock] = []
        warn: list[ValidationBlock] = []

        # SOFT: apontamento de horas encerrado no setor atual
        if not cls._sector_has_timesheet(order):
            soft.append(ValidationBlock(
                code="TIMESHEET_CLOSED",
                message=f"Apontamento de horas não encerrado no setor '{order.status}'",
            ))

        # SOFT: foto de acompanhamento
        photo_count = cls._count_photos(order, ["acompanhamento"])
        if photo_count == 0:
            soft.append(ValidationBlock(
                code="PROGRESS_PHOTO",
                message=f"Nenhuma foto de acompanhamento no setor '{order.status}'",
            ))

        return ValidationResult(hard_blocks=hard, soft_blocks=soft, warnings=warn)

    # Register workshop validator for all workshop target statuses
    _validate_to_mechanic = _validate_workshop_transition
    _validate_to_bodywork = _validate_workshop_transition
    _validate_to_painting = _validate_workshop_transition
    _validate_to_assembly = _validate_workshop_transition
    _validate_to_polishing = _validate_workshop_transition
    _validate_to_washing = _validate_workshop_transition

    @classmethod
    def _validate_to_final_survey(cls, order: ServiceOrder) -> ValidationResult:
        """washing → final_survey"""
        hard: list[ValidationBlock] = []
        soft: list[ValidationBlock] = []
        warn: list[ValidationBlock] = []

        # Herda regras de setor
        workshop = cls._validate_workshop_transition(order)
        soft.extend(workshop.soft_blocks)

        # HARD: todas as peças recebidas
        if not cls._all_parts_received(order):
            hard.append(ValidationBlock(
                code="ALL_PARTS_RECEIVED",
                message="Há peças que ainda não foram recebidas",
            ))

        # HARD: todos os apontamentos encerrados
        if not cls._all_timesheets_closed(order):
            hard.append(ValidationBlock(
                code="ALL_TIMESHEETS_CLOSED",
                message="Há apontamentos de horas não encerrados em setores anteriores",
            ))

        return ValidationResult(hard_blocks=hard, soft_blocks=soft, warnings=warn)

    @classmethod
    def _validate_to_ready(cls, order: ServiceOrder) -> ValidationResult:
        """final_survey → ready"""
        hard: list[ValidationBlock] = []
        soft: list[ValidationBlock] = []
        warn: list[ValidationBlock] = []

        # SOFT: 12 fotos de vistoria final
        photo_count = cls._count_photos(order, ["vistoria_final"])
        if photo_count < 12:
            soft.append(ValidationBlock(
                code="FINAL_PHOTOS_12",
                message=f"Fotos de vistoria final: {photo_count}/12 (faltam {12 - photo_count})",
            ))

        # SOFT: checklist de saída
        if not cls._has_checklist(order, "saida"):
            soft.append(ValidationBlock(
                code="EXIT_CHECKLIST",
                message="Checklist de saída não preenchido",
            ))

        return ValidationResult(hard_blocks=hard, soft_blocks=soft, warnings=warn)

    @classmethod
    def _validate_to_delivered(cls, order: ServiceOrder) -> ValidationResult:
        """ready → delivered"""
        hard: list[ValidationBlock] = []
        soft: list[ValidationBlock] = []
        warn: list[ValidationBlock] = []

        # HARD: NFC-e para particular
        if order.customer_type == "private":
            if not cls._has_nfce(order):
                hard.append(ValidationBlock(
                    code="NFCE_ISSUED",
                    message="NFC-e não emitida (obrigatório para cliente particular)",
                ))

        # HARD: assinatura do cliente
        if not cls._has_signature(order, "OS_DELIVERY"):
            hard.append(ValidationBlock(
                code="CLIENT_SIGNATURE",
                message="Assinatura de entrega do cliente não capturada",
            ))

        # HARD: KM saída
        if not order.mileage_out:
            hard.append(ValidationBlock(
                code="MILEAGE_OUT",
                message="KM de saída não informado",
            ))

        # HARD: contas a receber
        if not cls._has_receivables(order):
            hard.append(ValidationBlock(
                code="RECEIVABLE_CREATED",
                message="Contas a receber não geradas",
            ))

        # HARD: complemento particular faturado
        if not cls._complement_all_billed(order):
            hard.append(ValidationBlock(
                code="COMPLEMENT_BILLED",
                message="Há itens de complemento particular não faturados",
            ))

        return ValidationResult(hard_blocks=hard, soft_blocks=soft, warnings=warn)

    @classmethod
    def _validate_to_cancelled(cls, order: ServiceOrder, justification: str = "") -> ValidationResult:
        """Qualquer → cancelled"""
        hard: list[ValidationBlock] = []

        if not justification:
            hard.append(ValidationBlock(
                code="CANCEL_JUSTIFICATION",
                message="Justificativa obrigatória para cancelamento",
            ))

        return ValidationResult(hard_blocks=hard)
```

Note: `_validate_to_cancelled` recebe `justification` extra. Ajustar o `validate()` method para passar kwargs:

```python
    @classmethod
    def validate(
        cls,
        order: ServiceOrder,
        target_status: str,
        **kwargs,
    ) -> ValidationResult:
        """Valida pré-requisitos para transição order.status → target_status."""
        method_name = f"_validate_to_{target_status}"
        validator = getattr(cls, method_name, None)
        if validator is None:
            return ValidationResult()
        # Cancelled recebe justification como kwarg
        if target_status == "cancelled":
            return validator(order, justification=kwargs.get("justification", ""))
        return validator(order)
```

- [ ] **Step 4: Run all tests**

Run: `cd /Users/thiagocampos/Documents/Projetos/grupo-dscar && python -m pytest backend/core/apps/service_orders/tests/test_transition_validator.py -v --no-header 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/core/apps/service_orders/transition_validator.py backend/core/apps/service_orders/tests/test_transition_validator.py
git commit -m "feat(service_orders): add all validation rules for workshop + delivery transitions"
```

---

## Task 5: Integrate Validator into Service Layer + Views

**Files:**
- Modify: `backend/core/apps/service_orders/services.py` (~line 296, `transition()` method)
- Modify: `backend/core/apps/service_orders/views.py` (~line 283, `transition` action)
- Modify: `backend/core/apps/service_orders/serializers.py` (add new serializers + modify detail)

- [ ] **Step 1: Modify ServiceOrderService.transition() to use validator**

In `backend/core/apps/service_orders/services.py`, replace the `transition()` method body (lines 296-385) with:

```python
    @classmethod
    @transaction.atomic
    def transition(
        cls,
        order_id: str,
        new_status: str,
        changed_by_id: str,
        force: bool = False,
        override_id: str | None = None,
        justification: str = "",
    ) -> "ServiceOrder":
        """
        Executa transição manual de status da OS com validação de pré-requisitos.

        Args:
            order_id: UUID da OS.
            new_status: Status de destino.
            changed_by_id: UUID do usuário que está executando a transição.
            force: Se True, ignora soft blocks (requer MANAGER+).
            override_id: ID de um TransitionOverrideRequest aprovado.
            justification: Justificativa para force/cancelled.

        Raises:
            ValidationError: Se a transição não for permitida ou tiver hard blocks.

        Returns:
            ServiceOrder com status atualizado.
        """
        from apps.service_orders.models import (
            ServiceOrder,
            StatusTransitionLog,
            ServiceOrderActivityLog,
            TransitionOverrideRequest,
        )
        from apps.service_orders.transition_validator import TransitionValidator

        order = ServiceOrder.objects.select_for_update().get(id=order_id)

        if new_status not in VALID_TRANSITIONS.get(order.status, []):
            raise ValidationError(
                {
                    "status": (
                        f"Transição inválida: {order.status} → {new_status}. "
                        f"Permitidas: {VALID_TRANSITIONS.get(order.status, [])}"
                    )
                }
            )

        # Validar pré-requisitos de negócio
        result = TransitionValidator.validate(
            order, new_status, justification=justification
        )

        # Hard blocks: SEMPRE bloqueiam
        if result.hard_blocks:
            raise ValidationError({
                "transition_blocks": {
                    "type": "hard",
                    "can_override": False,
                    "blocks": [b.to_dict() for b in result.hard_blocks],
                    "warnings": [w.to_dict() for w in result.warnings],
                }
            })

        # Soft blocks: bloqueiam exceto com force/override
        if result.soft_blocks:
            has_approved_override = False

            # Verificar override aprovado
            if override_id:
                has_approved_override = TransitionOverrideRequest.objects.filter(
                    id=override_id,
                    service_order=order,
                    to_status=new_status,
                    status="approved",
                ).exists()

            if not force and not has_approved_override:
                raise ValidationError({
                    "transition_blocks": {
                        "type": "soft",
                        "can_override": True,
                        "blocks": [b.to_dict() for b in result.soft_blocks],
                        "warnings": [w.to_dict() for w in result.warnings],
                        "has_pending_override": TransitionValidator._has_pending_override(
                            order, new_status
                        ),
                    }
                })

            # Se force=True, criar override record para auditoria
            if force and not has_approved_override:
                TransitionOverrideRequest.objects.create(
                    service_order=order,
                    from_status=order.status,
                    to_status=new_status,
                    requested_by_id=changed_by_id,
                    approved_by_id=changed_by_id,
                    status="approved",
                    blocks_snapshot=[b.to_dict() for b in result.soft_blocks],
                    request_reason=justification or "Override presencial",
                    justification=justification or "Override presencial",
                    resolved_at=timezone.now(),
                    expires_at=timezone.now(),
                )

        old_status = order.status
        order.status = new_status

        from django.utils import timezone
        now = timezone.now()

        # Auto-preenchimento de datas chaves ao avançar no Kanban
        if new_status == "initial_survey" and not order.entry_date:
            order.entry_date = now
        elif new_status == "authorized" and not order.authorization_date:
            order.authorization_date = now
        elif new_status == "final_survey" and not order.final_survey_date:
            order.final_survey_date = now
        elif new_status == "delivered":
            if not order.client_delivery_date:
                order.client_delivery_date = now
            if not order.delivered_at:
                order.delivered_at = now

        order.save(update_fields=[
            "status", "entry_date", "authorization_date",
            "final_survey_date", "client_delivery_date",
            "delivered_at", "updated_at"
        ])

        StatusTransitionLog.objects.create(
            service_order=order,
            from_status=old_status,
            to_status=new_status,
            triggered_by_field="",
            changed_by_id=changed_by_id,
        )

        from apps.authentication.models import GlobalUser
        user = GlobalUser.objects.filter(id=changed_by_id).first()
        user_name = user.get_full_name() or user.email if user else "Usuário"
        from apps.service_orders.models import ServiceOrderStatus as SOS
        old_label = dict(SOS.choices).get(old_status, old_status)
        new_label = dict(SOS.choices).get(new_status, new_status)
        ServiceOrderActivityLog.objects.create(
            service_order=order,
            user_id=changed_by_id,
            activity_type="status_changed",
            description=f"{user_name} moveu a OS de '{old_label}' para '{new_label}'",
            metadata={
                "from_status": old_status,
                "to_status": new_status,
                "had_warnings": len(result.warnings) > 0,
                "was_forced": force,
            },
        )

        logger.info(
            "OS #%d: transição manual %s→%s por user_id=%s (force=%s)",
            order.number,
            old_status,
            new_status,
            changed_by_id,
            force,
        )
        return order
```

- [ ] **Step 2: Add override serializers to serializers.py**

Append to `backend/core/apps/service_orders/serializers.py`:

```python
class TransitionValidationResultSerializer(serializers.Serializer):
    """Resultado de validação de transição — read-only."""

    can_proceed = serializers.BooleanField()
    hard_blocks = serializers.ListField(child=serializers.DictField())
    soft_blocks = serializers.ListField(child=serializers.DictField())
    warnings = serializers.ListField(child=serializers.DictField())
    has_pending_override = serializers.BooleanField()


class OverrideRequestCreateSerializer(serializers.Serializer):
    """Criação de solicitação de override."""

    target_status = serializers.ChoiceField(choices=ServiceOrderStatus.choices)
    reason = serializers.CharField(max_length=1000)


class OverrideResolveSerializer(serializers.Serializer):
    """Resolução de override (aprovar/rejeitar)."""

    action = serializers.ChoiceField(choices=["approved", "rejected"])
    justification = serializers.CharField(max_length=1000)


class OverrideRequestSerializer(serializers.ModelSerializer):
    """Serializer de leitura de TransitionOverrideRequest."""

    requested_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    os_number = serializers.IntegerField(source="service_order.number", read_only=True)
    os_plate = serializers.CharField(source="service_order.plate", read_only=True)
    os_customer_name = serializers.CharField(source="service_order.customer_name", read_only=True)

    class Meta:
        from .models import TransitionOverrideRequest

        model = TransitionOverrideRequest
        fields = [
            "id", "os_number", "os_plate", "os_customer_name",
            "from_status", "to_status", "status",
            "blocks_snapshot", "request_reason", "justification",
            "requested_by_name", "approved_by_name",
            "created_at", "resolved_at", "expires_at",
        ]

    def get_requested_by_name(self, obj) -> str:
        return obj.requested_by.get_full_name() or obj.requested_by.email

    def get_approved_by_name(self, obj) -> str:
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.email
        return ""
```

- [ ] **Step 3: Update ServiceOrderStatusTransitionSerializer to accept force + justification**

Replace `ServiceOrderStatusTransitionSerializer` in `serializers.py`:

```python
class ServiceOrderStatusTransitionSerializer(serializers.Serializer):
    """Serializer para mudança manual de status via ação customizada."""

    new_status = serializers.ChoiceField(choices=ServiceOrderStatus.choices)
    force = serializers.BooleanField(required=False, default=False)
    override_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    justification = serializers.CharField(required=False, allow_blank=True, default="")
    # Credenciais presenciais do gerente (opcional)
    manager_email = serializers.EmailField(required=False, allow_blank=True, default="")
    manager_password = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_new_status(self, value: str) -> str:
        service_order: ServiceOrder = self.context["service_order"]
        if not service_order.can_transition_to(value):
            allowed = VALID_TRANSITIONS.get(service_order.status, [])
            raise serializers.ValidationError(
                f"Transição inválida: '{service_order.status}' → '{value}'. "
                f"Permitidas: {allowed}"
            )
        return value

    def validate(self, attrs: dict) -> dict:
        """Valida credenciais do gerente se force=True com credenciais presenciais."""
        if attrs.get("force") and attrs.get("manager_email"):
            from apps.authentication.models import GlobalUser
            from apps.authentication.permissions import ROLE_HIERARCHY

            email = attrs["manager_email"]
            password = attrs["manager_password"]

            try:
                manager = GlobalUser.objects.get(email=email, is_active=True)
            except GlobalUser.DoesNotExist:
                raise serializers.ValidationError(
                    {"manager_email": "Credenciais do gerente inválidas."}
                )

            if not manager.check_password(password):
                raise serializers.ValidationError(
                    {"manager_password": "Credenciais do gerente inválidas."}
                )

            # Verificar role MANAGER+
            role = getattr(manager, "role", "STOREKEEPER")
            # Em dev-credentials, role vem da session. Usar default ADMIN.
            if ROLE_HIERARCHY.get(role, 0) < ROLE_HIERARCHY.get("MANAGER", 3):
                raise serializers.ValidationError(
                    {"manager_email": "Usuário não tem permissão de gerente."}
                )

            # Substituir changed_by pelo gerente autenticado
            attrs["_manager_user"] = manager

        return attrs
```

- [ ] **Step 4: Update transition view to pass new params**

In `backend/core/apps/service_orders/views.py`, replace the `transition` action (lines 283-323):

```python
    @extend_schema(summary="Transitar status da OS (Kanban)")
    @action(detail=True, methods=["post"], url_path="transition")
    def transition(self, request: Request, pk: Optional[str] = None) -> Response:
        """
        POST /service-orders/{id}/transition/
        Body: {"new_status": "<status>", "force": false, "justification": "..."}
        """
        service_order: ServiceOrder = self.get_object()
        serializer = ServiceOrderStatusTransitionSerializer(
            data=request.data,
            context={"service_order": service_order, "request": request},
        )
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        new_status: str = data["new_status"]
        force: bool = data.get("force", False)

        # Se override presencial, usar o ID do gerente
        manager_user = data.get("_manager_user")
        changed_by_id = str(manager_user.id) if manager_user else str(request.user.id)

        order = ServiceOrderService.transition(
            order_id=str(service_order.id),
            new_status=new_status,
            changed_by_id=changed_by_id,
            force=force,
            override_id=str(data["override_id"]) if data.get("override_id") else None,
            justification=data.get("justification", ""),
        )

        # Fire push notification to the consultant
        consultant = order.consultant
        if consultant is not None:
            from apps.authentication.models import GlobalUser
            from django_tenants.utils import get_tenant
            from .tasks import task_notify_status_change
            from .models import ServiceOrderStatus as SOS

            status_label = dict(SOS.choices).get(new_status, new_status)
            try:
                tenant = get_tenant(request)
                schema = getattr(tenant, "schema_name", "public")
            except Exception:
                schema = "public"

            task_notify_status_change.delay(
                tenant_schema=schema,
                user_id=str(consultant.pk),
                os_number=order.number,
                plate=order.plate or "",
                new_status_label=status_label,
            )

        detail = ServiceOrderDetailSerializer(order, context={"request": request}).data

        # Incluir warnings no response se a transição foi bem-sucedida
        from apps.service_orders.transition_validator import TransitionValidator
        validation = TransitionValidator.validate(order, new_status)
        if validation.warnings:
            detail["_warnings"] = [w.to_dict() for w in validation.warnings]

        return Response(detail)
```

- [ ] **Step 5: Add transition_requirements to ServiceOrderDetailSerializer**

In `backend/core/apps/service_orders/serializers.py`, add field to `ServiceOrderDetailSerializer`:

Add after `closure_status = serializers.SerializerMethodField()` (line 542):

```python
    transition_requirements = serializers.SerializerMethodField()
```

Add method to the class:

```python
    def get_transition_requirements(self, obj: ServiceOrder) -> dict[str, dict]:
        """Retorna validação de pré-requisitos para cada transição permitida."""
        from apps.service_orders.transition_validator import TransitionValidator

        return TransitionValidator.validate_all_targets(obj)
```

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/service_orders/services.py backend/core/apps/service_orders/serializers.py backend/core/apps/service_orders/views.py
git commit -m "feat(service_orders): integrate TransitionValidator into service layer + views"
```

---

## Task 6: Override Request Endpoints

**Files:**
- Modify: `backend/core/apps/service_orders/views.py`
- Modify: `backend/core/apps/service_orders/urls.py`
- Modify: `backend/core/apps/service_orders/tasks.py`

- [ ] **Step 1: Add override endpoints to ViewSet**

Append to `ServiceOrderViewSet` in `views.py`:

```python
    @extend_schema(summary="Solicitar override de transição bloqueada")
    @action(detail=True, methods=["post", "get"], url_path="override-request")
    def override_request(self, request: Request, pk: Optional[str] = None) -> Response:
        """POST para criar, GET para listar overrides da OS."""
        from .models import TransitionOverrideRequest
        from .serializers import OverrideRequestCreateSerializer, OverrideRequestSerializer

        service_order = self.get_object()

        if request.method == "GET":
            overrides = TransitionOverrideRequest.objects.filter(
                service_order=service_order
            ).select_related("requested_by", "approved_by")
            return Response(OverrideRequestSerializer(overrides, many=True).data)

        serializer = OverrideRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from datetime import timedelta
        now = timezone.now()

        override = TransitionOverrideRequest.objects.create(
            service_order=service_order,
            from_status=service_order.status,
            to_status=serializer.validated_data["target_status"],
            requested_by=request.user,
            request_reason=serializer.validated_data["reason"],
            expires_at=now + timedelta(hours=24),
        )

        # Capturar blocks snapshot
        from .transition_validator import TransitionValidator
        result = TransitionValidator.validate(
            service_order, serializer.validated_data["target_status"]
        )
        override.blocks_snapshot = [b.to_dict() for b in result.soft_blocks]
        override.save(update_fields=["blocks_snapshot"])

        # Log event
        from .events import OSEventLogger
        OSEventLogger.log_event(
            service_order, "OVERRIDE_REQUESTED",
            actor=request.user.get_full_name() or request.user.email,
            payload={
                "override_id": str(override.pk),
                "target_status": override.to_status,
                "reason": override.request_reason,
            },
            swallow_errors=True,
        )

        # Notificar MANAGER+ via push
        from .tasks import task_notify_override_request
        try:
            from django_tenants.utils import get_tenant
            schema = getattr(get_tenant(request), "schema_name", "public")
        except Exception:
            schema = "public"

        task_notify_override_request.delay(
            tenant_schema=schema,
            override_id=str(override.pk),
            os_number=service_order.number,
            plate=service_order.plate,
            requester_name=request.user.get_full_name() or request.user.email,
            target_status=override.to_status,
        )

        return Response(
            OverrideRequestSerializer(override).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(summary="Resolver override (aprovar/rejeitar)")
    @action(
        detail=True,
        methods=["post"],
        url_path=r"override-request/(?P<override_pk>[0-9a-f-]+)/resolve",
    )
    def override_resolve(self, request: Request, pk=None, override_pk=None) -> Response:
        """POST /service-orders/{id}/override-request/{override_id}/resolve/"""
        from .models import TransitionOverrideRequest
        from .serializers import OverrideResolveSerializer, OverrideRequestSerializer
        from apps.authentication.permissions import _has_min_role

        if not _has_min_role(request, "MANAGER"):
            return Response(
                {"detail": "Apenas gerentes podem aprovar/rejeitar overrides."},
                status=status.HTTP_403_FORBIDDEN,
            )

        service_order = self.get_object()
        override = get_object_or_404(
            TransitionOverrideRequest,
            pk=override_pk,
            service_order=service_order,
            status="pending",
        )

        serializer = OverrideResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action_taken = serializer.validated_data["action"]
        override.status = action_taken
        override.approved_by = request.user
        override.justification = serializer.validated_data["justification"]
        override.resolved_at = timezone.now()
        override.save(update_fields=["status", "approved_by", "justification", "resolved_at"])

        # Log event
        from .events import OSEventLogger
        event_type = "OVERRIDE_APPROVED" if action_taken == "approved" else "OVERRIDE_REJECTED"
        OSEventLogger.log_event(
            service_order, event_type,
            actor=request.user.get_full_name() or request.user.email,
            payload={
                "override_id": str(override.pk),
                "justification": override.justification,
            },
            swallow_errors=True,
        )

        # Se aprovado, executar a transição automaticamente
        if action_taken == "approved":
            try:
                ServiceOrderService.transition(
                    order_id=str(service_order.id),
                    new_status=override.to_status,
                    changed_by_id=str(request.user.id),
                    override_id=str(override.pk),
                )
            except Exception as e:
                logger.error("Falha ao executar transição após override: %s", e)
                return Response(
                    {"detail": f"Override aprovado, mas transição falhou: {e}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        # Notificar consultor do resultado
        from .tasks import task_notify_override_resolved
        try:
            from django_tenants.utils import get_tenant
            schema = getattr(get_tenant(request), "schema_name", "public")
        except Exception:
            schema = "public"

        task_notify_override_resolved.delay(
            tenant_schema=schema,
            override_id=str(override.pk),
            requester_user_id=str(override.requested_by_id),
            os_number=service_order.number,
            plate=service_order.plate,
            action=action_taken,
            justification=override.justification,
        )

        return Response(OverrideRequestSerializer(override).data)
```

- [ ] **Step 2: Add pending-overrides list endpoint**

Append to `ServiceOrderViewSet`:

```python
    @extend_schema(summary="Listar overrides pendentes (MANAGER+)")
    @action(detail=False, methods=["get"], url_path="pending-overrides")
    def pending_overrides(self, request: Request) -> Response:
        """GET /service-orders/pending-overrides/ — overrides pendentes no tenant."""
        from apps.authentication.permissions import _has_min_role
        from .models import TransitionOverrideRequest
        from .serializers import OverrideRequestSerializer

        if not _has_min_role(request, "MANAGER"):
            return Response(
                {"detail": "Apenas gerentes podem ver overrides pendentes."},
                status=status.HTTP_403_FORBIDDEN,
            )

        overrides = (
            TransitionOverrideRequest.objects
            .filter(status="pending", expires_at__gt=timezone.now())
            .select_related("service_order", "requested_by")
            .order_by("-created_at")[:50]
        )
        return Response(OverrideRequestSerializer(overrides, many=True).data)
```

- [ ] **Step 3: Add Celery tasks for notifications + expiration**

Append to `backend/core/apps/service_orders/tasks.py`:

```python
@shared_task
def task_notify_override_request(
    tenant_schema: str,
    override_id: str,
    os_number: int,
    plate: str,
    requester_name: str,
    target_status: str,
) -> None:
    """Notifica todos os MANAGER+ sobre nova solicitação de override."""
    from apps.authentication.models import GlobalUser
    from apps.authentication.permissions import ROLE_HIERARCHY

    managers = GlobalUser.objects.filter(
        is_active=True,
    ).exclude(push_token="")

    for user in managers:
        role = getattr(user, "role", "STOREKEEPER")
        if ROLE_HIERARCHY.get(role, 0) >= ROLE_HIERARCHY.get("MANAGER", 3):
            task_send_push_notification.delay(
                tenant_schema=tenant_schema,
                token=user.push_token,
                title=f"Liberação solicitada — OS #{os_number}",
                body=f"{requester_name} solicita avançar OS {plate} para '{target_status}'",
                data={
                    "type": "override_request",
                    "override_id": override_id,
                    "os_number": os_number,
                },
            )


@shared_task
def task_notify_override_resolved(
    tenant_schema: str,
    override_id: str,
    requester_user_id: str,
    os_number: int,
    plate: str,
    action: str,
    justification: str,
) -> None:
    """Notifica o consultor sobre resolução do override."""
    from apps.authentication.models import GlobalUser

    try:
        user = GlobalUser.objects.get(pk=requester_user_id, is_active=True)
    except GlobalUser.DoesNotExist:
        return

    if not user.push_token:
        return

    emoji = "✅" if action == "approved" else "❌"
    title = f"{emoji} Override {'aprovado' if action == 'approved' else 'rejeitado'} — OS #{os_number}"
    body = justification[:100] if justification else f"OS {plate}"

    task_send_push_notification.delay(
        tenant_schema=tenant_schema,
        token=user.push_token,
        title=title,
        body=body,
        data={
            "type": "override_resolved",
            "override_id": override_id,
            "os_number": os_number,
            "action": action,
        },
    )


@shared_task
def task_expire_overrides(tenant_schema: str = "") -> None:
    """Marca como expirados overrides pendentes que passaram de 24h.

    Executar via Celery Beat a cada hora.
    """
    from django_tenants.utils import schema_context, get_tenant_model

    TenantModel = get_tenant_model()
    schemas = [t.schema_name for t in TenantModel.objects.exclude(schema_name="public")]

    for schema in schemas:
        with schema_context(schema):
            from apps.service_orders.models import TransitionOverrideRequest

            expired_count = TransitionOverrideRequest.objects.filter(
                status="pending",
                expires_at__lt=timezone.now(),
            ).update(status="expired", resolved_at=timezone.now())

            if expired_count:
                logger.info(
                    "Schema %s: %d overrides expirados", schema, expired_count
                )
```

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/service_orders/views.py backend/core/apps/service_orders/serializers.py backend/core/apps/service_orders/tasks.py
git commit -m "feat(service_orders): add override request endpoints + notification tasks"
```

---

## Task 7: TypeScript Types

**Files:**
- Modify: `packages/types/src/service-order.types.ts`

- [ ] **Step 1: Add validation types**

Append to `packages/types/src/service-order.types.ts` before the closing comment:

```typescript
// ── Transition Validation ─────────────────────────────────────────

export interface ValidationBlock {
  code: string;
  message: string;
}

export interface TransitionValidationResult {
  can_proceed: boolean;
  hard_blocks: ValidationBlock[];
  soft_blocks: ValidationBlock[];
  warnings: ValidationBlock[];
  has_pending_override: boolean;
}

export type TransitionRequirements = Record<ServiceOrderStatus, TransitionValidationResult>;

// ── Override Requests ─────────────────────────────────────────────

export type OverrideStatus = "pending" | "approved" | "rejected" | "expired";

export interface TransitionOverrideRequest {
  id: string;
  os_number: number;
  os_plate: string;
  os_customer_name: string;
  from_status: ServiceOrderStatus;
  to_status: ServiceOrderStatus;
  status: OverrideStatus;
  blocks_snapshot: ValidationBlock[];
  request_reason: string;
  justification: string;
  requested_by_name: string;
  approved_by_name: string;
  created_at: string;
  resolved_at: string | null;
  expires_at: string;
}

export interface CreateOverridePayload {
  target_status: ServiceOrderStatus;
  reason: string;
}

export interface ResolveOverridePayload {
  action: "approved" | "rejected";
  justification: string;
}

export interface TransitionPayload {
  new_status: ServiceOrderStatus;
  force?: boolean;
  override_id?: string;
  justification?: string;
  manager_email?: string;
  manager_password?: string;
}
```

- [ ] **Step 2: Add transition_requirements to ServiceOrder interface**

In the `ServiceOrder` interface, add after `closure_status: ClosureStatus | null;`:

```typescript
  // Transition validation
  transition_requirements: Partial<TransitionRequirements> | null;
```

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/service-order.types.ts
git commit -m "feat(types): add TypeScript types for transition validation + override"
```

---

## Task 8: Integration Tests

**Files:**
- Create: `backend/core/apps/service_orders/tests/test_override.py`

- [ ] **Step 1: Write integration tests for override flow**

Create `backend/core/apps/service_orders/tests/test_override.py`:

```python
"""Integration tests for TransitionOverrideRequest flow."""
import pytest
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APIClient

from apps.service_orders.models import (
    ServiceOrder,
    TransitionOverrideRequest,
)


@pytest.fixture
def os_in_initial_survey(db):
    """OS pronta para testes de transição — no status initial_survey."""
    return ServiceOrder.objects.create(
        number=9999,
        plate="TST1A23",
        make="Test",
        model="Car",
        customer_type="private",
        customer_name="Test Customer",
        status="initial_survey",
        entry_date=timezone.now(),
    )


class TestTransitionOverrideModel:
    @pytest.mark.django_db
    def test_create_override_request(self, os_in_initial_survey):
        """Override request pode ser criado com dados válidos."""
        from apps.authentication.models import GlobalUser

        user = GlobalUser.objects.create_user(
            email="consultor@test.com",
            password="test123",
        )
        override = TransitionOverrideRequest.objects.create(
            service_order=os_in_initial_survey,
            from_status="initial_survey",
            to_status="budget",
            requested_by=user,
            request_reason="Fotos serão tiradas amanhã",
            expires_at=timezone.now() + timedelta(hours=24),
        )
        assert override.status == "pending"
        assert str(override) == f"Override OS #9999: initial_survey → budget (pending)"

    @pytest.mark.django_db
    def test_expire_old_overrides(self, os_in_initial_survey):
        """Overrides expirados são marcados automaticamente."""
        from apps.authentication.models import GlobalUser

        user = GlobalUser.objects.create_user(
            email="exp@test.com", password="test123"
        )
        override = TransitionOverrideRequest.objects.create(
            service_order=os_in_initial_survey,
            from_status="initial_survey",
            to_status="budget",
            requested_by=user,
            request_reason="test",
            expires_at=timezone.now() - timedelta(hours=1),  # já expirou
        )

        # Simular task de expiração
        expired = TransitionOverrideRequest.objects.filter(
            status="pending", expires_at__lt=timezone.now()
        ).update(status="expired", resolved_at=timezone.now())

        assert expired == 1
        override.refresh_from_db()
        assert override.status == "expired"
```

- [ ] **Step 2: Run tests**

Run: `cd /Users/thiagocampos/Documents/Projetos/grupo-dscar && python -m pytest backend/core/apps/service_orders/tests/test_override.py -v --no-header 2>&1 | tail -15`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/core/apps/service_orders/tests/test_override.py
git commit -m "test(service_orders): add integration tests for override request flow"
```

---

## Task 9: Update ServiceOrderListSerializer with has_transition_blocks

**Files:**
- Modify: `backend/core/apps/service_orders/serializers.py`

- [ ] **Step 1: Add lightweight transition check to list serializer**

In `ServiceOrderListSerializer`, add field after `closure_status`:

```python
    has_transition_blocks = serializers.SerializerMethodField()
```

Add to `fields` list in Meta class.

Add method:

```python
    def get_has_transition_blocks(self, obj: ServiceOrder) -> bool:
        """Indicador leve para Kanban: True se próximo status tem hard ou soft blocks."""
        from apps.service_orders.transition_validator import TransitionValidator

        allowed = VALID_TRANSITIONS.get(obj.status, [])
        if not allowed:
            return False
        # Checa apenas o primeiro target (caminho feliz) para performance
        result = TransitionValidator.validate(obj, allowed[0])
        return bool(result.hard_blocks or result.soft_blocks)
```

- [ ] **Step 2: Commit**

```bash
git add backend/core/apps/service_orders/serializers.py
git commit -m "feat(service_orders): add has_transition_blocks to list serializer for Kanban"
```

---

## Summary

| Task | Description | Commits |
|------|-------------|---------|
| 1 | TransitionOverrideRequest model + migration | 1 |
| 2 | TransitionValidator skeleton + dataclass | 1 |
| 3 | Validation rules: reception → authorized | 1 |
| 4 | Validation rules: workshop + delivery | 1 |
| 5 | Integrate validator into service layer + views | 1 |
| 6 | Override request endpoints + notification tasks | 1 |
| 7 | TypeScript types | 1 |
| 8 | Integration tests | 1 |
| 9 | List serializer has_transition_blocks | 1 |

**Total: 9 tasks, ~9 commits**

**Not included in this plan (separate plans):**
- Frontend web: painel de pré-requisitos, modal de override, badges Kanban
- Frontend mobile: painel de pré-requisitos, tela de aprovação, push handling
- Celery Beat configuration for `task_expire_overrides`
