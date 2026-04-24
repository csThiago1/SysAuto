# Port `payments` App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the `payments` app — registro de pagamentos recebidos contra uma OS, por bloco financeiro (SEGURADORA, FRANQUIA, PARTICULAR, COMPLEMENTO_PARTICULAR), com evento de auditoria via `OSEventLogger`.

**Architecture:** TENANT_APP. `Payment` model com FK PROTECT para `ServiceOrder`. `PaymentService.record()` é `@transaction.atomic` e loga via `OSEventLogger`. API aninhada em `/api/v1/service-orders/{id}/payments/`.

**Tech Stack:** Django 5, DRF, `apps.service_orders.events.OSEventLogger`, `django_tenants.test.cases.TenantTestCase`.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `backend/core/apps/payments/__init__.py` | Package marker |
| Create | `backend/core/apps/payments/apps.py` | AppConfig |
| Create | `backend/core/apps/payments/models.py` | Payment model |
| Create | `backend/core/apps/payments/services.py` | `PaymentService.record()` |
| Create | `backend/core/apps/payments/serializers.py` | PaymentSerializer |
| Create | `backend/core/apps/payments/views.py` | PaymentViewSet (nested) |
| Create | `backend/core/apps/payments/urls.py` | URL patterns |
| Create | `backend/core/apps/payments/admin.py` | Admin |
| Create | `backend/core/apps/payments/migrations/__init__.py` | Package marker |
| Create | `backend/core/apps/payments/migrations/0001_initial.py` | Payment table |
| Create | `backend/core/apps/payments/tests/__init__.py` | Package marker |
| Create | `backend/core/apps/payments/tests/test_services.py` | Service tests |
| Create | `backend/core/apps/payments/tests/test_api.py` | API tests |
| Modify | `backend/core/config/settings/base.py` | Add `"apps.payments"` to TENANT_APPS |
| Modify | `backend/core/apps/service_orders/urls.py` | Add nested payments path |

---

### Task 1: Model + Migration

**Files:**
- Create: `backend/core/apps/payments/__init__.py`
- Create: `backend/core/apps/payments/apps.py`
- Create: `backend/core/apps/payments/models.py`
- Create: `backend/core/apps/payments/admin.py`
- Create: `backend/core/apps/payments/migrations/__init__.py`
- Create: `backend/core/apps/payments/migrations/0001_initial.py`

- [ ] **Step 1: Write model**

`backend/core/apps/payments/apps.py`:
```python
from django.apps import AppConfig


class PaymentsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.payments"
    verbose_name = "Pagamentos"
```

`backend/core/apps/payments/models.py`:
```python
from django.db import models

from apps.service_orders.models import ServiceOrder


class Payment(models.Model):
    """Pagamento registrado contra uma OS por bloco financeiro."""

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
        ("PARTICULAR", "Particular"),
    ]

    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.PROTECT, related_name="payments",
    )
    payer_block = models.CharField(max_length=30, choices=PAYER_BLOCK_CHOICES, db_index=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    reference = models.CharField(max_length=200, blank=True, default="")
    received_at = models.DateTimeField(null=True, blank=True)
    received_by = models.CharField(max_length=120, blank=True, default="")
    # Referência a NF-e/NFS-e (texto livre por enquanto)
    fiscal_doc_ref = models.CharField(max_length=60, blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True)
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
        return f"{self.method} R$ {self.amount} — OS #{self.service_order.number}"
```

`backend/core/apps/payments/admin.py`:
```python
from django.contrib import admin
from .models import Payment

admin.site.register(Payment)
```

- [ ] **Step 2: Write migration**

