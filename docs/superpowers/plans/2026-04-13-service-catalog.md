# Catálogo de Serviços + ServicesTab OS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o catálogo de serviços em `/cadastros/servicos`, a aba "Serviços" na OS, e garantir que toda inserção, edição ou remoção de peças e serviços na OS apareça no histórico de atividades.

**Architecture:** Novo model `ServiceCatalog` no app `service_orders`, FK opcional em `ServiceOrderLabor`, ViewSet RESTful, página CRUD em Cadastros e ServicesTab no detalhe da OS. Todas as operações de parts/labor (add, edit, remove) criam `ServiceOrderActivityLog` com metadados estruturados.

**Tech Stack:** Django 5 + DRF, Next.js 15 App Router, TypeScript strict, TanStack Query v5, React Hook Form + Zod, Tailwind CSS + shadcn/ui

---

## File Structure

**Backend (criar/modificar):**
- Modify: `backend/core/apps/service_orders/models.py` — adicionar `ServiceCatalog` e FK em `ServiceOrderLabor`
- Modify: `backend/core/apps/service_orders/serializers.py` — `ServiceCatalogSerializer`, `ServiceCatalogListSerializer`, atualizar `ServiceOrderLaborSerializer`
- Modify: `backend/core/apps/service_orders/views.py` — `ServiceCatalogViewSet`
- Modify: `backend/core/apps/service_orders/urls.py` — registrar router
- Create: `backend/core/apps/service_orders/migrations/00XX_service_catalog.py` — gerada via makemigrations

**Frontend (criar/modificar):**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/HistoryTab.tsx` — configs para `part_updated`, `labor_updated`
- Create: `packages/types/src/service-catalog.types.ts` — tipos TypeScript
- Create: `apps/dscar-web/src/hooks/useServiceCatalog.ts` — hooks TanStack Query
- Create: `apps/dscar-web/src/app/(app)/cadastros/servicos/page.tsx`
- Create: `apps/dscar-web/src/app/(app)/cadastros/servicos/_components/ServiceCatalogTable.tsx`
- Create: `apps/dscar-web/src/app/(app)/cadastros/servicos/_components/ServiceCatalogDialog.tsx`
- Create: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ServicesTab.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/page.tsx` — adicionar aba ServicesTab
- Modify: `apps/dscar-web/src/components/Sidebar.tsx` — adicionar "Serviços" no submenu Cadastros

---

### Task 1: Backend — Model ServiceCatalog + migração

**Files:**
- Modify: `backend/core/apps/service_orders/models.py`
- Create: migration (via makemigrations)

- [ ] **Step 1: Adicionar ServiceCatalog e FK em ServiceOrderLabor**

Adicionar antes da classe `ServiceOrderLaborQuerySet` em `models.py`:

```python
# ─── Catálogo de Serviços ─────────────────────────────────────────────────────

class ServiceCatalogCategory(models.TextChoices):
    FUNILARIA    = "funilaria",    "Funilaria / Chapeação"
    PINTURA      = "pintura",      "Pintura"
    MECANICA     = "mecanica",     "Mecânica"
    ELETRICA     = "eletrica",     "Elétrica"
    ESTETICA     = "estetica",     "Estética"
    ALINHAMENTO  = "alinhamento",  "Alinhamento / Balanceamento"
    REVISAO      = "revisao",      "Revisão"
    LAVAGEM      = "lavagem",      "Lavagem / Higienização"
    OUTROS       = "outros",       "Outros"


class ServiceCatalog(PaddockBaseModel):
    """
    Catálogo de serviços reutilizáveis.
    Preço sugerido pré-preenche ServiceOrderLabor mas é sempre editável.
    """

    name = models.CharField(max_length=200, verbose_name="Nome do serviço")
    description = models.TextField(blank=True, verbose_name="Descrição / observação")
    category = models.CharField(
        max_length=20,
        choices=ServiceCatalogCategory.choices,
        default=ServiceCatalogCategory.OUTROS,
        verbose_name="Categoria",
    )
    suggested_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name="Preço sugerido",
    )
    is_active = models.BooleanField(default=True, verbose_name="Ativo")

    class Meta:
        db_table = "service_catalog"
        ordering = ["category", "name"]
        verbose_name = "Serviço do catálogo"
        verbose_name_plural = "Catálogo de serviços"

    def __str__(self) -> str:
        return f"{self.name} ({self.get_category_display()})"
```

Depois, dentro de `ServiceOrderLabor`, adicionar FK após o campo `service_order`:

```python
    service_catalog = models.ForeignKey(
        "ServiceCatalog",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="labor_items",
        verbose_name="Serviço do catálogo",
    )
```

- [ ] **Step 2: Gerar e verificar migração**

```bash
cd backend/core
python manage.py makemigrations service_orders --name service_catalog
```

Verificar que a migração criou:
- tabela `service_catalog` com todos os campos
- coluna `service_catalog_id` em `service_orders_labor`

- [ ] **Step 3: Aplicar migração**

```bash
python manage.py migrate
```

Expected: `Applying service_orders.00XX_service_catalog... OK`

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/service_orders/models.py backend/core/apps/service_orders/migrations/
git commit -m "feat(service-orders): add ServiceCatalog model and FK in ServiceOrderLabor"
```

---

### Task 2: Backend — Serializers e ViewSet

**Files:**
- Modify: `backend/core/apps/service_orders/serializers.py`
- Modify: `backend/core/apps/service_orders/views.py`
- Modify: `backend/core/apps/service_orders/urls.py`

- [ ] **Step 1: Escrever testes para ServiceCatalogViewSet**

Criar `backend/core/apps/service_orders/tests/test_service_catalog.py`:

```python
"""Testes para o catálogo de serviços."""
import pytest
from decimal import Decimal
from django.urls import reverse
from rest_framework.test import APIClient
from apps.service_orders.models import ServiceCatalog


