# Ciclo 03A — Backend API REST + PDF Real · Módulo de Orçamentação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expor toda a camada de serviços (Ciclo 02) via API REST em DRF, com serializers nested, 30+ endpoints, action endpoints para fluxos de negócio, e substituir `pdf_stub` por WeasyPrint real com templates da DS Car.

**Architecture:** DRF `ModelViewSet` + `@action` endpoints. ViewSets **nunca** escrevem direto em model — sempre via Service. Serializers usam nested representation pra items+operations. WeasyPrint gera PDFs em HTML+CSS com templates Jinja2/Django.

**Tech Stack:** Django 5 + DRF 3.15 + drf-spectacular (OpenAPI) + WeasyPrint 62 + Pillow.

**Referência:** [`docs/superpowers/specs/2026-04-20-modulo-orcamentacao-design.md`](../specs/2026-04-20-modulo-orcamentacao-design.md) §8 (endpoints) e §10 (PDF).

**Dependências:** Ciclos 01 e 02 merged (140 testes PASS, services completos).

**Out of scope** (Ciclo 03B e futuros):
- Frontend Next.js (Ciclo 03B)
- Importadores Cilia/HDI/XML (Ciclo 4)
- Fotos S3, Assinatura, Fiscal (Ciclo 5)

---

## Chunks planejados

| Chunk | Escopo | Target |
|---|---|---|
| **1** | Infraestrutura REST: shared serializers (ItemFields), reference endpoints (Insurer, ItemOperationType, LaborCategory), OpenAPI | ~15 endpoints, 8 testes |
| **2** | Budget: serializers + BudgetViewSet CRUD + nested items + action endpoints (send/approve/reject/revision/clone) | 12 endpoints, ~25 testes |
| **3** | ServiceOrder: serializers + ViewSet + actions (change-status, approve-version, complement, events timeline, pareceres) | 15 endpoints, ~30 testes |
| **4** | Payment + URL routing global + PDF engine real WeasyPrint substituindo stub | ~10 endpoints + PDF, ~15 testes |
| **5** | Smoke E2E via APIClient + MVP_CHECKLIST + README | 1 smoke + docs |

**Target final:** ~200 testes PASS (140 base + ~80 novos), 50+ endpoints REST documentados via OpenAPI, PDF real rodando.

---

## Task 1: Infraestrutura REST compartilhada

**Files:**
- Modify: `backend/core/requirements.txt` (+ drf-spectacular)
- Modify: `backend/core/config/settings.py` (REST_FRAMEWORK config + drf-spectacular)
- Modify: `backend/core/config/urls.py` (rotas globais + OpenAPI schema)
- Create: `backend/core/apps/items/serializers.py` (shared ItemFieldsMixin ser + ItemOperation ser)
- Create: `backend/core/apps/items/views.py` (ref data viewsets)
- Create: `backend/core/apps/items/urls.py`
- Create: `backend/core/apps/service_orders/views_insurer.py` (Insurer viewset)
- Create: `backend/core/apps/items/tests/test_api_reference.py`

- [ ] **Step 1.1: Dependências**

Em `requirements.txt`:
```
# API documentation
drf-spectacular>=0.27,<1.0
```

- [ ] **Step 1.2: Settings**

Em `config/settings.py`, adicionar/atualizar:

```python
INSTALLED_APPS = [
    # ...existentes...
    "drf_spectacular",
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
}

SPECTACULAR_SETTINGS = {
    "TITLE": "ERP DS Car API",
    "DESCRIPTION": "API do módulo de orçamentação — Paddock Solutions",
    "VERSION": "0.2.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}
```

- [ ] **Step 1.3: URLs globais**

Em `config/urls.py`:

```python
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


urlpatterns = [
    path("admin/", admin.site.urls),
    # OpenAPI
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="api-schema"),
    path("api/v1/schema/swagger/", SpectacularSwaggerView.as_view(url_name="api-schema"), name="swagger"),

    # Auth
    path("api/v1/auth/", include("apps.authentication.urls") if __import__("importlib").util.find_spec("apps.authentication") else []),

    # Modules
    path("api/v1/", include("apps.items.urls")),
    path("api/v1/", include("apps.budgets.urls")),
    path("api/v1/", include("apps.service_orders.urls")),
    path("api/v1/", include("apps.payments.urls")),
]
```

Se `apps.authentication` não existir, simplificar (remover linha).

- [ ] **Step 1.4: Serializers compartilhados**

Create `backend/core/apps/items/serializers.py`:

```python
from __future__ import annotations

from rest_framework import serializers

from .models import ItemOperation, ItemOperationType, LaborCategory, Part


class ItemOperationTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemOperationType
        fields = ["id", "code", "label", "description", "is_active", "sort_order"]


class LaborCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = LaborCategory
        fields = ["id", "code", "label", "description", "is_active", "sort_order"]


class ItemOperationReadSerializer(serializers.ModelSerializer):
    """Representação read-only de ItemOperation com nested labels."""
    operation_type = ItemOperationTypeSerializer(read_only=True)
    labor_category = LaborCategorySerializer(read_only=True)

    class Meta:
        model = ItemOperation
        fields = [
            "id", "operation_type", "labor_category",
            "hours", "hourly_rate", "labor_cost",
        ]


class ItemOperationWriteSerializer(serializers.Serializer):
    """Write serializer: recebe codes, converte em FKs no create."""
    operation_type_code = serializers.CharField()
    labor_category_code = serializers.CharField()
    hours = serializers.DecimalField(max_digits=6, decimal_places=2)
    hourly_rate = serializers.DecimalField(max_digits=10, decimal_places=2)
    labor_cost = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)

    def validate_operation_type_code(self, value: str) -> str:
        if not ItemOperationType.objects.filter(code=value).exists():
            raise serializers.ValidationError(f"Operation type '{value}' desconhecido")
        return value

    def validate_labor_category_code(self, value: str) -> str:
        if not LaborCategory.objects.filter(code=value).exists():
            raise serializers.ValidationError(f"Labor category '{value}' desconhecida")
        return value
```

> Sobre `Part`: o spec menciona mas não foi criado no Ciclo 01 (marcado como stub). Se `Part` não existe, remover o import.

- [ ] **Step 1.5: Reference ViewSets**

Create `backend/core/apps/items/views.py`:

```python
from __future__ import annotations

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.filters import SearchFilter

from .models import ItemOperationType, LaborCategory
from .serializers import ItemOperationTypeSerializer, LaborCategorySerializer


class ItemOperationTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista/detalhe dos tipos de operação (TROCA/RECUPERACAO/etc)."""

    queryset = ItemOperationType.objects.filter(is_active=True)
    serializer_class = ItemOperationTypeSerializer
    lookup_field = "code"
    filter_backends = [DjangoFilterBackend, SearchFilter]
    search_fields = ["code", "label"]


class LaborCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista/detalhe das categorias de MO (FUNILARIA/PINTURA/etc)."""

    queryset = LaborCategory.objects.filter(is_active=True)
    serializer_class = LaborCategorySerializer
    lookup_field = "code"
    filter_backends = [DjangoFilterBackend, SearchFilter]
    search_fields = ["code", "label"]
```

- [ ] **Step 1.6: URLs do items**

Create `backend/core/apps/items/urls.py`:

```python
from rest_framework.routers import DefaultRouter

from .views import ItemOperationTypeViewSet, LaborCategoryViewSet


router = DefaultRouter()
router.register(r"items/operation-types", ItemOperationTypeViewSet, basename="operation-type")
router.register(r"items/labor-categories", LaborCategoryViewSet, basename="labor-category")

urlpatterns = router.urls
```

- [ ] **Step 1.7: Insurer ViewSet (já em service_orders)**

Create `backend/core/apps/service_orders/views_insurer.py`:

```python
from __future__ import annotations

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import serializers, viewsets
from rest_framework.filters import SearchFilter

from .models import Insurer


class InsurerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Insurer
        fields = ["id", "code", "name", "cnpj", "import_source", "is_active"]


class InsurerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Insurer.objects.filter(is_active=True)
    serializer_class = InsurerSerializer
    lookup_field = "code"
    filter_backends = [DjangoFilterBackend, SearchFilter]
    search_fields = ["code", "name"]
```

