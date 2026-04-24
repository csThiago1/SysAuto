# Port `vehicles` App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the `vehicles` app — physical vehicle instances per tenant with plate lookup: internal DB first, `apiplacas.com.br` API as fallback.

**Architecture:** TENANT_APP. `Vehicle` model has nullable FK to `vehicle_catalog.VehicleYearVersion` (shared FIPE catalog). Lookup service normalizes plate, checks DB, calls external API only on miss, persists result to avoid repeated API calls.

**Tech Stack:** Django 5, DRF, `httpx` (already in requirements), `django_tenants.test.cases.TenantTestCase`, `unittest.mock.patch` for HTTP mocking.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `backend/core/apps/vehicles/__init__.py` | Package marker |
| Create | `backend/core/apps/vehicles/apps.py` | AppConfig |
| Create | `backend/core/apps/vehicles/models.py` | Vehicle model |
| Create | `backend/core/apps/vehicles/services.py` | `VehicleService.lookup_plate()` |
| Create | `backend/core/apps/vehicles/serializers.py` | VehicleSerializer |
| Create | `backend/core/apps/vehicles/views.py` | VehicleViewSet + LookupView |
| Create | `backend/core/apps/vehicles/urls.py` | Router |
| Create | `backend/core/apps/vehicles/admin.py` | Admin |
| Create | `backend/core/apps/vehicles/migrations/__init__.py` | Package marker |
| Create | `backend/core/apps/vehicles/migrations/0001_initial.py` | Vehicle table |
| Create | `backend/core/apps/vehicles/tests/__init__.py` | Package marker |
| Create | `backend/core/apps/vehicles/tests/test_services.py` | Lookup tests with mocks |
| Create | `backend/core/apps/vehicles/tests/test_api.py` | API tests |
| Modify | `backend/core/config/settings/base.py` | Add `"apps.vehicles"` + settings |
| Modify | `backend/core/config/urls.py` | Add `/api/v1/vehicles/` |

---

### Task 1: App Scaffold + Model + Migration

**Files:**
- Create: `backend/core/apps/vehicles/__init__.py`
- Create: `backend/core/apps/vehicles/apps.py`
- Create: `backend/core/apps/vehicles/models.py`
- Create: `backend/core/apps/vehicles/admin.py`
- Create: `backend/core/apps/vehicles/migrations/__init__.py`
- Create: `backend/core/apps/vehicles/migrations/0001_initial.py`

- [ ] **Step 1: Write model**

`backend/core/apps/vehicles/apps.py`:
```python
from django.apps import AppConfig


class VehiclesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.vehicles"
    verbose_name = "Veículos Físicos"
```

`backend/core/apps/vehicles/models.py`:
```python
"""Veículos físicos vinculados a OS e placa.

FK version aponta para vehicle_catalog.VehicleYearVersion (catálogo FIPE compartilhado).
Nullable porque a API externa pode não encontrar a versão FIPE exata para a placa.
"""
import logging

from django.db import models

logger = logging.getLogger(__name__)


class Vehicle(models.Model):
    """Instância física de veículo identificada por placa."""

    # Placa normalizada: ABC1D23 (sem hífen, maiúsculo)
    plate = models.CharField(max_length=10, db_index=True)

    # FK para catálogo FIPE compartilhado (nullable — pode não existir)
    version = models.ForeignKey(
        "vehicle_catalog.VehicleYearVersion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tenant_vehicles",
    )

    # Fallback quando versão FIPE não encontrada
    description = models.CharField(max_length=200, blank=True, default="")
    color = models.CharField(max_length=50, blank=True, default="")
    year_manufacture = models.IntegerField(null=True, blank=True)
    chassis = models.CharField(max_length=50, blank=True, default="")
    renavam = models.CharField(max_length=20, blank=True, default="")

    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        label = self.version.full_name if self.version else self.description
        return f"{self.plate} — {label}"

    @property
    def display_name(self) -> str:
        """Nome para exibição: catálogo FIPE ou descrição livre."""
        return self.version.full_name if self.version else self.description
```

`backend/core/apps/vehicles/admin.py`:
```python
from django.contrib import admin
from .models import Vehicle

admin.site.register(Vehicle)
```

- [ ] **Step 2: Write migration**