@pytest.mark.django_db
class TestServiceCatalogViewSet:
    def setup_method(self) -> None:
        self.client = APIClient()
        # Autenticar com dev JWT ou force_authenticate
        from apps.authentication.models import GlobalUser
        self.user = GlobalUser.objects.create_user(
            email="test@dscar.com",
            password="testpass",
        )
        self.client.force_authenticate(user=self.user)

    def test_list_returns_active_only(self) -> None:
        ServiceCatalog.objects.create(name="Pintura", category="pintura", suggested_price=Decimal("1200.00"))
        ServiceCatalog.objects.create(name="Inativo", category="outros", suggested_price=Decimal("0"), is_active=False)
        response = self.client.get("/api/service-catalog/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["name"] == "Pintura"

    def test_create_service(self) -> None:
        response = self.client.post("/api/service-catalog/", {
            "name": "Funilaria Completa",
            "category": "funilaria",
            "suggested_price": "800.00",
        }, format="json")
        assert response.status_code == 201
        assert response.data["name"] == "Funilaria Completa"
        assert response.data["suggested_price"] == "800.00"

    def test_soft_delete(self) -> None:
        svc = ServiceCatalog.objects.create(name="X", category="outros", suggested_price=Decimal("0"))
        response = self.client.delete(f"/api/service-catalog/{svc.id}/")
        assert response.status_code == 204
        svc.refresh_from_db()
        assert svc.is_active is False

    def test_search_filter(self) -> None:
        ServiceCatalog.objects.create(name="Polimento Técnico", category="estetica", suggested_price=Decimal("300"))
        ServiceCatalog.objects.create(name="Lavagem Simples", category="lavagem", suggested_price=Decimal("50"))
        response = self.client.get("/api/service-catalog/?search=polimento")
        assert response.status_code == 200
        assert len(response.data["results"]) == 1
```

- [ ] **Step 2: Rodar testes para confirmar falha**

```bash
cd backend/core
pytest apps/service_orders/tests/test_service_catalog.py -v
```

Expected: ImportError ou 404 (endpoint ainda não existe)

- [ ] **Step 3: Adicionar serializers em serializers.py**

Adicionar após `ServiceOrderLaborSerializer`:

```python
class ServiceCatalogSerializer(serializers.ModelSerializer):
    """Serializer completo para criação/edição do catálogo."""

    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = ServiceCatalog
        fields = [
            "id", "name", "description", "category", "category_display",
            "suggested_price", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "category_display", "created_at", "updated_at"]


class ServiceCatalogListSerializer(serializers.ModelSerializer):
    """Serializer compacto para listas e combobox."""

    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = ServiceCatalog
        fields = ["id", "name", "category", "category_display", "suggested_price"]
```

Atualizar `ServiceOrderLaborSerializer` para incluir `service_catalog`:

```python
class ServiceOrderLaborSerializer(serializers.ModelSerializer):
    """Serializer para itens de mão-de-obra de uma OS."""

    total = serializers.FloatField(read_only=True)
    service_catalog_name = serializers.CharField(
        source="service_catalog.name", read_only=True, allow_null=True
    )

    class Meta:
        model = ServiceOrderLabor
        fields = [
            "id", "service_catalog", "service_catalog_name",
            "description", "quantity", "unit_price", "discount", "total",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "total", "service_catalog_name", "created_at", "updated_at"]
```

- [ ] **Step 4: Adicionar ServiceCatalogViewSet em views.py**

Adicionar imports no topo de views.py:
```python
from .models import ServiceCatalog, ServiceCatalogCategory
from .serializers import ServiceCatalogSerializer, ServiceCatalogListSerializer
```

Adicionar ViewSet após `DashboardStatsView`:

```python
class ServiceCatalogViewSet(viewsets.ModelViewSet):
    """
    CRUD do catálogo de serviços.
    DELETE faz soft delete (is_active=False).
    """

    serializer_class = ServiceCatalogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self) -> models.QuerySet:
        qs = ServiceCatalog.objects.filter(is_active=True)
        search = self.request.query_params.get("search", "")
        category = self.request.query_params.get("category", "")
        if search:
            qs = qs.filter(name__icontains=search)
        if category:
            qs = qs.filter(category=category)
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return ServiceCatalogListSerializer
        return ServiceCatalogSerializer

    def destroy(self, request, *args, **kwargs):
        """Soft delete: apenas marca is_active=False."""
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)
```

- [ ] **Step 5: Registrar ViewSet em urls.py**

```python
from .views import DashboardStatsView, ServiceOrderViewSet, ServiceCatalogViewSet

catalog_router = DefaultRouter()
catalog_router.register(r"service-catalog", ServiceCatalogViewSet, basename="service-catalog")

urlpatterns = [
    path("dashboard/stats/", DashboardStatsView.as_view(), name="service-order-dashboard-stats"),
    path("", include(router.urls)),
    path("", include(catalog_router.urls)),
]
```

- [ ] **Step 6: Rodar testes para confirmar aprovação**

```bash
pytest apps/service_orders/tests/test_service_catalog.py -v
```

Expected: 4/4 PASSED

- [ ] **Step 7: Commit**

```bash
git add backend/core/apps/service_orders/serializers.py \
        backend/core/apps/service_orders/views.py \
        backend/core/apps/service_orders/urls.py \
        backend/core/apps/service_orders/tests/test_service_catalog.py