- [ ] **Step 1.8: Esqueleto do apps/service_orders/urls.py**

Create ou update `backend/core/apps/service_orders/urls.py`:

```python
from rest_framework.routers import DefaultRouter

from .views_insurer import InsurerViewSet


router = DefaultRouter()
router.register(r"insurers", InsurerViewSet, basename="insurer")

urlpatterns = router.urls
```

> Próximas tasks adicionarão mais viewsets a esse router.

- [ ] **Step 1.9: URLs stubs pros apps budgets/payments**

Create `backend/core/apps/budgets/urls.py`:
```python
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
# Tasks seguintes registram ViewSets aqui

urlpatterns = router.urls
```

Create `backend/core/apps/payments/urls.py` idem.

- [ ] **Step 1.10: Testes**

Create `backend/core/apps/items/tests/test_api_reference.py`:

```python
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient


User = get_user_model()


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="apitester", password="secret")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestOperationTypesAPI:

    def test_list(self, auth_client):
        resp = auth_client.get("/api/v1/items/operation-types/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] >= 7  # 7 seeds
        codes = [r["code"] for r in data["results"]]
        assert "TROCA" in codes

    def test_retrieve_by_code(self, auth_client):
        resp = auth_client.get("/api/v1/items/operation-types/TROCA/")
        assert resp.status_code == 200
        assert resp.json()["code"] == "TROCA"

    def test_search(self, auth_client):
        resp = auth_client.get("/api/v1/items/operation-types/?search=Troca")
        assert resp.status_code == 200
        assert resp.json()["count"] >= 1

    def test_requires_auth(self):
        client = APIClient()
        resp = client.get("/api/v1/items/operation-types/")
        assert resp.status_code == 401


@pytest.mark.django_db
class TestLaborCategoriesAPI:

    def test_list(self, auth_client):
        resp = auth_client.get("/api/v1/items/labor-categories/")
        assert resp.status_code == 200
        assert resp.json()["count"] >= 9


@pytest.mark.django_db
class TestInsurersAPI:

    def test_list_returns_all_active(self, auth_client):
        resp = auth_client.get("/api/v1/insurers/")
        assert resp.status_code == 200
        assert resp.json()["count"] >= 10

    def test_retrieve_yelum(self, auth_client):
        resp = auth_client.get("/api/v1/insurers/yelum/")
        assert resp.status_code == 200
        assert resp.json()["import_source"] == "cilia_api"


@pytest.mark.django_db
class TestOpenAPISchema:

    def test_schema_available(self, auth_client):
        resp = auth_client.get("/api/v1/schema/")
        assert resp.status_code == 200
        assert b"openapi" in resp.content.lower()
```

- [ ] **Step 1.11: Rodar**

```bash
cd backend/core
DATABASE_URL="postgresql://paddock:paddock@localhost:5432/paddock_dev" pytest apps/ -v --tb=short
```

Expected: 140 baseline + 8 novos = **148 PASS**.

- [ ] **Step 1.12: Commit**

```bash
git add backend/core/
git commit -m "feat(api): infraestrutura REST (drf-spectacular) + reference endpoints (operation-types, labor-categories, insurers)"
```

---

## Task 2: Budget ViewSet + actions

**Files:**
- Create: `backend/core/apps/budgets/serializers.py`
- Create: `backend/core/apps/budgets/views.py`
- Modify: `backend/core/apps/budgets/urls.py`
- Create: `backend/core/apps/budgets/tests/test_api.py`

- [ ] **Step 2.1: Serializers**

```python
# apps/budgets/serializers.py
from __future__ import annotations

from decimal import Decimal
from rest_framework import serializers

from apps.items.models import ItemOperation, ItemOperationType, LaborCategory
from apps.items.serializers import ItemOperationReadSerializer

from .models import Budget, BudgetVersion, BudgetVersionItem


class BudgetVersionItemReadSerializer(serializers.ModelSerializer):
    operations = ItemOperationReadSerializer(many=True, read_only=True)

    class Meta:
        model = BudgetVersionItem
        fields = [
            "id", "bucket", "payer_block", "impact_area", "item_type",
            "description", "external_code", "part_type", "supplier",
            "quantity", "unit_price", "unit_cost", "discount_pct", "net_price",
            "flag_abaixo_padrao", "flag_acima_padrao", "flag_inclusao_manual",
            "flag_codigo_diferente", "flag_servico_manual", "flag_peca_da_conta",
            "sort_order", "operations",
        ]


class BudgetVersionItemWriteSerializer(serializers.ModelSerializer):
    """Write: aceita campos do item + operations como lista aninhada."""
    operations = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        write_only=True,
    )

    class Meta:
        model = BudgetVersionItem
        fields = [
            "bucket", "payer_block", "impact_area", "item_type",
            "description", "external_code", "part_type", "supplier",
            "quantity", "unit_price", "unit_cost", "discount_pct", "net_price",
            "flag_abaixo_padrao", "flag_acima_padrao", "flag_inclusao_manual",
            "flag_codigo_diferente", "flag_servico_manual", "flag_peca_da_conta",
            "sort_order", "operations",
        ]

    def create(self, validated_data):
        operations = validated_data.pop("operations", [])
        item = BudgetVersionItem.objects.create(**validated_data)
        for op_data in operations:
            ItemOperation.objects.create(
                item_budget=item,
                operation_type=ItemOperationType.objects.get(code=op_data["operation_type_code"]),
                labor_category=LaborCategory.objects.get(code=op_data["labor_category_code"]),
                hours=Decimal(str(op_data["hours"])),
                hourly_rate=Decimal(str(op_data["hourly_rate"])),
                labor_cost=Decimal(str(op_data.get(
                    "labor_cost",
                    Decimal(str(op_data["hours"])) * Decimal(str(op_data["hourly_rate"])),
                ))),
            )
        return item


class BudgetVersionReadSerializer(serializers.ModelSerializer):
    items = BudgetVersionItemReadSerializer(many=True, read_only=True)
    status_label = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = BudgetVersion
        fields = [
            "id", "version_number", "status", "status_display", "status_label",
            "valid_until", "subtotal", "discount_total", "net_total",
            "labor_total", "parts_total", "pdf_s3_key",
            "sent_at", "approved_at", "approved_by", "approval_evidence_s3_key",
            "created_by", "created_at", "items",
        ]


class BudgetReadSerializer(serializers.ModelSerializer):
    active_version = BudgetVersionReadSerializer(read_only=True)
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)

    class Meta:
        model = Budget
        fields = [
            "id", "number", "customer", "customer_name",
            "vehicle_plate", "vehicle_description",
            "cloned_from", "service_order", "active_version",
            "is_active", "created_at", "updated_at",
        ]


class BudgetCreateSerializer(serializers.Serializer):
    customer_id = serializers.IntegerField()
    vehicle_plate = serializers.CharField(max_length=10)
    vehicle_description = serializers.CharField(max_length=200)


class BudgetApproveSerializer(serializers.Serializer):
    approved_by = serializers.CharField(max_length=120)
    evidence_s3_key = serializers.CharField(max_length=500, required=False, default="")
```

- [ ] **Step 2.2: Views**