`backend/core/apps/payments/migrations/0001_initial.py`:
```python
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("service_orders", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Payment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True)),
                (
                    "service_order",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="payments",
                        to="service_orders.serviceorder",
                    ),
                ),
                (
                    "payer_block",
                    models.CharField(
                        choices=[
                            ("SEGURADORA", "Coberto pela Seguradora"),
                            ("COMPLEMENTO_PARTICULAR", "Complemento Particular"),
                            ("FRANQUIA", "Franquia"),
                            ("PARTICULAR", "Particular"),
                        ],
                        db_index=True,
                        max_length=30,
                    ),
                ),
                ("amount", models.DecimalField(decimal_places=2, max_digits=14)),
                (
                    "method",
                    models.CharField(
                        choices=[
                            ("PIX", "Pix"),
                            ("BOLETO", "Boleto"),
                            ("DINHEIRO", "Dinheiro"),
                            ("CARTAO", "Cartão"),
                            ("TRANSFERENCIA", "Transferência"),
                        ],
                        max_length=20,
                    ),
                ),
                ("reference", models.CharField(blank=True, default="", max_length=200)),
                ("received_at", models.DateTimeField(blank=True, null=True)),
                ("received_by", models.CharField(blank=True, default="", max_length=120)),
                ("fiscal_doc_ref", models.CharField(blank=True, default="", max_length=60)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pendente"),
                            ("received", "Recebido"),
                            ("refunded", "Estornado"),
                        ],
                        db_index=True,
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="payment",
            index=models.Index(
                fields=["service_order", "payer_block", "status"],
                name="pay_so_block_status_idx",
            ),
        ),
    ]
```

- [ ] **Step 3: Add to TENANT_APPS and migrate**

In `backend/core/config/settings/base.py`, add to `TENANT_APPS`:
```python
"apps.payments",
```

```bash
cd backend/core && .venv/bin/python manage.py migrate_schemas --schema=tenant_dscar --settings=config.settings.dev
```

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/payments/
git commit -m "feat(payments): Payment model + migration 0001"
```

---

### Task 2: `PaymentService.record()` + Tests

**Files:**
- Create: `backend/core/apps/payments/services.py`
- Create: `backend/core/apps/payments/tests/__init__.py`
- Create: `backend/core/apps/payments/tests/test_services.py`

- [ ] **Step 1: Write failing tests**

`backend/core/apps/payments/tests/test_services.py`:
```python
"""Testes para PaymentService.record()."""
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.payments.models import Payment
from apps.payments.services import PaymentService
from apps.service_orders.models import ServiceOrder, ServiceOrderEvent


class PaymentServiceTest(TenantTestCase):

    def setUp(self) -> None:
        super().setUp()
        self.os = ServiceOrder.objects.create(
            number=9001, customer_name="Cliente Teste", plate="PAY0001",
        )

    def test_record_creates_payment_with_status_received(self) -> None:
        payment = PaymentService.record(
            service_order=self.os,
            payer_block="SEGURADORA",
            amount=Decimal("1500.00"),
            method="PIX",
        )
        assert payment.status == "received"
        assert payment.received_at is not None
        assert payment.amount == Decimal("1500.00")

    def test_record_logs_payment_recorded_event(self) -> None:
        PaymentService.record(
            service_order=self.os,
            payer_block="PARTICULAR",
            amount=Decimal("500.00"),
            method="DINHEIRO",
            received_by="Thiago",
        )
        ev = ServiceOrderEvent.objects.get(service_order=self.os, event_type="PAYMENT_RECORDED")
        assert ev.payload["block"] == "PARTICULAR"
        assert ev.payload["method"] == "DINHEIRO"
        assert ev.actor == "Thiago"

    def test_record_reference_and_received_by_optional(self) -> None:
        payment = PaymentService.record(
            service_order=self.os,
            payer_block="FRANQUIA",
            amount=Decimal("300.00"),
            method="BOLETO",
        )
        assert payment.reference == ""
        assert payment.received_by == ""
        assert payment.status == "received"
```

- [ ] **Step 2: Run tests to confirm fail**

```bash
cd backend/core && .venv/bin/pytest apps/payments/tests/test_services.py -v
```

Expected: ImportError (services.py doesn't exist).

- [ ] **Step 3: Write service**

`backend/core/apps/payments/services.py`:
```python
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.service_orders.events import OSEventLogger
from apps.service_orders.models import ServiceOrder

from .models import Payment