git commit -m "feat(service-orders): ServiceCatalogViewSet with soft delete + search filter"
```

---

### Task 2B: Backend — Histórico completo para Peças e Serviços

> **Executar após Task 2.** Corrige logs ausentes em operações existentes (parts) e adiciona logs para as novas operações de labor. Qualquer inserção, edição ou remoção de peça/serviço deve gerar uma entrada no histórico da OS.

**Files:**
- Modify: `backend/core/apps/service_orders/models.py` — adicionar `PART_UPDATED`, `LABOR_UPDATED` a `ActivityType`
- Modify: `backend/core/apps/service_orders/views.py` — inserir logs em todas as 6 ações de parts/labor
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/HistoryTab.tsx` — configs visuais para novos tipos

**Estado atual (o que está e o que falta):**

| Ação | Endpoint | Log atual |
|------|----------|-----------|
| Adicionar peça | POST /parts/ | ❌ ausente |
| Editar peça | PATCH /parts/{pk}/ | ❌ ausente |
| Remover peça | DELETE /parts/{pk}/ | ✅ `part_removed` |
| Adicionar serviço | POST /labor/ | ❌ ausente |
| Editar serviço | PATCH /labor/{pk}/ | ❌ ausente |
| Remover serviço | DELETE /labor/{pk}/ | ✅ `labor_removed` |

- [ ] **Step 1: Escrever testes para os logs ausentes**

`backend/core/apps/service_orders/tests/test_history_logging.py`:

```python
"""Testes para garantir que parts/labor geram ActivityLog corretamente."""
import pytest
from decimal import Decimal
from rest_framework.test import APIClient
from apps.authentication.models import GlobalUser
from apps.service_orders.models import ServiceOrder, ServiceOrderActivityLog


def make_open_os(user: GlobalUser) -> ServiceOrder:
    return ServiceOrder.objects.create(
        plate="ABC1D23",
        make="Honda",
        model="Civic",
        customer_type="private",
        status="reception",
        created_by=user,
    )


@pytest.mark.django_db
class TestPartsHistoryLogging:
    def setup_method(self) -> None:
        self.client = APIClient()
        self.user = GlobalUser.objects.create_user(email="tech@dscar.com", password="pass")
        self.client.force_authenticate(user=self.user)
        self.os = make_open_os(self.user)

    def test_add_part_logs_part_added(self) -> None:
        self.client.post(
            f"/api/service-orders/{self.os.id}/parts/",
            {"description": "Filtro de óleo", "quantity": "1", "unit_price": "45.00", "discount": "0"},
            format="json",
        )
        log = ServiceOrderActivityLog.objects.filter(
            service_order=self.os, activity_type="part_added"
        ).first()
        assert log is not None
        assert "Filtro de óleo" in log.description
        assert log.metadata["unit_price"] == "45.00"

    def test_edit_part_logs_part_updated(self) -> None:
        resp = self.client.post(
            f"/api/service-orders/{self.os.id}/parts/",
            {"description": "Filtro", "quantity": "1", "unit_price": "45.00", "discount": "0"},
            format="json",
        )
        part_id = resp.data["id"]
        self.client.patch(
            f"/api/service-orders/{self.os.id}/parts/{part_id}/",
            {"unit_price": "52.00"},
            format="json",
        )
        log = ServiceOrderActivityLog.objects.filter(
            service_order=self.os, activity_type="part_updated"
        ).first()
        assert log is not None
        changes = log.metadata.get("field_changes", [])
        assert any(c["field_label"] == "Valor Unit." for c in changes)

    def test_remove_part_logs_part_removed(self) -> None:
        resp = self.client.post(
            f"/api/service-orders/{self.os.id}/parts/",
            {"description": "Filtro", "quantity": "1", "unit_price": "45.00", "discount": "0"},
            format="json",
        )
        part_id = resp.data["id"]
        self.client.delete(f"/api/service-orders/{self.os.id}/parts/{part_id}/")
        assert ServiceOrderActivityLog.objects.filter(
            service_order=self.os, activity_type="part_removed"
        ).exists()


@pytest.mark.django_db
class TestLaborHistoryLogging:
    def setup_method(self) -> None:
        self.client = APIClient()
        self.user = GlobalUser.objects.create_user(email="tech2@dscar.com", password="pass")
        self.client.force_authenticate(user=self.user)
        self.os = make_open_os(self.user)

    def test_add_labor_logs_labor_added(self) -> None:
        self.client.post(
            f"/api/service-orders/{self.os.id}/labor/",
            {"description": "Troca de óleo", "quantity": "1", "unit_price": "80.00", "discount": "0"},
            format="json",
        )
        log = ServiceOrderActivityLog.objects.filter(
            service_order=self.os, activity_type="labor_added"
        ).first()
        assert log is not None
        assert "Troca de óleo" in log.description
        assert log.metadata["unit_price"] == "80.00"

    def test_edit_labor_logs_labor_updated(self) -> None:
        resp = self.client.post(
            f"/api/service-orders/{self.os.id}/labor/",
            {"description": "Pintura", "quantity": "1", "unit_price": "800.00", "discount": "0"},
            format="json",
        )
        labor_id = resp.data["id"]
        self.client.patch(
            f"/api/service-orders/{self.os.id}/labor/{labor_id}/",
            {"unit_price": "900.00"},
            format="json",
        )
        log = ServiceOrderActivityLog.objects.filter(
            service_order=self.os, activity_type="labor_updated"
        ).first()
        assert log is not None
        changes = log.metadata.get("field_changes", [])
        assert any(c["field_label"] == "Valor Unit." for c in changes)

    def test_remove_labor_logs_labor_removed(self) -> None:
        resp = self.client.post(
            f"/api/service-orders/{self.os.id}/labor/",
            {"description": "Pintura", "quantity": "1", "unit_price": "800.00", "discount": "0"},
            format="json",
        )
        labor_id = resp.data["id"]
        self.client.delete(f"/api/service-orders/{self.os.id}/labor/{labor_id}/")
        assert ServiceOrderActivityLog.objects.filter(
            service_order=self.os, activity_type="labor_removed"
        ).exists()
```