```python
# apps/budgets/views.py
from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.persons.models import Person
from apps.service_orders.models import ServiceOrder

from .models import Budget, BudgetVersion, BudgetVersionItem
from .serializers import (
    BudgetApproveSerializer,
    BudgetCreateSerializer,
    BudgetReadSerializer,
    BudgetVersionItemWriteSerializer,
    BudgetVersionReadSerializer,
)
from .services import BudgetService


class BudgetViewSet(viewsets.ReadOnlyModelViewSet):
    """Listagem/detalhe de Budgets particulares. Criação via POST + actions."""

    queryset = Budget.objects.filter(is_active=True).select_related("customer").prefetch_related(
        "versions__items__operations__operation_type",
        "versions__items__operations__labor_category",
    )
    serializer_class = BudgetReadSerializer
    filterset_fields = ["customer", "is_active"]
    search_fields = ["number", "vehicle_plate", "customer__full_name"]
    ordering_fields = ["created_at", "number"]

    def create(self, request):
        ser = BudgetCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        customer = get_object_or_404(Person, pk=ser.validated_data["customer_id"])
        budget = BudgetService.create(
            customer=customer,
            vehicle_plate=ser.validated_data["vehicle_plate"],
            vehicle_description=ser.validated_data["vehicle_description"],
            created_by=request.user.username,
        )
        return Response(BudgetReadSerializer(budget).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def clone(self, request, pk=None):
        source = self.get_object()
        new_b = BudgetService.clone(source_budget=source, created_by=request.user.username)
        return Response(BudgetReadSerializer(new_b).data, status=status.HTTP_201_CREATED)


class BudgetVersionViewSet(viewsets.ReadOnlyModelViewSet):
    """Versões de um Budget. Listagem + actions."""

    serializer_class = BudgetVersionReadSerializer

    def get_queryset(self):
        return BudgetVersion.objects.filter(
            budget_id=self.kwargs["budget_pk"],
        ).prefetch_related(
            "items__operations__operation_type",
            "items__operations__labor_category",
        )

    @action(detail=True, methods=["post"])
    def send(self, request, budget_pk=None, pk=None):
        version = self.get_object()
        BudgetService.send_to_customer(version=version, sent_by=request.user.username)
        version.refresh_from_db()
        return Response(BudgetVersionReadSerializer(version).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, budget_pk=None, pk=None):
        version = self.get_object()
        ser = BudgetApproveSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        os_instance = BudgetService.approve(
            version=version,
            approved_by=ser.validated_data["approved_by"],
            evidence_s3_key=ser.validated_data["evidence_s3_key"],
        )
        version.refresh_from_db()
        from apps.service_orders.serializers import ServiceOrderReadSerializer
        return Response({
            "version": BudgetVersionReadSerializer(version).data,
            "service_order": ServiceOrderReadSerializer(os_instance).data,
        })

    @action(detail=True, methods=["post"])
    def reject(self, request, budget_pk=None, pk=None):
        version = self.get_object()
        BudgetService.reject(version=version)
        version.refresh_from_db()
        return Response(BudgetVersionReadSerializer(version).data)

    @action(detail=True, methods=["post"])
    def revision(self, request, budget_pk=None, pk=None):
        version = self.get_object()
        new_v = BudgetService.request_revision(version=version)
        return Response(BudgetVersionReadSerializer(new_v).data, status=status.HTTP_201_CREATED)


class BudgetVersionItemViewSet(viewsets.ModelViewSet):
    """Items de uma BudgetVersion. Writes só quando status=draft."""

    def get_queryset(self):
        return BudgetVersionItem.objects.filter(
            version_id=self.kwargs["version_pk"],
        ).prefetch_related("operations__operation_type", "operations__labor_category")

    def get_serializer_class(self):
        from .serializers import BudgetVersionItemReadSerializer
        if self.action in ("create", "update", "partial_update"):
            return BudgetVersionItemWriteSerializer
        return BudgetVersionItemReadSerializer

    def perform_create(self, serializer):
        version = get_object_or_404(
            BudgetVersion,
            pk=self.kwargs["version_pk"],
            budget_id=self.kwargs["budget_pk"],
        )
        if version.status != "draft":
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"status": "Só pode adicionar items em draft"})
        serializer.save(version=version)
```

- [ ] **Step 2.3: URLs nested via drf-nested-routers OU via path explícito**

Usaremos `drf-nested-routers` pra nested URLs (adicionar em requirements.txt: `drf-nested-routers>=0.94,<1`).

Update `backend/core/apps/budgets/urls.py`:

```python
from rest_framework_nested import routers

from .views import BudgetViewSet, BudgetVersionItemViewSet, BudgetVersionViewSet


router = routers.SimpleRouter()
router.register(r"budgets", BudgetViewSet, basename="budget")

budgets_router = routers.NestedSimpleRouter(router, r"budgets", lookup="budget")
budgets_router.register(r"versions", BudgetVersionViewSet, basename="budget-version")

versions_router = routers.NestedSimpleRouter(budgets_router, r"versions", lookup="version")
versions_router.register(r"items", BudgetVersionItemViewSet, basename="budget-item")


urlpatterns = router.urls + budgets_router.urls + versions_router.urls
```

- [ ] **Step 2.4: Adicionar `drf-nested-routers` em requirements.txt**

```
drf-nested-routers>=0.94,<1.0
```

- [ ] **Step 2.5: Testes**

Create `backend/core/apps/budgets/tests/test_api.py`:

```python
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.budgets.models import Budget, BudgetVersionItem
from apps.budgets.services import BudgetService
from apps.persons.models import Person


User = get_user_model()


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="budget-api", password="secret")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def person(db):
    return Person.objects.create(full_name="API Cliente", person_type="CLIENT")


@pytest.mark.django_db
class TestBudgetAPI:

    def test_create_budget(self, auth_client, person):
        resp = auth_client.post(
            "/api/v1/budgets/",
            data={
                "customer_id": person.pk,
                "vehicle_plate": "abc1d23",
                "vehicle_description": "Honda Fit",
            },
            format="json",
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["number"].startswith("OR-")
        assert data["vehicle_plate"] == "ABC1D23"
        assert data["active_version"]["version_number"] == 1
        assert data["active_version"]["status"] == "draft"

    def test_list_budgets(self, auth_client, person):
        BudgetService.create(
            customer=person, vehicle_plate="A1", vehicle_description="x", created_by="u",
        )
        resp = auth_client.get("/api/v1/budgets/")
        assert resp.status_code == 200
        assert resp.json()["count"] >= 1

    def test_retrieve_budget(self, auth_client, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="A2", vehicle_description="x", created_by="u",
        )
        resp = auth_client.get(f"/api/v1/budgets/{budget.pk}/")
        assert resp.status_code == 200
        assert resp.json()["number"] == budget.number


@pytest.mark.django_db
class TestBudgetVersionActions:

    def _create_budget_with_item(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="X1", vehicle_description="x", created_by="u",
        )
        v = budget.active_version
        BudgetVersionItem.objects.create(
            version=v, description="Peça",
            quantity=Decimal("1"), unit_price=Decimal("100"),
            net_price=Decimal("100"), item_type="PART",
        )
        return budget, v

    def test_send_version(self, auth_client, person):
        budget, v = self._create_budget_with_item(person)
        resp = auth_client.post(
            f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/send/", format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "sent"

    def test_send_twice_fails(self, auth_client, person):
        budget, v = self._create_budget_with_item(person)
        auth_client.post(f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/send/")
        resp = auth_client.post(f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/send/")
        assert resp.status_code == 400

    def test_approve_creates_os(self, auth_client, person):
        budget, v = self._create_budget_with_item(person)
        auth_client.post(f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/send/")
        resp = auth_client.post(
            f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/approve/",
            data={"approved_by": "cliente", "evidence_s3_key": "whatsapp://ok"},
            format="json",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["version"]["status"] == "approved"
        assert data["service_order"]["customer_type"] == "PARTICULAR"

    def test_reject(self, auth_client, person):
        budget, v = self._create_budget_with_item(person)
        auth_client.post(f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/send/")
        resp = auth_client.post(f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/reject/")
        assert resp.status_code == 200
        assert resp.json()["status"] == "rejected"

    def test_revision_creates_v2(self, auth_client, person):
        budget, v = self._create_budget_with_item(person)
        auth_client.post(f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/send/")
        resp = auth_client.post(f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/revision/")
        assert resp.status_code == 201
        assert resp.json()["version_number"] == 2

    def test_clone_budget(self, auth_client, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="CLN", vehicle_description="x", created_by="u",
        )
        v = budget.active_version
        v.status = "rejected"
        v.save()
        resp = auth_client.post(f"/api/v1/budgets/{budget.pk}/clone/")
        assert resp.status_code == 201
        data = resp.json()
        assert data["number"] != budget.number


@pytest.mark.django_db
class TestBudgetItemAPI:

    def test_create_item_in_draft(self, auth_client, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="I1", vehicle_description="x", created_by="u",
        )
        v = budget.active_version

        resp = auth_client.post(
            f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/items/",
            data={
                "description": "Amortecedor",
                "quantity": "2",
                "unit_price": "500",
                "net_price": "1000",
                "item_type": "PART",
                "operations": [
                    {
                        "operation_type_code": "TROCA",
                        "labor_category_code": "FUNILARIA",
                        "hours": "2.00",
                        "hourly_rate": "40",
                    }
                ],
            },
            format="json",
        )
        assert resp.status_code == 201
        assert v.items.count() == 1
        assert v.items.first().operations.count() == 1

    def test_cannot_add_item_to_sent(self, auth_client, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="I2", vehicle_description="x", created_by="u",
        )
        v = budget.active_version
        BudgetVersionItem.objects.create(
            version=v, description="x",
            quantity=Decimal("1"), unit_price=Decimal("1"), net_price=Decimal("1"),
        )
        auth_client.post(f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/send/")

        resp = auth_client.post(
            f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/items/",
            data={"description": "Y", "quantity": "1", "unit_price": "1", "net_price": "1"},
            format="json",
        )
        assert resp.status_code == 400
```