`backend/core/apps/vehicles/migrations/0001_initial.py`:
```python
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("vehicle_catalog", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Vehicle",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True)),
                ("plate", models.CharField(db_index=True, max_length=10)),
                (
                    "version",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="tenant_vehicles",
                        to="vehicle_catalog.vehicleyearversion",
                    ),
                ),
                ("description", models.CharField(blank=True, default="", max_length=200)),
                ("color", models.CharField(blank=True, default="", max_length=50)),
                ("year_manufacture", models.IntegerField(blank=True, null=True)),
                ("chassis", models.CharField(blank=True, default="", max_length=50)),
                ("renavam", models.CharField(blank=True, default="", max_length=20)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
```

- [ ] **Step 3: Add to TENANT_APPS and run migration**

In `backend/core/config/settings/base.py`, add to `TENANT_APPS`:
```python
"apps.vehicles",
```

Also add these settings at the bottom of `base.py` (after existing env vars):
```python
APIPLACAS_TOKEN = env("APIPLACAS_TOKEN", default="")
APIPLACAS_URL = "https://apiplacas.com.br/api/v1/placa"
APIPLACAS_TIMEOUT = 8.0
```

```bash
cd backend/core && .venv/bin/python manage.py migrate_schemas --schema=tenant_dscar --settings=config.settings.dev
```

Expected: Migration applied without errors.

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/vehicles/
git commit -m "feat(vehicles): scaffold app + Vehicle model + migration 0001"
```

---

### Task 2: `VehicleService.lookup_plate()` + Tests

**Files:**
- Create: `backend/core/apps/vehicles/services.py`
- Create: `backend/core/apps/vehicles/tests/__init__.py`
- Create: `backend/core/apps/vehicles/tests/test_services.py`

- [ ] **Step 1: Write failing tests**

`backend/core/apps/vehicles/tests/test_services.py`:
```python
"""Testes para VehicleService.lookup_plate."""
from unittest.mock import MagicMock, patch

from django_tenants.test.cases import TenantTestCase

from apps.vehicles.models import Vehicle
from apps.vehicles.services import VehicleService