- [ ] **Step 2: Rodar testes para confirmar falha**

```bash
cd backend/core
pytest apps/service_orders/tests/test_history_logging.py -v
```

Expected: `test_add_part_logs_part_added` FAIL, `test_edit_part_logs_part_updated` FAIL, `test_add_labor_logs_labor_added` FAIL, `test_edit_labor_logs_labor_updated` FAIL. Os de remoção passam.

- [ ] **Step 3: Adicionar PART_UPDATED e LABOR_UPDATED ao ActivityType em models.py**

Localizar `ActivityType` e adicionar após `LABOR_REMOVED`:

```python
    PART_ADDED        = "part_added",        "Peça Adicionada"
    PART_REMOVED      = "part_removed",      "Peça Removida"
    PART_UPDATED      = "part_updated",      "Peça Editada"      # ← NOVO
    LABOR_ADDED       = "labor_added",       "Serviço Adicionado"
    LABOR_REMOVED     = "labor_removed",     "Serviço Removido"
    LABOR_UPDATED     = "labor_updated",     "Serviço Editado"   # ← NOVO
```

`ActivityType` usa `TextChoices` — não gera migration (choices não são DDL). Não é necessário `makemigrations` para isso.

- [ ] **Step 4: Adicionar helper de field_changes em views.py**

Adicionar função utilitária no topo de `views.py` (após os imports):

```python
def _build_field_changes(
    old_data: dict,
    new_data: dict,
    field_map: dict[str, str],
) -> list[dict]:
    """
    Compara old_data e new_data usando field_map {campo: label_pt}.
    Retorna lista de {field_label, old_value, new_value} para campos alterados.
    """
    changes = []
    for field, label in field_map.items():
        old_val = str(old_data.get(field, "")) if old_data.get(field) is not None else ""
        new_val = str(new_data.get(field, "")) if new_data.get(field) is not None else ""
        if old_val != new_val and new_val:
            changes.append({"field_label": label, "old_value": old_val, "new_value": new_val})
    return changes


PART_FIELD_MAP = {
    "description": "Descrição",
    "quantity": "Qtd.",
    "unit_price": "Valor Unit.",
    "discount": "Desconto",
}

LABOR_FIELD_MAP = {
    "description": "Descrição",
    "quantity": "Qtd.",
    "unit_price": "Valor Unit.",
    "discount": "Desconto",
}
```

- [ ] **Step 5: Corrigir action `parts` — adicionar log no POST**

Na action `parts` em `views.py`, substituir:

```python
            # ANTES:
            serializer = ServiceOrderPartSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(service_order=service_order, created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

            # DEPOIS:
            serializer = ServiceOrderPartSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            part = serializer.save(service_order=service_order, created_by=request.user)
            ServiceOrderActivityLog.objects.create(
                service_order=service_order,
                user=request.user,
                activity_type="part_added",
                description=f"Peça '{part.description}' adicionada — {part.quantity}× R${part.unit_price}",
                metadata={
                    "description": part.description,
                    "quantity": str(part.quantity),
                    "unit_price": str(part.unit_price),
                    "discount": str(part.discount),
                    "total": str(part.total),
                },
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
```

- [ ] **Step 6: Corrigir action `part_detail` — adicionar log no PATCH**

Na action `part_detail`, substituir o bloco PATCH:

```python
        # ANTES:
        serializer = ServiceOrderPartSerializer(part, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

        # DEPOIS:
        old_data = {f: str(getattr(part, f, "")) for f in PART_FIELD_MAP}
        serializer = ServiceOrderPartSerializer(part, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated_part = serializer.save()
        new_data = {f: str(getattr(updated_part, f, "")) for f in PART_FIELD_MAP}
        changes = _build_field_changes(old_data, new_data, PART_FIELD_MAP)
        if changes:
            ServiceOrderActivityLog.objects.create(
                service_order=service_order,
                user=request.user,
                activity_type="part_updated",
                description=f"Peça '{updated_part.description}' editada",
                metadata={"field_changes": changes},
            )
        return Response(serializer.data)
```

- [ ] **Step 7: Corrigir action `labor` — adicionar log no POST**

Na action `labor`, substituir o bloco POST:

```python
            # ANTES:
            serializer = ServiceOrderLaborSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(service_order=service_order, created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

            # DEPOIS:
            serializer = ServiceOrderLaborSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            labor = serializer.save(service_order=service_order, created_by=request.user)
            ServiceOrderActivityLog.objects.create(
                service_order=service_order,
                user=request.user,
                activity_type="labor_added",
                description=f"Serviço '{labor.description}' adicionado — {labor.quantity}× R${labor.unit_price}",
                metadata={
                    "description": labor.description,
                    "quantity": str(labor.quantity),
                    "unit_price": str(labor.unit_price),
                    "discount": str(labor.discount),
                    "total": str(labor.total),
                },
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
```

- [ ] **Step 8: Corrigir action `labor_detail` — adicionar log no PATCH**

Na action `labor_detail`, substituir o bloco PATCH (após o bloco DELETE existente):

```python
        # ANTES:
        serializer = ServiceOrderLaborSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

        # DEPOIS:
        old_data = {f: str(getattr(item, f, "")) for f in LABOR_FIELD_MAP}
        serializer = ServiceOrderLaborSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        new_data = {f: str(getattr(updated, f, "")) for f in LABOR_FIELD_MAP}
        changes = _build_field_changes(old_data, new_data, LABOR_FIELD_MAP)
        if changes:
            ServiceOrderActivityLog.objects.create(
                service_order=service_order,
                user=request.user,
                activity_type="labor_updated",
                description=f"Serviço '{updated.description}' editado",
                metadata={"field_changes": changes},
            )
        return Response(serializer.data)
```