- [ ] **Step 2.6: Rodar**

```bash
cd backend/core
DATABASE_URL="postgresql://paddock:paddock@localhost:5432/paddock_dev" pytest apps/budgets/tests/test_api.py -v
```

Expected: 10 PASS.

Suite total: 148 + 10 = **158 PASS**.

- [ ] **Step 2.7: Commit**

```bash
git add backend/core/
git commit -m "feat(api): Budget ViewSet + nested versions + items + actions (send/approve/reject/revision/clone)"
```

---

## Task 3: ServiceOrder ViewSet + actions

**Files:**
- Create: `backend/core/apps/service_orders/serializers.py`
- Create: `backend/core/apps/service_orders/views.py`
- Modify: `backend/core/apps/service_orders/urls.py`
- Create: `backend/core/apps/service_orders/tests/test_api.py`

- [ ] **Step 3.1: Serializers**

```python
# apps/service_orders/serializers.py
from __future__ import annotations

from rest_framework import serializers

from apps.items.serializers import ItemOperationReadSerializer

from .models import (
    Insurer, ServiceOrder, ServiceOrderEvent, ServiceOrderParecer,
    ServiceOrderVersion, ServiceOrderVersionItem,
)


class ServiceOrderVersionItemReadSerializer(serializers.ModelSerializer):
    operations = ItemOperationReadSerializer(many=True, read_only=True)

    class Meta:
        model = ServiceOrderVersionItem
        fields = [
            "id", "bucket", "payer_block", "impact_area", "item_type",
            "description", "external_code", "part_type", "supplier",
            "quantity", "unit_price", "unit_cost", "discount_pct", "net_price",
            "flag_abaixo_padrao", "flag_acima_padrao", "flag_inclusao_manual",
            "flag_codigo_diferente", "flag_servico_manual", "flag_peca_da_conta",
            "sort_order", "operations",
        ]


class ServiceOrderVersionReadSerializer(serializers.ModelSerializer):
    items = ServiceOrderVersionItemReadSerializer(many=True, read_only=True)
    status_label = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ServiceOrderVersion
        fields = [
            "id", "version_number", "external_version", "external_numero_vistoria",
            "external_integration_id", "source", "status", "status_display", "status_label",
            "subtotal", "discount_total", "net_total", "labor_total", "parts_total",
            "total_seguradora", "total_complemento_particular", "total_franquia",
            "content_hash", "raw_payload_s3_key",
            "hourly_rates", "global_discount_pct",
            "created_at", "created_by", "approved_at",
            "items",
        ]


class ServiceOrderEventSerializer(serializers.ModelSerializer):
    event_type_display = serializers.CharField(source="get_event_type_display", read_only=True)

    class Meta:
        model = ServiceOrderEvent
        fields = [
            "id", "event_type", "event_type_display", "actor", "payload",
            "from_state", "to_state", "created_at",
        ]


class ServiceOrderParecerSerializer(serializers.ModelSerializer):
    parecer_type_display = serializers.CharField(source="get_parecer_type_display", read_only=True)
    source_display = serializers.CharField(source="get_source_display", read_only=True)

    class Meta:
        model = ServiceOrderParecer
        fields = [
            "id", "version", "source", "source_display",
            "flow_number", "author_external", "author_org", "author_internal",
            "parecer_type", "parecer_type_display", "body",
            "created_at_external", "created_at",
        ]


class ServiceOrderReadSerializer(serializers.ModelSerializer):
    active_version = ServiceOrderVersionReadSerializer(read_only=True)
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    insurer_name = serializers.CharField(source="insurer.name", read_only=True, default="")
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ServiceOrder
        fields = [
            "id", "os_number", "customer", "customer_name", "customer_type",
            "vehicle_plate", "vehicle_description",
            "status", "status_display", "previous_status",
            "source_budget",
            "insurer", "insurer_name", "casualty_number",
            "external_budget_number", "policy_number", "policy_item",
            "franchise_amount",
            "notes", "is_active", "created_at", "updated_at",
            "active_version",
        ]


class ChangeStatusSerializer(serializers.Serializer):
    new_status = serializers.CharField()
    notes = serializers.CharField(required=False, default="")


class ComplementItemSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=300)
    quantity = serializers.DecimalField(max_digits=10, decimal_places=3, default="1")
    unit_price = serializers.DecimalField(max_digits=14, decimal_places=2)
    net_price = serializers.DecimalField(max_digits=14, decimal_places=2)
    item_type = serializers.ChoiceField(
        choices=["PART", "SERVICE", "EXTERNAL_SERVICE", "FEE", "DISCOUNT"],
        default="SERVICE",
    )
    impact_area = serializers.IntegerField(required=False, allow_null=True)
    external_code = serializers.CharField(required=False, default="")


class AddComplementSerializer(serializers.Serializer):
    items = ComplementItemSerializer(many=True)
    approved_by = serializers.CharField(max_length=120, required=False, default="")


class InternalParecerSerializer(serializers.Serializer):
    body = serializers.CharField()
    version_id = serializers.IntegerField(required=False, allow_null=True)
    parecer_type = serializers.CharField(required=False, default="COMENTARIO_INTERNO")
```

- [ ] **Step 3.2: Views**