class LookupPlateTest(TenantTestCase):

    def test_plate_found_in_db_returns_immediately(self) -> None:
        """Placa existente na base → retorna sem chamar API."""
        v = Vehicle.objects.create(plate="ABC1D23", description="Fiat Uno", is_active=True)
        with patch("apps.vehicles.services.httpx.get") as mock_get:
            result = VehicleService.lookup_plate("ABC1D23")
        mock_get.assert_not_called()
        assert result is not None
        assert result["source"] == "db"
        assert result["plate"] == "ABC1D23"

    def test_plate_normalized_before_lookup(self) -> None:
        """Placa com hífen e minúscula → normalizada antes de buscar."""
        Vehicle.objects.create(plate="ABC1D23", description="Fiat Uno", is_active=True)
        with patch("apps.vehicles.services.httpx.get"):
            result = VehicleService.lookup_plate("abc-1d23")
        assert result is not None
        assert result["plate"] == "ABC1D23"

    def test_api_called_on_miss_persists_vehicle(self) -> None:
        """Placa não encontrada na base → chama API, persiste, retorna source='api'."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "placa": "XYZ9876",
            "marca": "TOYOTA",
            "modelo": "Corolla",
            "ano": "2022/2023",
            "cor": "Branco",
            "renavam": "12345678901",
            "chassi": "ABC123DEF456GHI78",
            "codigoFipe": "005004-4",
        }
        with patch("apps.vehicles.services.httpx.get", return_value=mock_response):
            result = VehicleService.lookup_plate("XYZ9876")
        assert result is not None
        assert result["source"] == "api"
        assert result["plate"] == "XYZ9876"
        assert Vehicle.objects.filter(plate="XYZ9876").exists()

    def test_api_failure_returns_none(self) -> None:
        """API externa falha → retorna None sem propagar exceção."""
        with patch("apps.vehicles.services.httpx.get", side_effect=Exception("timeout")):
            result = VehicleService.lookup_plate("ERR0001")
        assert result is None

    def test_existing_plate_not_duplicated(self) -> None:
        """Placa já na base não gera duplicata mesmo se API retornar dados."""
        Vehicle.objects.create(plate="DUP1234", description="Honda Civic", is_active=True)
        with patch("apps.vehicles.services.httpx.get") as mock_get:
            VehicleService.lookup_plate("DUP1234")
        mock_get.assert_not_called()
        assert Vehicle.objects.filter(plate="DUP1234").count() == 1
```

- [ ] **Step 2: Run tests to confirm fail**

```bash
cd backend/core && .venv/bin/pytest apps/vehicles/tests/test_services.py -v
```

Expected: `ImportError` (services.py doesn't exist).

- [ ] **Step 3: Write service**

`backend/core/apps/vehicles/services.py`:
```python
"""VehicleService: lookup de placa com DB-first e fallback para apiplacas.com.br."""
from __future__ import annotations

import logging
from typing import Any

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

_TIMEOUT = getattr(settings, "APIPLACAS_TIMEOUT", 8.0)


class VehicleService:
    """Lookup e criação de veículos físicos por placa."""

    @classmethod
    def lookup_plate(cls, plate: str) -> dict[str, Any] | None:
        """Busca veículo por placa. DB primeiro, API externa como fallback.

        Fluxo:
        1. Normaliza placa (maiúscula, sem hífen/espaços)
        2. Consulta Vehicle ativo na base → retorna imediatamente (source='db')
        3. Chama apiplacas.com.br com token Bearer
        4. Falha na API → log warning, retorna None (nunca propaga exceção)
        5. Busca VehicleYearVersion por codigo_fipe (nullable)
        6. Persiste Vehicle para consultas futuras
        7. Retorna dict com source='api'

        Returns:
            dict com plate, description, color, year, version_id, source
            None se não encontrado ou API indisponível
        """
        plate = plate.upper().strip().replace("-", "").replace(" ", "")

        # 1. DB-first
        from .models import Vehicle
        existing = Vehicle.objects.filter(plate=plate, is_active=True).first()
        if existing:
            return {
                "plate": existing.plate,
                "description": existing.display_name,
                "color": existing.color,
                "year": existing.year_manufacture,
                "version_id": existing.version_id,
                "source": "db",
            }

        # 2. API externa
        token = getattr(settings, "APIPLACAS_TOKEN", "")
        url = getattr(settings, "APIPLACAS_URL", "")
        if not token or not url:
            logger.warning("APIPLACAS_TOKEN/URL não configurados — lookup desabilitado.")
            return None

        try:
            response = httpx.get(
                url,
                params={"placa": plate},
                headers={"Authorization": f"Bearer {token}"},
                timeout=_TIMEOUT,
            )
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            logger.warning("Lookup de placa %s*** falhou: %s", plate[:3], exc)
            return None

        # 3. Resolve VehicleYearVersion por codigo_fipe
        fipe_code = data.get("codigoFipe") or data.get("fipe_code") or ""
        version = None
        if fipe_code:
            from apps.vehicle_catalog.models import VehicleYearVersion
            version = VehicleYearVersion.objects.filter(codigo_fipe=fipe_code).first()

        # 4. Extrai dados da resposta
        description = " ".join(filter(None, [
            data.get("marca", ""),
            data.get("modelo", ""),
        ])) or data.get("description", "")
        color = data.get("cor") or data.get("color", "")
        year_str = str(data.get("ano") or data.get("year", "")).split("/")[0]
        year = int(year_str) if year_str.isdigit() else None
        renavam = data.get("renavam", "")
        chassis = data.get("chassi") or data.get("chassis", "")

        # 5. Persiste Vehicle
        vehicle = Vehicle.objects.create(
            plate=plate,
            version=version,
            description=description,
            color=color,
            year_manufacture=year,
            renavam=renavam,
            chassis=chassis,
        )

        return {
            "plate": vehicle.plate,
            "description": vehicle.display_name,
            "color": vehicle.color,
            "year": vehicle.year_manufacture,
            "version_id": vehicle.version_id,
            "source": "api",
        }
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
cd backend/core && .venv/bin/pytest apps/vehicles/tests/test_services.py -v
```

Expected: 5/5 PASSED.

- [ ] **Step 5: Commit**

```bash
git add backend/core/apps/vehicles/services.py backend/core/apps/vehicles/tests/
git commit -m "feat(vehicles): VehicleService.lookup_plate + tests"
```

---

### Task 3: API Endpoints + Registration

**Files:**
- Create: `backend/core/apps/vehicles/serializers.py`
- Create: `backend/core/apps/vehicles/views.py`
- Create: `backend/core/apps/vehicles/urls.py`
- Create: `backend/core/apps/vehicles/tests/test_api.py`
- Modify: `backend/core/config/urls.py`

- [ ] **Step 1: Write failing API tests**

`backend/core/apps/vehicles/tests/test_api.py`:
```python
"""API tests para vehicles endpoints."""
from unittest.mock import patch

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.vehicles.models import Vehicle


class VehicleAPITestCase(TenantTestCase):

    def setUp(self) -> None:
        super().setUp()
        self.user = GlobalUser.objects.create_user(email="api@v.com", password="pw")
        self.client = APIClient()
        self.client.defaults["HTTP_X_TENANT_DOMAIN"] = self.domain.domain
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})

    def test_list_vehicles_returns_200(self) -> None:
        Vehicle.objects.create(plate="TST0001", description="Fiat Uno")
        resp = self.client.get("/api/v1/vehicles/")
        assert resp.status_code == 200
        assert len(resp.data["results"]) == 1

    def test_create_vehicle_as_manager(self) -> None:
        resp = self.client.post("/api/v1/vehicles/", {"plate": "NEW0001", "description": "Honda Civic"}, format="json")
        assert resp.status_code == 201
        assert resp.data["plate"] == "NEW0001"

    def test_lookup_plate_found_in_db(self) -> None:
        Vehicle.objects.create(plate="LOOK001", description="Ford Ka", is_active=True)
        resp = self.client.get("/api/v1/vehicles/lookup/?plate=LOOK001")
        assert resp.status_code == 200
        assert resp.data["plate"] == "LOOK001"
        assert resp.data["source"] == "db"

    def test_lookup_plate_not_found_api_disabled(self) -> None:
        """Sem token configurado → retorna 404."""
        with patch("apps.vehicles.services.settings") as mock_settings:
            mock_settings.APIPLACAS_TOKEN = ""
            mock_settings.APIPLACAS_URL = ""
            resp = self.client.get("/api/v1/vehicles/lookup/?plate=NOTFOUND")
        assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to confirm fail**

```bash
cd backend/core && .venv/bin/pytest apps/vehicles/tests/test_api.py -v
```

Expected: 404 or import errors.

- [ ] **Step 3: Write serializers**

`backend/core/apps/vehicles/serializers.py`:
```python
from rest_framework import serializers

from .models import Vehicle


class VehicleSerializer(serializers.ModelSerializer):
    display_name = serializers.ReadOnlyField()

    class Meta:
        model = Vehicle
        fields = [
            "id", "plate", "version", "description", "display_name",
            "color", "year_manufacture", "chassis", "renavam",
            "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]
```

- [ ] **Step 4: Write views**

`backend/core/apps/vehicles/views.py`:
```python
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove

from .models import Vehicle
from .serializers import VehicleSerializer
from .services import VehicleService


class VehicleViewSet(viewsets.ModelViewSet):
    """CRUD de veículos físicos + lookup de placa."""

    serializer_class = VehicleSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_queryset(self):  # type: ignore[override]
        return Vehicle.objects.filter(is_active=True).select_related("version")

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    @action(detail=False, methods=["get"], url_path="lookup")
    def lookup(self, request: Request) -> Response:
        """GET /vehicles/lookup/?plate=ABC1D23 — DB-first então API externa."""
        plate = request.query_params.get("plate", "").strip()
        if not plate:
            return Response({"detail": "Parâmetro 'plate' obrigatório."}, status=400)
        result = VehicleService.lookup_plate(plate)
        if result is None:
            return Response({"detail": "Veículo não encontrado."}, status=404)
        return Response(result)
```

- [ ] **Step 5: Write URLs**

`backend/core/apps/vehicles/urls.py`:
```python
from rest_framework.routers import DefaultRouter

from .views import VehicleViewSet

router = DefaultRouter()
router.register(r"", VehicleViewSet, basename="vehicle")

urlpatterns = router.urls
```

- [ ] **Step 6: Register URL in config/urls.py**

Add to `backend/core/config/urls.py`:
```python
path("api/v1/vehicles/", include("apps.vehicles.urls")),
```

- [ ] **Step 7: Run API tests**

```bash
cd backend/core && .venv/bin/pytest apps/vehicles/tests/ -v
```

Expected: All tests pass.

- [ ] **Step 8: Run full suite**

```bash
cd backend/core && .venv/bin/pytest --tb=short -q
```

Expected: No regressions.

- [ ] **Step 9: Commit**

```bash
git add backend/core/apps/vehicles/ backend/core/config/urls.py backend/core/config/settings/base.py
git commit -m "feat(vehicles): API endpoints + lookup action — app completo"
```