- [ ] **Step 9: Rodar testes**

```bash
pytest apps/service_orders/tests/test_history_logging.py -v
```

Expected: 6/6 PASSED

- [ ] **Step 10: Atualizar HistoryTab.tsx — configs para novos tipos**

Em `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/HistoryTab.tsx`:

Localizar o objeto `ACTIVITY_CONFIG` e adicionar após `labor_removed`:

```typescript
  part_updated: {
    icon: <Package className="h-4 w-4 text-blue-500" />,
    ringClass: "ring-blue-100",
    bgClass: "bg-blue-50",
    label: "Peça",
  },
  labor_updated: {
    icon: <Wrench className="h-4 w-4 text-orange-500" />,
    ringClass: "ring-orange-100",
    bgClass: "bg-orange-50",
    label: "Serviço",
  },
```

Localizar `FIELD_DIFF_TYPES` e adicionar os novos tipos:

```typescript
const FIELD_DIFF_TYPES = new Set<ActivityType>([
  "updated",
  "customer_updated",
  "vehicle_updated",
  "schedule_updated",
  "insurer_updated",
  "part_updated",    // ← NOVO
  "labor_updated",   // ← NOVO
])
```

Importar `Package` de lucide-react se ainda não importado.

Adicionar `"part_updated"` e `"labor_updated"` ao tipo `ActivityType` em `packages/types/src/index.ts` (ou onde o tipo é definido).

- [ ] **Step 11: Commit**

```bash
git add backend/core/apps/service_orders/models.py \
        backend/core/apps/service_orders/views.py \
        backend/core/apps/service_orders/tests/test_history_logging.py \
        apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/tabs/HistoryTab.tsx
git commit -m "feat(os): histórico completo — part_added/updated + labor_added/updated no ActivityLog"
```

---

### Task 3: Frontend — Types e Hooks

**Files:**
- Create: `packages/types/src/service-catalog.types.ts`
- Modify: `packages/types/src/index.ts`
- Create: `apps/dscar-web/src/hooks/useServiceCatalog.ts`

- [ ] **Step 1: Criar tipos TypeScript**

`packages/types/src/service-catalog.types.ts`:

```typescript
export type ServiceCatalogCategory =
  | "funilaria"
  | "pintura"
  | "mecanica"
  | "eletrica"
  | "estetica"
  | "alinhamento"
  | "revisao"
  | "lavagem"
  | "outros"

export const SERVICE_CATALOG_CATEGORY_LABELS: Record<ServiceCatalogCategory, string> = {
  funilaria:   "Funilaria / Chapeação",
  pintura:     "Pintura",
  mecanica:    "Mecânica",
  eletrica:    "Elétrica",
  estetica:    "Estética",
  alinhamento: "Alinhamento / Balanceamento",
  revisao:     "Revisão",
  lavagem:     "Lavagem / Higienização",
  outros:      "Outros",
}

export interface ServiceCatalogItem {
  id: string
  name: string
  category: ServiceCatalogCategory
  category_display: string
  suggested_price: string
}

export interface ServiceCatalogDetail extends ServiceCatalogItem {
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ServiceCatalogCreatePayload {
  name: string
  description?: string
  category: ServiceCatalogCategory
  suggested_price: string
}

export type ServiceCatalogUpdatePayload = Partial<ServiceCatalogCreatePayload> & {
  is_active?: boolean
}

export interface ServiceLaborItem {
  id: string
  service_catalog: string | null
  service_catalog_name: string | null
  description: string
  quantity: string
  unit_price: string
  discount: string
  total: number
  created_at: string
}

export interface ServiceLaborCreatePayload {
  service_catalog?: string | null
  description: string
  quantity: string
  unit_price: string
  discount?: string
}
```

- [ ] **Step 2: Exportar de packages/types/src/index.ts**

Adicionar ao final do arquivo:
```typescript
export * from "./service-catalog.types"
```

- [ ] **Step 3: Criar hooks useServiceCatalog.ts**

`apps/dscar-web/src/hooks/useServiceCatalog.ts`:

```typescript
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import type {
  ServiceCatalogItem,
  ServiceCatalogDetail,
  ServiceCatalogCreatePayload,
  ServiceCatalogUpdatePayload,
  ServiceLaborItem,
  ServiceLaborCreatePayload,
} from "@paddock/types"

const API = "/api/service-orders"
const CATALOG_API = "/api/service-catalog"

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const catalogKeys = {
  all: ["service-catalog"] as const,
  list: (params?: Record<string, string>) =>
    [...catalogKeys.all, "list", params ?? {}] as const,
  detail: (id: string) => [...catalogKeys.all, "detail", id] as const,
  labor: (osId: string) => ["service-orders", osId, "labor"] as const,
}

// ─── Catalog CRUD ─────────────────────────────────────────────────────────────

interface PaginatedResult<T> {
  count: number
  results: T[]
}

export function useServiceCatalog(params?: Record<string, string>) {
  return useQuery({
    queryKey: catalogKeys.list(params),
    queryFn: () => {
      const qs = params ? "?" + new URLSearchParams(params).toString() : ""
      return apiFetch<PaginatedResult<ServiceCatalogItem>>(`${CATALOG_API}/${qs}`)
    },
  })
}

export function useServiceCatalogCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ServiceCatalogCreatePayload) =>
      apiFetch<ServiceCatalogDetail>(`${CATALOG_API}/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogKeys.all }),
  })
}