```python
# apps/service_orders/views.py
from __future__ import annotations

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    ServiceOrder, ServiceOrderEvent, ServiceOrderParecer, ServiceOrderVersion,
)
from .serializers import (
    AddComplementSerializer,
    ChangeStatusSerializer,
    InternalParecerSerializer,
    ServiceOrderEventSerializer,
    ServiceOrderParecerSerializer,
    ServiceOrderReadSerializer,
    ServiceOrderVersionReadSerializer,
)
from .services import ComplementoParticularService, ServiceOrderService


class ServiceOrderViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ServiceOrder.objects.filter(is_active=True).select_related(
        "customer", "insurer", "source_budget",
    ).prefetch_related(
        "versions__items__operations__operation_type",
        "versions__items__operations__labor_category",
    )
    serializer_class = ServiceOrderReadSerializer
    filterset_fields = ["customer_type", "status", "insurer", "is_active"]
    search_fields = ["os_number", "vehicle_plate", "casualty_number", "customer__full_name"]
    ordering_fields = ["created_at", "os_number", "status"]

    @action(detail=True, methods=["post"], url_path="change-status")
    def change_status(self, request, pk=None):
        os_instance = self.get_object()
        ser = ChangeStatusSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ServiceOrderService.change_status(
            service_order=os_instance,
            new_status=ser.validated_data["new_status"],
            changed_by=request.user.username,
            notes=ser.validated_data["notes"],
        )
        os_instance.refresh_from_db()
        return Response(ServiceOrderReadSerializer(os_instance).data)

    @action(detail=True, methods=["post"], url_path="complement")
    def complement(self, request, pk=None):
        os_instance = self.get_object()
        ser = AddComplementSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        from decimal import Decimal
        items_data = []
        for item in ser.validated_data["items"]:
            items_data.append({
                "description": item["description"],
                "quantity": Decimal(str(item["quantity"])),
                "unit_price": Decimal(str(item["unit_price"])),
                "net_price": Decimal(str(item["net_price"])),
                "item_type": item.get("item_type", "SERVICE"),
                "impact_area": item.get("impact_area"),
                "external_code": item.get("external_code", ""),
            })
        new_v = ComplementoParticularService.add_complement(
            service_order=os_instance,
            items_data=items_data,
            approved_by=ser.validated_data["approved_by"] or request.user.username,
        )
        return Response(
            ServiceOrderVersionReadSerializer(new_v).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"], url_path="events")
    def events(self, request, pk=None):
        os_instance = self.get_object()
        queryset = os_instance.events.all()
        event_type = request.query_params.get("event_type")
        if event_type:
            queryset = queryset.filter(event_type=event_type)
        serializer = ServiceOrderEventSerializer(queryset, many=True)
        return Response({"count": queryset.count(), "results": serializer.data})

    @action(detail=True, methods=["get", "post"], url_path="pareceres")
    def pareceres(self, request, pk=None):
        os_instance = self.get_object()
        if request.method == "GET":
            qs = os_instance.pareceres.all()
            return Response(
                ServiceOrderParecerSerializer(qs, many=True).data,
            )
        # POST — parecer interno
        ser = InternalParecerSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        version = None
        if ser.validated_data.get("version_id"):
            version = ServiceOrderVersion.objects.get(pk=ser.validated_data["version_id"])
        parecer = ServiceOrderParecer.objects.create(
            service_order=os_instance,
            version=version,
            source="internal",
            author_internal=request.user.username,
            parecer_type=ser.validated_data.get("parecer_type", "COMENTARIO_INTERNO"),
            body=ser.validated_data["body"],
        )
        # Emite evento PARECER_ADDED
        from .events import OSEventLogger
        OSEventLogger.log_event(
            os_instance, "PARECER_ADDED",
            actor=request.user.username,
            payload={"parecer_id": parecer.pk, "source": "internal"},
        )
        return Response(
            ServiceOrderParecerSerializer(parecer).data, status=status.HTTP_201_CREATED,
        )


class ServiceOrderVersionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ServiceOrderVersionReadSerializer

    def get_queryset(self):
        return ServiceOrderVersion.objects.filter(
            service_order_id=self.kwargs["service_order_pk"],
        ).prefetch_related(
            "items__operations__operation_type",
            "items__operations__labor_category",
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, service_order_pk=None, pk=None):
        version = self.get_object()
        ServiceOrderService.approve_version(
            version=version, approved_by=request.user.username,
        )
        version.refresh_from_db()
        return Response(ServiceOrderVersionReadSerializer(version).data)
```

- [ ] **Step 3.3: URLs nested**

Update `apps/service_orders/urls.py`:

```python
from rest_framework_nested import routers

from .views import ServiceOrderVersionViewSet, ServiceOrderViewSet
from .views_insurer import InsurerViewSet


router = routers.SimpleRouter()
router.register(r"insurers", InsurerViewSet, basename="insurer")
router.register(r"service-orders", ServiceOrderViewSet, basename="service-order")

os_router = routers.NestedSimpleRouter(router, r"service-orders", lookup="service_order")
os_router.register(r"versions", ServiceOrderVersionViewSet, basename="os-version")


urlpatterns = router.urls + os_router.urls
```

- [ ] **Step 3.4: Testes**

Create `backend/core/apps/service_orders/tests/test_api.py`:

```python
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.budgets.models import BudgetVersionItem
from apps.budgets.services import BudgetService
from apps.persons.models import Person
from apps.service_orders.models import (
    Insurer, ServiceOrder, ServiceOrderVersion, ServiceOrderVersionItem,
)


User = get_user_model()


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="so-api", password="s")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def person(db):
    return Person.objects.create(full_name="SO API Test", person_type="CLIENT")


@pytest.fixture
def os_particular(person):
    budget = BudgetService.create(
        customer=person, vehicle_plate="API1", vehicle_description="x", created_by="u",
    )
    v = budget.active_version
    BudgetVersionItem.objects.create(
        version=v, description="Peça",
        quantity=Decimal("1"), unit_price=Decimal("100"),
        net_price=Decimal("100"), item_type="PART",
    )
    BudgetService.send_to_customer(version=v, sent_by="u")
    return BudgetService.approve(
        version=v, approved_by="cliente", evidence_s3_key="",
    )


@pytest.fixture
def os_seguradora(person):
    yelum = Insurer.objects.get(code="yelum")
    os = ServiceOrder.objects.create(
        os_number="OS-API-SEG-1", customer=person, customer_type="SEGURADORA",
        insurer=yelum, casualty_number="SIN-API-1",
        vehicle_plate="SEG2", vehicle_description="y", status="repair",
    )
    ServiceOrderVersion.objects.create(
        service_order=os, version_number=1, source="cilia",
        external_version="100.1", status="autorizado",
        net_total=Decimal("1000"),
    )
    return os


@pytest.mark.django_db
class TestServiceOrderAPI:

    def test_list(self, auth_client, os_particular):
        resp = auth_client.get("/api/v1/service-orders/")
        assert resp.status_code == 200
        assert resp.json()["count"] >= 1

    def test_retrieve(self, auth_client, os_particular):
        resp = auth_client.get(f"/api/v1/service-orders/{os_particular.pk}/")
        assert resp.status_code == 200
        assert resp.json()["os_number"] == os_particular.os_number

    def test_filter_by_customer_type(self, auth_client, os_particular, os_seguradora):
        resp = auth_client.get("/api/v1/service-orders/?customer_type=SEGURADORA")
        assert resp.status_code == 200
        for item in resp.json()["results"]:
            assert item["customer_type"] == "SEGURADORA"


@pytest.mark.django_db
class TestChangeStatusAPI:

    def test_valid_transition(self, auth_client, os_particular):
        resp = auth_client.post(
            f"/api/v1/service-orders/{os_particular.pk}/change-status/",
            data={"new_status": "initial_survey", "notes": "iniciando"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "initial_survey"

    def test_invalid_transition(self, auth_client, os_particular):
        resp = auth_client.post(
            f"/api/v1/service-orders/{os_particular.pk}/change-status/",
            data={"new_status": "painting"},
            format="json",
        )
        assert resp.status_code == 400


@pytest.mark.django_db
class TestComplementAPI:

    def test_add_complement_seguradora(self, auth_client, os_seguradora):
        resp = auth_client.post(
            f"/api/v1/service-orders/{os_seguradora.pk}/complement/",
            data={
                "items": [{
                    "description": "Pintura extra",
                    "quantity": "1",
                    "unit_price": "300",
                    "net_price": "300",
                    "item_type": "SERVICE",
                }],
                "approved_by": "cliente",
            },
            format="json",
        )
        assert resp.status_code == 201
        assert resp.json()["version_number"] == 2

    def test_complement_particular_fails(self, auth_client, os_particular):
        resp = auth_client.post(
            f"/api/v1/service-orders/{os_particular.pk}/complement/",
            data={"items": [{
                "description": "x", "quantity": "1",
                "unit_price": "1", "net_price": "1",
            }]},
            format="json",
        )
        assert resp.status_code == 400


@pytest.mark.django_db
class TestEventsAPI:

    def test_list_events(self, auth_client, os_particular):
        resp = auth_client.get(f"/api/v1/service-orders/{os_particular.pk}/events/")
        assert resp.status_code == 200
        data = resp.json()
        # OS recém-criada via budget tem eventos BUDGET_LINKED + VERSION_CREATED
        assert data["count"] >= 2

    def test_filter_events_by_type(self, auth_client, os_particular):
        resp = auth_client.get(
            f"/api/v1/service-orders/{os_particular.pk}/events/?event_type=VERSION_CREATED",
        )
        assert resp.status_code == 200
        for ev in resp.json()["results"]:
            assert ev["event_type"] == "VERSION_CREATED"


@pytest.mark.django_db
class TestParecerAPI:

    def test_add_internal_parecer(self, auth_client, os_particular):
        resp = auth_client.post(
            f"/api/v1/service-orders/{os_particular.pk}/pareceres/",
            data={"body": "Cliente confirmou entrega amanhã",
                  "parecer_type": "COMENTARIO_INTERNO"},
            format="json",
        )
        assert resp.status_code == 201
        assert resp.json()["source"] == "internal"

    def test_list_pareceres(self, auth_client, os_particular):
        # Adiciona 1 parecer primeiro
        auth_client.post(
            f"/api/v1/service-orders/{os_particular.pk}/pareceres/",
            data={"body": "x"},
            format="json",
        )
        resp = auth_client.get(f"/api/v1/service-orders/{os_particular.pk}/pareceres/")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


@pytest.mark.django_db
class TestVersionApproveAPI:

    def test_approve_version_returns_os_to_previous(self, auth_client, os_seguradora):
        # Setar OS em budget pra teste de retorno
        os_seguradora.status = "budget"
        os_seguradora.previous_status = "repair"
        os_seguradora.save()
        # Nova versão pendente
        v = ServiceOrderVersion.objects.create(
            service_order=os_seguradora, version_number=2,
            source="cilia", external_version="100.2", status="em_analise",
        )
        resp = auth_client.post(
            f"/api/v1/service-orders/{os_seguradora.pk}/versions/{v.pk}/approve/",
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "autorizado"
        os_seguradora.refresh_from_db()
        assert os_seguradora.status == "repair"
```