class PaymentService:
    """Regras de negócio de pagamentos — nunca mutante direto do model."""

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
        """Registra pagamento recebido + evento de auditoria PAYMENT_RECORDED.

        Args:
            service_order: OS à qual o pagamento se refere.
            payer_block: bloco financeiro (SEGURADORA, PARTICULAR, FRANQUIA, COMPLEMENTO_PARTICULAR).
            amount: valor recebido.
            method: método de pagamento (PIX, BOLETO, DINHEIRO, CARTAO, TRANSFERENCIA).
            reference: texto livre (txid PIX, nº boleto, etc.).
            received_by: nome do operador para auditoria.

        Returns:
            Payment criado com status='received' e received_at preenchido.
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
            service_order,
            "PAYMENT_RECORDED",
            actor=received_by or "Sistema",
            payload={
                "amount": str(amount),
                "method": method,
                "block": payer_block,
                "payment_id": payment.pk,
            },
            swallow_errors=True,
        )

        return payment
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
cd backend/core && .venv/bin/pytest apps/payments/tests/test_services.py -v
```

Expected: 3/3 PASSED.

- [ ] **Step 5: Commit**

```bash
git add backend/core/apps/payments/services.py backend/core/apps/payments/tests/
git commit -m "feat(payments): PaymentService.record + tests"
```

---

### Task 3: API Endpoints + Registration

**Files:**
- Create: `backend/core/apps/payments/serializers.py`
- Create: `backend/core/apps/payments/views.py`
- Create: `backend/core/apps/payments/urls.py`
- Create: `backend/core/apps/payments/tests/test_api.py`
- Modify: `backend/core/apps/service_orders/urls.py`

- [ ] **Step 1: Write failing API tests**

`backend/core/apps/payments/tests/test_api.py`:
```python
"""API tests para payments endpoints."""
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.payments.models import Payment
from apps.service_orders.models import ServiceOrder


class PaymentAPITest(TenantTestCase):

    def setUp(self) -> None:
        super().setUp()
        self.user = GlobalUser.objects.create_user(email="pay@x.com", password="pw")
        self.client = APIClient()
        self.client.defaults["HTTP_X_TENANT_DOMAIN"] = self.domain.domain
        self.client.force_authenticate(user=self.user, token={"role": "MANAGER"})
        self.os = ServiceOrder.objects.create(
            number=8001, customer_name="Cliente API", plate="PAY0001",
        )

    def test_list_payments_returns_only_os_payments(self) -> None:
        os2 = ServiceOrder.objects.create(number=8002, customer_name="Outro", plate="PAY0002")
        Payment.objects.create(
            service_order=self.os, payer_block="SEGURADORA",
            amount=Decimal("1000"), method="PIX", status="received",
        )
        Payment.objects.create(
            service_order=os2, payer_block="PARTICULAR",
            amount=Decimal("500"), method="DINHEIRO", status="received",
        )
        resp = self.client.get(f"/api/v1/service-orders/{self.os.pk}/payments/")
        assert resp.status_code == 200
        assert len(resp.data["results"]) == 1
        assert resp.data["results"][0]["payer_block"] == "SEGURADORA"

    def test_create_payment_returns_201(self) -> None:
        resp = self.client.post(
            f"/api/v1/service-orders/{self.os.pk}/payments/",
            {
                "payer_block": "PARTICULAR",
                "amount": "750.00",
                "method": "CARTAO",
                "reference": "txid-123",
                "received_by": "Thiago",
            },
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["status"] == "received"
        assert resp.data["received_at"] is not None

    def test_list_payments_as_consultant_allowed(self) -> None:
        self.client.force_authenticate(user=self.user, token={"role": "CONSULTANT"})
        resp = self.client.get(f"/api/v1/service-orders/{self.os.pk}/payments/")
        assert resp.status_code == 200

    def test_create_payment_as_consultant_forbidden(self) -> None:
        self.client.force_authenticate(user=self.user, token={"role": "CONSULTANT"})
        resp = self.client.post(
            f"/api/v1/service-orders/{self.os.pk}/payments/",
            {"payer_block": "PARTICULAR", "amount": "100", "method": "PIX"},
            format="json",
        )
        assert resp.status_code == 403
```

- [ ] **Step 2: Run tests to confirm fail**

```bash
cd backend/core && .venv/bin/pytest apps/payments/tests/test_api.py -v
```

Expected: 404 (route not registered).

- [ ] **Step 3: Write serializers**

`backend/core/apps/payments/serializers.py`:
```python
from rest_framework import serializers

from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            "id", "service_order", "payer_block", "amount", "method",
            "reference", "received_at", "received_by", "fiscal_doc_ref",
            "status", "created_at",
        ]
        read_only_fields = ["service_order", "received_at", "status", "created_at"]
```

- [ ] **Step 4: Write views**

`backend/core/apps/payments/views.py`:
```python
from decimal import Decimal

from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove
from apps.service_orders.models import ServiceOrder

from .models import Payment
from .serializers import PaymentSerializer
from .services import PaymentService


class PaymentViewSet(viewsets.GenericViewSet):
    """Pagamentos aninhados sob uma OS específica."""

    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def _get_service_order(self, pk: int) -> ServiceOrder:
        return ServiceOrder.objects.filter(pk=pk, is_active=True).first() or (_ for _ in ()).throw(
            Exception("OS não encontrada")
        )

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action == "create":
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def list(self, request: Request, service_order_pk: int | None = None) -> Response:
        qs = Payment.objects.filter(
            service_order_id=service_order_pk,
            service_order__is_active=True,
        ).order_by("-created_at")
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    def create(self, request: Request, service_order_pk: int | None = None) -> Response:
        os_instance = ServiceOrder.objects.filter(pk=service_order_pk, is_active=True).first()
        if os_instance is None:
            return Response({"detail": "OS não encontrada."}, status=404)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        payment = PaymentService.record(
            service_order=os_instance,
            payer_block=d["payer_block"],
            amount=Decimal(str(d["amount"])),
            method=d["method"],
            reference=d.get("reference", ""),
            received_by=d.get("received_by", ""),
        )
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)
```

- [ ] **Step 5: Write URLs**

`backend/core/apps/payments/urls.py`:
```python
"""URLs de payments — para inclusão via nested pattern em service_orders/urls.py."""
from rest_framework.routers import SimpleRouter

from .views import PaymentViewSet

router = SimpleRouter()
router.register(r"", PaymentViewSet, basename="payment")

urlpatterns = router.urls
```

- [ ] **Step 6: Add nested route to service_orders/urls.py**

In `backend/core/apps/service_orders/urls.py`, add:

```python
# No topo, adicionar import:
from django.urls import include, path, re_path

# Antes do path("", include(router.urls)), adicionar:
path("<int:service_order_pk>/payments/", include("apps.payments.urls")),
```

The resulting `urlpatterns` in `service_orders/urls.py` should include:
```python
urlpatterns = [
    path("dashboard/stats/", DashboardStatsView.as_view(), name="service-order-dashboard-stats"),
    path("calendar/", CalendarView.as_view(), name="service-order-calendar"),
    path("vehicle-history/", VehicleHistoryView.as_view(), name="vehicle-history"),
    path("service-catalog/", include(catalog_router.urls)),
    path("holidays/", include(holiday_router.urls)),
    path("versions/", include(versions_router.urls)),
    path("events/", include(events_router.urls)),
    path("pareceres/", include(pareceres_router.urls)),
    path("<int:service_order_pk>/payments/", include("apps.payments.urls")),  # ← NEW
    path("", include(router.urls)),
]
```

- [ ] **Step 7: Run API tests**

```bash
cd backend/core && .venv/bin/pytest apps/payments/tests/ -v
```

Expected: All tests pass.

- [ ] **Step 8: Run full suite**

```bash
cd backend/core && .venv/bin/pytest --tb=short -q
```

Expected: No regressions.

- [ ] **Step 9: Commit**

```bash
git add backend/core/apps/payments/ backend/core/apps/service_orders/urls.py backend/core/config/settings/base.py
git commit -m "feat(payments): API endpoints + nested routing — app completo"
```