export function useServiceCatalogUpdate(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ServiceCatalogUpdatePayload) =>
      apiFetch<ServiceCatalogDetail>(`${CATALOG_API}/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogKeys.all }),
  })
}

export function useServiceCatalogDelete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`${CATALOG_API}/${id}/`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogKeys.all }),
  })
}

// ─── OS Labor Items ───────────────────────────────────────────────────────────

export function useOSLaborItems(osId: string) {
  return useQuery({
    queryKey: catalogKeys.labor(osId),
    queryFn: () => apiFetch<ServiceLaborItem[]>(`${API}/${osId}/labor/`),
    enabled: Boolean(osId),
  })
}

export function useOSLaborCreate(osId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ServiceLaborCreatePayload) =>
      apiFetch<ServiceLaborItem>(`${API}/${osId}/labor/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catalogKeys.labor(osId) })
      qc.invalidateQueries({ queryKey: ["service-orders", osId] })
    },
  })
}

export function useOSLaborUpdate(osId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ laborId, payload }: { laborId: string; payload: Partial<ServiceLaborCreatePayload> }) =>
      apiFetch<ServiceLaborItem>(`${API}/${osId}/labor/${laborId}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catalogKeys.labor(osId) })
      qc.invalidateQueries({ queryKey: ["service-orders", osId] })
    },
  })
}

export function useOSLaborDelete(osId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (laborId: string) =>
      apiFetch<void>(`${API}/${osId}/labor/${laborId}/`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catalogKeys.labor(osId) })
      qc.invalidateQueries({ queryKey: ["service-orders", osId] })
    },
  })
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/service-catalog.types.ts \
        packages/types/src/index.ts \
        apps/dscar-web/src/hooks/useServiceCatalog.ts
git commit -m "feat(types): ServiceCatalog types + useServiceCatalog hooks"
```

---

### Task 4: Frontend — Página /cadastros/servicos

**Files:**
- Create: `apps/dscar-web/src/app/(app)/cadastros/servicos/page.tsx`
- Create: `apps/dscar-web/src/app/(app)/cadastros/servicos/_components/ServiceCatalogTable.tsx`
- Create: `apps/dscar-web/src/app/(app)/cadastros/servicos/_components/ServiceCatalogDialog.tsx`

- [ ] **Step 1: Criar ServiceCatalogDialog**

`apps/dscar-web/src/app/(app)/cadastros/servicos/_components/ServiceCatalogDialog.tsx`:

```typescript
"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  useServiceCatalogCreate,
  useServiceCatalogUpdate,
} from "@/hooks/useServiceCatalog"
import type { ServiceCatalogDetail } from "@paddock/types"
import { SERVICE_CATALOG_CATEGORY_LABELS } from "@paddock/types"

const schema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  description: z.string().optional(),
  category: z.enum([
    "funilaria", "pintura", "mecanica", "eletrica",
    "estetica", "alinhamento", "revisao", "lavagem", "outros",
  ]),
  suggested_price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Preço inválido"),
})

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: ServiceCatalogDetail | null
}

const LABEL = "block text-[9px] font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
const INPUT = "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
const SELECT = INPUT

export function ServiceCatalogDialog({ open, onOpenChange, editing }: Props) {
  const create = useServiceCatalogCreate()
  const update = useServiceCatalogUpdate(editing?.id ?? "")

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (editing) {
      reset({
        name: editing.name,
        description: editing.description,
        category: editing.category,
        suggested_price: editing.suggested_price,
      })
    } else {
      reset({ name: "", description: "", category: "outros", suggested_price: "0.00" })
    }
  }, [editing, reset])

  async function onSubmit(data: FormData) {
    try {
      if (editing) {
        await update.mutateAsync(data)
        toast.success("Serviço atualizado.")
      } else {
        await create.mutateAsync(data)
        toast.success("Serviço criado.")
      }
      onOpenChange(false)
    } catch {
      toast.error("Erro ao salvar serviço.")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{editing ? "Editar Serviço" : "Novo Serviço"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className={LABEL}>Nome *</label>
            <Input className="h-8" placeholder="Ex: Pintura Completa" {...register("name")} />
            {errors.name && <p className="mt-0.5 text-[10px] text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label className={LABEL}>Categoria *</label>
            <select className={SELECT} {...register("category")}>
              {Object.entries(SERVICE_CATALOG_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL}>Preço Sugerido (R$) *</label>
            <Input className="h-8" placeholder="0.00" {...register("suggested_price")} />
            {errors.suggested_price && (
              <p className="mt-0.5 text-[10px] text-red-600">{errors.suggested_price.message}</p>
            )}
          </div>

          <div>
            <label className={LABEL}>Descrição / Observação</label>
            <textarea
              className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              placeholder="Detalhes opcionais para orçamento..."
              {...register("description")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#ea0e03] hover:bg-red-700 text-white">
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {editing ? "Salvar" : "Criar Serviço"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Criar ServiceCatalogTable**

`apps/dscar-web/src/app/(app)/cadastros/servicos/_components/ServiceCatalogTable.tsx`:

```typescript
"use client"

import { useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useServiceCatalogDelete } from "@/hooks/useServiceCatalog"
import type { ServiceCatalogDetail } from "@paddock/types"

interface Props {
  items: ServiceCatalogDetail[]
  onEdit: (item: ServiceCatalogDetail) => void
}

export function ServiceCatalogTable({ items, onEdit }: Props) {
  const deleteMutation = useServiceCatalogDelete()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remover "${name}" do catálogo?`)) return
    setDeletingId(id)
    try {
      await deleteMutation.mutateAsync(id)
      toast.success("Serviço removido do catálogo.")
    } catch {
      toast.error("Erro ao remover serviço.")
    } finally {
      setDeletingId(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-neutral-400">
        Nenhum serviço no catálogo. Clique em "Novo Serviço" para adicionar.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-[11px] font-semibold uppercase text-neutral-500">
          <tr>
            <th className="px-4 py-2.5 text-left">Nome</th>
            <th className="px-4 py-2.5 text-left">Categoria</th>
            <th className="px-4 py-2.5 text-right">Preço Sugerido</th>
            <th className="px-4 py-2.5 text-right w-20">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-neutral-50">
              <td className="px-4 py-2.5 font-medium text-neutral-800">{item.name}</td>
              <td className="px-4 py-2.5 text-neutral-500">{item.category_display}</td>
              <td className="px-4 py-2.5 text-right font-mono text-neutral-700">
                {Number(item.suggested_price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </td>
              <td className="px-4 py-2.5 text-right">
                <div className="flex justify-end gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(item as ServiceCatalogDetail)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-500 hover:text-red-700"
                    disabled={deletingId === item.id}
                    onClick={() => handleDelete(item.id, item.name)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Criar página /cadastros/servicos**

`apps/dscar-web/src/app/(app)/cadastros/servicos/page.tsx`:

```typescript
"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useServiceCatalog } from "@/hooks/useServiceCatalog"
import { ServiceCatalogTable } from "./_components/ServiceCatalogTable"
import { ServiceCatalogDialog } from "./_components/ServiceCatalogDialog"
import type { ServiceCatalogDetail } from "@paddock/types"
import { SERVICE_CATALOG_CATEGORY_LABELS } from "@paddock/types"

export default function ServicosPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceCatalogDetail | null>(null)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("")

  const filters: Record<string, string> = {}
  if (search) filters.search = search
  if (category) filters.category = category

  const { data, isLoading } = useServiceCatalog(filters)

  function handleNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function handleEdit(item: ServiceCatalogDetail) {
    setEditing(item)
    setDialogOpen(true)
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Catálogo de Serviços</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Serviços padronizados com preço sugerido para agilizar o lançamento nas OS.
          </p>
        </div>
        <Button onClick={handleNew} className="bg-[#ea0e03] hover:bg-red-700 text-white gap-1.5">
          <Plus className="h-4 w-4" />
          Novo Serviço
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
          <Input
            placeholder="Buscar serviço..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white h-9"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Todas as categorias</option>
          {Object.entries(SERVICE_CATALOG_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-neutral-400">Carregando...</div>
      ) : (
        <ServiceCatalogTable
          items={(data?.results ?? []) as ServiceCatalogDetail[]}
          onEdit={handleEdit}
        />
      )}

      <ServiceCatalogDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
      />
    </div>
  )
}
```

- [ ] **Step 4: Adicionar "Serviços" no submenu Cadastros do Sidebar**

Em `apps/dscar-web/src/components/Sidebar.tsx`, localizar o item `cadastros` e adicionar children:

```typescript
// Localizar:
{
  id: "cadastros",
  label: "Cadastros",
  // ...
  href: "/cadastros",
},

// Substituir por:
{
  id: "cadastros",
  label: "Cadastros",
  icon: /* ícone atual */,
  href: "/cadastros",
  children: [
    { id: "cad-pessoas",   label: "Pessoas",   href: "/cadastros",          icon: Users },
    { id: "cad-servicos",  label: "Serviços",  href: "/cadastros/servicos", icon: Wrench },
  ],
},
```

Importar `Wrench` e `Users` de `lucide-react` se ainda não importados.

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/cadastros/servicos/ \
        apps/dscar-web/src/components/Sidebar.tsx
git commit -m "feat(cadastros): página /cadastros/servicos — CRUD catálogo de serviços"
```

---

### Task 5: Frontend — ServicesTab na OS

**Files:**
- Create: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ServicesTab.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/page.tsx`

- [ ] **Step 1: Criar ServicesTab**

`apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ServicesTab.tsx`:

```typescript
"use client"

import { useState } from "react"
import { Plus, Trash2, Search } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  useOSLaborItems,
  useOSLaborCreate,
  useOSLaborDelete,
  useServiceCatalog,
} from "@/hooks/useServiceCatalog"
import type { ServiceOrderStatus } from "@paddock/types"