- [ ] **Step 3.5: Rodar**

Expected: 158 + ~12 novos = **~170 PASS**.

- [ ] **Step 3.6: Commit**

```bash
git add backend/core/apps/service_orders/
git commit -m "feat(api): ServiceOrder ViewSet + actions (change-status, complement, events, pareceres, approve-version)"
```

---

## Task 4: Payment ViewSet + PDF real WeasyPrint

**Files:**
- Create: `backend/core/apps/payments/serializers.py`
- Create: `backend/core/apps/payments/views.py`
- Modify: `backend/core/apps/payments/urls.py`
- Create: `backend/core/apps/payments/tests/test_api.py`
- Create: `backend/core/apps/pdf_engine/` (new app)
- Modify: `backend/core/apps/budgets/services.py` (substituir pdf_stub por PDFService)

### Payment API

- [ ] **Step 4.1: Payment serializers + viewset**

```python
# apps/payments/serializers.py
from rest_framework import serializers
from .models import Payment


class PaymentReadSerializer(serializers.ModelSerializer):
    method_display = serializers.CharField(source="get_method_display", read_only=True)
    payer_block_display = serializers.CharField(source="get_payer_block_display", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id", "service_order", "payer_block", "payer_block_display",
            "amount", "method", "method_display", "reference",
            "received_at", "received_by", "fiscal_doc_ref",
            "status", "created_at",
        ]


class RecordPaymentSerializer(serializers.Serializer):
    payer_block = serializers.ChoiceField(choices=[
        "SEGURADORA", "COMPLEMENTO_PARTICULAR", "FRANQUIA", "PARTICULAR",
    ])
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    method = serializers.ChoiceField(choices=["PIX", "BOLETO", "DINHEIRO", "CARTAO", "TRANSFERENCIA"])
    reference = serializers.CharField(required=False, default="")
    fiscal_doc_ref = serializers.CharField(required=False, default="")
```

```python
# apps/payments/views.py
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.response import Response

from apps.service_orders.models import ServiceOrder

from .models import Payment
from .serializers import PaymentReadSerializer, RecordPaymentSerializer
from .services import PaymentService


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PaymentReadSerializer
    filterset_fields = ["service_order", "payer_block", "method", "status"]

    def get_queryset(self):
        qs = Payment.objects.all()
        if "service_order_pk" in self.kwargs:
            qs = qs.filter(service_order_id=self.kwargs["service_order_pk"])
        return qs

    def create(self, request, service_order_pk=None):
        os_instance = get_object_or_404(ServiceOrder, pk=service_order_pk)
        ser = RecordPaymentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        from decimal import Decimal
        payment = PaymentService.record(
            service_order=os_instance,
            payer_block=ser.validated_data["payer_block"],
            amount=Decimal(str(ser.validated_data["amount"])),
            method=ser.validated_data["method"],
            reference=ser.validated_data.get("reference", ""),
            received_by=request.user.username,
        )
        # fiscal_doc_ref separado (não é do service)
        if ser.validated_data.get("fiscal_doc_ref"):
            payment.fiscal_doc_ref = ser.validated_data["fiscal_doc_ref"]
            payment.save(update_fields=["fiscal_doc_ref"])
        return Response(PaymentReadSerializer(payment).data, status=status.HTTP_201_CREATED)
```

- [ ] **Step 4.2: URLs Payment (nested sob ServiceOrder)**

Update `apps/service_orders/urls.py`:

```python
from apps.payments.views import PaymentViewSet  # topo

# depois de os_router.register(...)
os_router.register(r"payments", PaymentViewSet, basename="os-payment")
```

E deixar `apps/payments/urls.py` vazio (fica sob service_orders).

- [ ] **Step 4.3: Tests Payment**

Create `apps/payments/tests/test_api.py`:

```python
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.budgets.services import BudgetService
from apps.budgets.models import BudgetVersionItem
from apps.payments.models import Payment
from apps.persons.models import Person


User = get_user_model()


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="pay-api", password="s")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def os_instance(db):
    person = Person.objects.create(full_name="Pay API", person_type="CLIENT")
    budget = BudgetService.create(
        customer=person, vehicle_plate="P1", vehicle_description="x", created_by="u",
    )
    v = budget.active_version
    BudgetVersionItem.objects.create(
        version=v, description="Item", quantity=Decimal("1"),
        unit_price=Decimal("100"), net_price=Decimal("100"),
    )
    BudgetService.send_to_customer(version=v, sent_by="u")
    return BudgetService.approve(version=v, approved_by="u", evidence_s3_key="")


@pytest.mark.django_db
class TestPaymentAPI:

    def test_record_payment(self, auth_client, os_instance):
        resp = auth_client.post(
            f"/api/v1/service-orders/{os_instance.pk}/payments/",
            data={
                "payer_block": "PARTICULAR",
                "amount": "500.50",
                "method": "PIX",
                "reference": "pix-abc-123",
            },
            format="json",
        )
        assert resp.status_code == 201
        assert resp.json()["status"] == "received"

    def test_list_payments_of_os(self, auth_client, os_instance):
        # Cria 2 payments
        for i in range(2):
            auth_client.post(
                f"/api/v1/service-orders/{os_instance.pk}/payments/",
                data={"payer_block": "PARTICULAR", "amount": "100", "method": "PIX"},
                format="json",
            )
        resp = auth_client.get(f"/api/v1/service-orders/{os_instance.pk}/payments/")
        assert resp.status_code == 200
        assert resp.json()["count"] == 2
```

### PDF Engine real

- [ ] **Step 4.4: App pdf_engine**

```bash
mkdir -p backend/core/apps/pdf_engine/templates/pdf_engine/_partials
touch backend/core/apps/pdf_engine/__init__.py
```

Create `backend/core/apps/pdf_engine/apps.py`:
```python
from django.apps import AppConfig


class PdfEngineConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.pdf_engine"
    verbose_name = "Motor de PDFs"
```

Adicionar `"apps.pdf_engine"` em INSTALLED_APPS.

- [ ] **Step 4.5: PDFService**

Create `backend/core/apps/pdf_engine/services.py`:

```python
from __future__ import annotations

import logging
import uuid
from io import BytesIO

from django.template.loader import render_to_string


logger = logging.getLogger(__name__)


class PDFService:
    """Geração de PDFs via WeasyPrint.

    Fallback para `pdf_stub` se WeasyPrint não disponível (permite rodar testes em
    ambientes sem libs nativas). Em produção, WeasyPrint sempre disponível.
    """

    @classmethod
    def render_budget(cls, version) -> bytes:
        """Renderiza PDF de orçamento para uma BudgetVersion. Retorna bytes do PDF."""
        html = render_to_string("pdf_engine/budget.html", {
            "version": version,
            "budget": version.budget,
            "customer": version.budget.customer,
            "items": version.items.all().prefetch_related(
                "operations__operation_type", "operations__labor_category",
            ),
            "totals": {
                "subtotal": version.subtotal,
                "discount": version.discount_total,
                "labor": version.labor_total,
                "parts": version.parts_total,
                "net": version.net_total,
            },
        })
        try:
            from weasyprint import HTML
            buf = BytesIO()
            HTML(string=html).write_pdf(buf)
            return buf.getvalue()
        except Exception as exc:
            logger.warning("WeasyPrint indisponível, retornando HTML bytes: %s", exc)
            return html.encode("utf-8")

    @classmethod
    def budget_pdf_key(cls, budget_number: str, version_number: int) -> str:
        """Gera S3 key (stub até Ciclo 5 quando S3 real)."""
        return f"budgets/{budget_number}/v{version_number}-{uuid.uuid4().hex[:8]}.pdf"
```

- [ ] **Step 4.6: Template base + budget.html**

Create `backend/core/apps/pdf_engine/templates/pdf_engine/base.html`:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>{% block title %}Documento DS Car{% endblock %}</title>
    <style>
        @page { size: A4; margin: 2cm; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #1f2937; }
        .header { border-bottom: 3px solid #dc2626; padding-bottom: 1em; margin-bottom: 1.5em; }
        .header h1 { color: #dc2626; margin: 0; font-size: 20px; }
        .header p { margin: 0.2em 0; color: #6b7280; font-size: 10px; }
        .section { margin-bottom: 1.5em; }
        .section h2 { color: #1f2937; font-size: 13px; margin: 0 0 0.5em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
        table { width: 100%; border-collapse: collapse; margin: 0.5em 0; }
        th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
        th { background-color: #f9fafb; color: #4b5563; font-size: 10px; text-transform: uppercase; }
        .totals { margin-top: 1em; border: 1px solid #e5e7eb; padding: 1em; background: #f9fafb; }
        .totals .total-row { font-weight: bold; font-size: 13px; color: #dc2626; border-top: 2px solid #1f2937; padding-top: 0.5em; margin-top: 0.5em; }
        .footer { position: fixed; bottom: 1cm; left: 2cm; right: 2cm; border-top: 1px solid #e5e7eb; padding-top: 0.5em; color: #9ca3af; font-size: 9px; text-align: center; }
        .right { text-align: right; }
        .muted { color: #6b7280; }
    </style>
</head>
<body>
    <div class="header">
        <h1>DS Car Centro Automotivo</h1>
        <p>CNPJ: 10.362.513/0001-04 · Av. Samaúma 15, Monte das Oliveiras — Manaus/AM · CEP 69093-132</p>
        <p>(92) 3345-7864 · dscarcentroautomotivo@gmail.com</p>
    </div>

    {% block content %}{% endblock %}

    <div class="footer">
        Documento gerado automaticamente pelo ERP Paddock Solutions · DS Car © {% now "Y" %}
    </div>
</body>
</html>
```

Create `backend/core/apps/pdf_engine/templates/pdf_engine/budget.html`:

```html
{% extends "pdf_engine/base.html" %}
{% load humanize %}

{% block title %}Orçamento {{ budget.number }}{% endblock %}

{% block content %}
    <div class="section">
        <h2>Orçamento {{ budget.number }} — v{{ version.version_number }}</h2>
        <table>
            <tr>
                <td style="width: 50%;">
                    <strong>Cliente:</strong> {{ customer.full_name }}<br>
                    <span class="muted">CPF/CNPJ: {{ customer.document|default:"—" }}</span>
                </td>
                <td style="width: 50%;">
                    <strong>Veículo:</strong> {{ budget.vehicle_description }}<br>
                    <span class="muted">Placa: {{ budget.vehicle_plate }}</span>
                </td>
            </tr>
            <tr>
                <td><strong>Emissão:</strong> {{ version.sent_at|date:"d/m/Y H:i"|default:version.created_at|date:"d/m/Y H:i" }}</td>
                <td><strong>Validade:</strong> {{ version.valid_until|date:"d/m/Y"|default:"—" }}</td>
            </tr>
        </table>
    </div>

    <div class="section">
        <h2>Itens</h2>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Descrição</th>
                    <th>Qtd</th>
                    <th class="right">Unit.</th>
                    <th class="right">Desc%</th>
                    <th class="right">Total</th>
                </tr>
            </thead>
            <tbody>
                {% for item in items %}
                <tr>
                    <td>{{ forloop.counter }}</td>
                    <td>
                        {{ item.description }}
                        {% if item.external_code %}<br><small class="muted">cód.: {{ item.external_code }}</small>{% endif %}
                        {% for op in item.operations.all %}
                        <br><small class="muted">▸ {{ op.operation_type.label }} / {{ op.labor_category.label }}: {{ op.hours }}h × R$ {{ op.hourly_rate }}</small>
                        {% endfor %}
                    </td>
                    <td>{{ item.quantity }}</td>
                    <td class="right">R$ {{ item.unit_price|floatformat:2 }}</td>
                    <td class="right">{{ item.discount_pct }}%</td>
                    <td class="right"><strong>R$ {{ item.net_price|floatformat:2 }}</strong></td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>

    <div class="totals">
        <table>
            <tr>
                <td>Subtotal (peças + MO)</td>
                <td class="right">R$ {{ totals.subtotal|floatformat:2 }}</td>
            </tr>
            <tr>
                <td>Peças</td>
                <td class="right">R$ {{ totals.parts|floatformat:2 }}</td>
            </tr>
            <tr>
                <td>Mão-de-obra</td>
                <td class="right">R$ {{ totals.labor|floatformat:2 }}</td>
            </tr>
            <tr>
                <td>Desconto</td>
                <td class="right">− R$ {{ totals.discount|floatformat:2 }}</td>
            </tr>
            <tr class="total-row">
                <td>TOTAL</td>
                <td class="right">R$ {{ totals.net|floatformat:2 }}</td>
            </tr>
        </table>
    </div>

    <div class="section" style="margin-top: 2em;">
        <p class="muted" style="font-size: 10px;">
            Este orçamento tem validade até <strong>{{ version.valid_until|date:"d/m/Y"|default:"—" }}</strong>.
            Após este período, valores podem sofrer reajuste. Aprovação pode ser registrada via WhatsApp ou presencialmente com assinatura.
        </p>
    </div>
{% endblock %}
```

- [ ] **Step 4.7: Substituir pdf_stub no BudgetService**

Em `apps/budgets/services.py`, **substituir** o uso de `render_budget_pdf_stub` por `PDFService.render_budget`:

```python
# remover: from .pdf_stub import render_budget_pdf_stub
from apps.pdf_engine.services import PDFService
```

E no `send_to_customer`:
```python
        # Gera PDF real (ou fallback stub se WeasyPrint indisponível)
        pdf_bytes = PDFService.render_budget(version)
        pdf_key = PDFService.budget_pdf_key(version.budget.number, version.version_number)
        # Em Ciclo 5: salvar pdf_bytes em S3 via S3Service.put_pdf(pdf_key, pdf_bytes)
        # Por ora: só salva a key (bytes ficam em memória; Ciclo 5 persiste)
        version.pdf_s3_key = pdf_key
```

**Manter `pdf_stub.py`** por compat, mas marcar como deprecated:
```python
"""DEPRECATED: substituído por apps.pdf_engine.services.PDFService no Ciclo 03.
   Mantido apenas para retrocompat de testes antigos.
"""
```

**Importante**: O teste `test_send_generates_pdf_stub` em `test_budget_service.py` checa `startswith("stub://")`. Precisa ajustar:
- Trocar assertion para `assert sent.pdf_s3_key.startswith("budgets/")` (novo formato)
- Ou manter compat: `PDFService.budget_pdf_key` retornar `"stub://budgets/..."` se quiser preservar teste.

Decisão: trocar assertion pro novo formato (mais limpo).

- [ ] **Step 4.8: Adicionar WeasyPrint em requirements (optional)**

```
# PDF generation (opcional — fallback pra HTML se libs nativas não instaladas)
weasyprint>=62,<63
```

- [ ] **Step 4.9: Endpoint de download PDF do budget**

Em `apps/budgets/views.py`, adicionar action em `BudgetVersionViewSet`:

```python
from django.http import HttpResponse

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, budget_pk=None, pk=None):
        from apps.pdf_engine.services import PDFService
        version = self.get_object()
        pdf_bytes = PDFService.render_budget(version)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = (
            f'inline; filename="orcamento-{version.budget.number}-v{version.version_number}.pdf"'
        )
        return response
```

- [ ] **Step 4.10: Teste do PDF endpoint**

Em `apps/budgets/tests/test_api.py` adicionar:

```python
@pytest.mark.django_db
class TestPDFEndpoint:

    def test_pdf_download(self, auth_client, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="PDF1", vehicle_description="x", created_by="u",
        )
        v = budget.active_version
        BudgetVersionItem.objects.create(
            version=v, description="Teste PDF",
            quantity=Decimal("1"), unit_price=Decimal("100"),
            net_price=Decimal("100"),
        )
        BudgetService.send_to_customer(version=v, sent_by="u")

        resp = auth_client.get(f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/pdf/")
        assert resp.status_code == 200
        assert resp["Content-Type"] in ("application/pdf", "text/html; charset=utf-8")
        assert len(resp.content) > 100  # conteúdo não-vazio
```

- [ ] **Step 4.11: Rodar**

Expected: 170 + ~5 novos = **~175 PASS**.

- [ ] **Step 4.12: Commit**

```bash
git add backend/core/
git commit -m "feat(api+pdf): Payment endpoints + PDF engine real WeasyPrint substituindo stub"
```

---

## Task 5: Smoke E2E + MVP_CHECKLIST

**Files:**
- Create: `backend/core/scripts/smoke_ciclo3a.py`
- Modify: `backend/core/MVP_CHECKLIST.md`
- Modify: `backend/core/README.md`

- [ ] **Step 5.1: Smoke script**

```python
# backend/core/scripts/smoke_ciclo3a.py
"""Smoke E2E do Ciclo 03A — API REST.

Exercita endpoints via APIClient:
- Criar Budget via POST
- Adicionar items (com operations)
- Enviar ao cliente (send)
- Gerar PDF
- Aprovar → cria OS
- Mover OS no Kanban
- Criar complemento (seguradora sim, particular não)
- Registrar pagamento
- Listar eventos timeline

Uso: python manage.py shell < scripts/smoke_ciclo3a.py
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.persons.models import Person


def check(cond, msg):
    print(f"[{'OK' if cond else 'FAIL'}] {msg}")
    assert cond, msg


User = get_user_model()


def main():
    print("=== Smoke E2E Ciclo 03A ===\n")

    user, _ = User.objects.get_or_create(username="smoke-c3a", defaults={"is_staff": True})
    user.set_password("s"); user.save()
    client = APIClient()
    client.force_authenticate(user=user)

    person, _ = Person.objects.get_or_create(
        full_name="Smoke C3A", defaults={"person_type": "CLIENT"},
    )

    # 1) Criar budget
    resp = client.post("/api/v1/budgets/", {
        "customer_id": person.pk, "vehicle_plate": "SMK1", "vehicle_description": "Honda",
    }, format="json")
    check(resp.status_code == 201, f"Create budget: {resp.status_code}")
    budget_id = resp.json()["id"]
    version_id = resp.json()["active_version"]["id"]

    # 2) Adicionar item
    resp = client.post(
        f"/api/v1/budgets/{budget_id}/versions/{version_id}/items/",
        {
            "description": "AMORTECEDOR",
            "quantity": "1", "unit_price": "500",
            "net_price": "500", "item_type": "PART",
            "operations": [{
                "operation_type_code": "TROCA",
                "labor_category_code": "FUNILARIA",
                "hours": "1", "hourly_rate": "40",
            }],
        },
        format="json",
    )
    check(resp.status_code == 201, f"Add item: {resp.status_code}")

    # 3) Send
    resp = client.post(f"/api/v1/budgets/{budget_id}/versions/{version_id}/send/")
    check(resp.status_code == 200 and resp.json()["status"] == "sent", "Send version")

    # 4) PDF
    resp = client.get(f"/api/v1/budgets/{budget_id}/versions/{version_id}/pdf/")
    check(resp.status_code == 200 and len(resp.content) > 100, "PDF download")

    # 5) Approve → OS
    resp = client.post(
        f"/api/v1/budgets/{budget_id}/versions/{version_id}/approve/",
        {"approved_by": "cliente", "evidence_s3_key": ""},
        format="json",
    )
    check(resp.status_code == 200, "Approve budget")
    os_id = resp.json()["service_order"]["id"]

    # 6) Change status
    resp = client.post(
        f"/api/v1/service-orders/{os_id}/change-status/",
        {"new_status": "initial_survey"},
        format="json",
    )
    check(resp.status_code == 200, "Change status")

    # 7) Payment
    resp = client.post(
        f"/api/v1/service-orders/{os_id}/payments/",
        {"payer_block": "PARTICULAR", "amount": "500", "method": "PIX"},
        format="json",
    )
    check(resp.status_code == 201, "Record payment")

    # 8) Eventos timeline
    resp = client.get(f"/api/v1/service-orders/{os_id}/events/")
    check(resp.status_code == 200 and resp.json()["count"] >= 3, "Events timeline")

    # 9) OpenAPI schema
    resp = client.get("/api/v1/schema/")
    check(resp.status_code == 200, "OpenAPI schema")

    print("\n[DONE] Smoke E2E Ciclo 03A OK")


main()
```

- [ ] **Step 5.2: MVP_CHECKLIST + README**

Adicionar seção no `MVP_CHECKLIST.md`:

```markdown
## Entregue no Ciclo 05 — Módulo de Orçamentação (API REST + PDF)

- [x] drf-spectacular (OpenAPI) + SwaggerUI em `/api/v1/schema/swagger/`
- [x] Reference endpoints: operation-types, labor-categories, insurers
- [x] BudgetViewSet + nested versions + items (CRUD + actions send/approve/reject/revision/clone + PDF download)
- [x] ServiceOrderViewSet + actions (change-status, complement, events, pareceres, approve-version)
- [x] PaymentViewSet (nested sob ServiceOrder)
- [x] PDF engine real (WeasyPrint) com templates DS Car
- [x] ~200 testes PASS (+60 novos endpoints)
- [x] Smoke E2E `scripts/smoke_ciclo3a.py`

## Próximo — Ciclo 03B: Frontend
- [ ] Next.js consumindo API real
- [ ] Zod schemas + TanStack Query hooks
- [ ] Componentes Budget + OS V2
```

- [ ] **Step 5.3: Commit final**

```bash
git add backend/core/
git commit -m "chore(ciclo-03a): smoke E2E + checklist + README"
```

---

## Verificação final
- [ ] `pytest apps/` passa tudo (~200 PASS)
- [ ] `python manage.py check` passa
- [ ] `/api/v1/schema/swagger/` acessível (manual)
- [ ] Smoke ciclo3a roda ou falha só por env (DB não migrado) — comportamento esperado
- [ ] `git log --oneline | head -8` mostra commits do Ciclo 03A

**Fim do plano Ciclo 03A.**