const BLOCKED_STATUSES: ServiceOrderStatus[] = ["ready", "delivered", "cancelled"]

const addSchema = z.object({
  description:  z.string().min(2, "Descrição obrigatória"),
  quantity:     z.string().regex(/^\d+(\.\d{1,2})?$/, "Inválido").default("1"),
  unit_price:   z.string().regex(/^\d+(\.\d{1,2})?$/, "Inválido"),
  discount:     z.string().regex(/^\d+(\.\d{1,2})?$/, "Inválido").default("0"),
  service_catalog: z.string().nullable().optional(),
})
type AddForm = z.infer<typeof addSchema>

const LABEL = "block text-[9px] font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
const INPUT = "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"

interface Props {
  osId: string
  osStatus: ServiceOrderStatus
}

export function ServicesTab({ osId, osStatus }: Props) {
  const isBlocked = BLOCKED_STATUSES.includes(osStatus)
  const [catalogSearch, setCatalogSearch] = useState("")
  const [showCatalog, setShowCatalog] = useState(false)

  const { data: laborData, isLoading } = useOSLaborItems(osId)
  const { data: catalogData } = useServiceCatalog(catalogSearch ? { search: catalogSearch } : undefined)
  const addMutation = useOSLaborCreate(osId)
  const deleteMutation = useOSLaborDelete(osId)

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } =
    useForm<AddForm>({ resolver: zodResolver(addSchema), defaultValues: { quantity: "1", discount: "0" } })

  function selectFromCatalog(item: { id: string; name: string; suggested_price: string }) {
    setValue("description", item.name)
    setValue("unit_price", item.suggested_price)
    setValue("service_catalog", item.id)
    setShowCatalog(false)
    setCatalogSearch("")
  }

  async function onAdd(data: AddForm) {
    try {
      await addMutation.mutateAsync({
        description: data.description,
        quantity: data.quantity,
        unit_price: data.unit_price,
        discount: data.discount || "0",
        service_catalog: data.service_catalog ?? null,
      })
      reset({ quantity: "1", discount: "0", description: "", unit_price: "", service_catalog: null })
      toast.success("Serviço adicionado.")
    } catch {
      toast.error("Erro ao adicionar serviço.")
    }
  }

  async function handleDelete(laborId: string, desc: string) {
    if (!confirm(`Remover "${desc}"?`)) return
    try {
      await deleteMutation.mutateAsync(laborId)
      toast.success("Serviço removido.")
    } catch {
      toast.error("Erro ao remover serviço.")
    }
  }

  const items = laborData ?? []
  const servicesTotal = items.reduce((sum, i) => sum + i.total, 0)

  return (
    <div className="space-y-4">
      {!isBlocked && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Adicionar Serviço
          </p>

          {/* Busca no catálogo */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
                <input
                  className={`${INPUT} pl-8`}
                  placeholder="Buscar no catálogo..."
                  value={catalogSearch}
                  onChange={(e) => { setCatalogSearch(e.target.value); setShowCatalog(true) }}
                  onFocus={() => setShowCatalog(true)}
                />
              </div>
            </div>
            {showCatalog && catalogData && catalogData.results.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-dropdown max-h-48 overflow-y-auto">
                {catalogData.results.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex justify-between items-center"
                    onMouseDown={() => selectFromCatalog(item)}
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="text-xs text-neutral-400">
                      {Number(item.suggested_price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit(onAdd)} className="space-y-2">
            <div>
              <label className={LABEL}>Descrição *</label>
              <input className={errors.description ? `${INPUT} border-red-400` : INPUT} placeholder="Descrição do serviço" {...register("description")} />
              {errors.description && <p className="mt-0.5 text-[10px] text-red-600">{errors.description.message}</p>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={LABEL}>Qtd.</label>
                <input className={INPUT} type="number" step="0.01" min="0.01" {...register("quantity")} />
              </div>
              <div>
                <label className={LABEL}>Valor Unit. (R$) *</label>
                <input className={errors.unit_price ? `${INPUT} border-red-400` : INPUT} placeholder="0.00" {...register("unit_price")} />
                {errors.unit_price && <p className="mt-0.5 text-[10px] text-red-600">{errors.unit_price.message}</p>}
              </div>
              <div>
                <label className={LABEL}>Desconto (R$)</label>
                <input className={INPUT} placeholder="0.00" {...register("discount")} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting} size="sm" className="bg-[#ea0e03] hover:bg-red-700 text-white gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela de serviços */}
      {isLoading ? (
        <p className="text-sm text-neutral-400">Carregando serviços...</p>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-400">Nenhum serviço adicionado.</p>
      ) : (
        <div className="rounded-md border border-neutral-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-[11px] font-semibold uppercase text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-right">Qtd.</th>
                <th className="px-3 py-2 text-right">Unit.</th>
                <th className="px-3 py-2 text-right">Desconto</th>
                <th className="px-3 py-2 text-right">Total</th>
                {!isBlocked && <th className="px-3 py-2 w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-neutral-800">{item.description}</span>
                    {item.service_catalog_name && item.service_catalog_name !== item.description && (
                      <span className="ml-1 text-[10px] text-neutral-400">({item.service_catalog_name})</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-neutral-600">{item.quantity}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-neutral-600">
                    {Number(item.unit_price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-neutral-400">
                    {Number(item.discount) > 0
                      ? `- ${Number(item.discount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-neutral-800">
                    {item.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  {!isBlocked && (
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => handleDelete(item.id, item.description)}
                        className="text-neutral-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-neutral-50 border-t border-neutral-200">
                <td colSpan={isBlocked ? 4 : 5} className="px-3 py-2 text-right text-xs font-semibold uppercase text-neutral-500">
                  Total Serviços
                </td>
                <td className="px-3 py-2 text-right font-mono font-bold text-neutral-800">
                  {servicesTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Adicionar ServicesTab na página de detalhe da OS**

Em `apps/dscar-web/src/app/(app)/service-orders/[id]/page.tsx`, localizar onde as abas são definidas e adicionar:

```typescript
// Localizar o array de tabs e adicionar:
{ key: "services", label: "Serviços" },

// Localizar a seção de conteúdo de tabs e adicionar:
{activeTab === "services" && (
  <ServicesTab osId={params.id} osStatus={order.status as ServiceOrderStatus} />
)}
```

Importar `ServicesTab` e `ServiceOrderStatus` no topo do arquivo.

- [ ] **Step 3: Verificar build TypeScript**

```bash
cd apps/dscar-web
npx tsc --noEmit
```

Expected: 0 erros

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/ServicesTab.tsx \
        apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/page.tsx
git commit -m "feat(os): ServicesTab — busca no catálogo + lançamento de serviços na OS"
```

---

## Checklist de Self-Review

- [ ] Spec cobertura: modelo, CRUD, FK opcional, ServicesTab, sidebar — todos contemplados
- [ ] Histórico completo: todas as 6 operações (add/edit/remove × part/labor) geram ActivityLog
- [ ] Sem placeholders no plano
- [ ] Tipos consistentes: `ServiceLaborItem.service_catalog` é `string | null` em tipos TS e `null=True` no Django
- [ ] `ActivityType` sem migration necessária — é CharField choices, não DDL
- [ ] `_build_field_changes` só loga quando `changes` não é lista vazia — sem ruído no histórico
- [ ] `FIELD_DIFF_TYPES` no frontend inclui `part_updated` e `labor_updated` para exibir o diff
- [ ] Soft delete no catálogo não afeta labor_items existentes (ON_DELETE=SET_NULL)
- [ ] `isBlocked` previne adição de serviços em OS encerradas — consistente com backend (status 422)
