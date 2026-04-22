"""Testes para o catálogo de serviços."""
import hashlib
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.service_orders.models import ServiceCatalog


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class ServiceCatalogViewSetTestCase(TenantTestCase):
    """Testes para ServiceCatalogViewSet."""

    def setUp(self) -> None:
        super().setUp()
        self.user = GlobalUser.objects.create_user(
            email="test@dscar.com",
            email_hash=_sha256("test@dscar.com"),
            password="testpass",
        )
        self.client = APIClient()
        self.client.defaults["HTTP_X_TENANT_DOMAIN"] = self.domain.domain
        self.client.force_authenticate(user=self.user, token={"role": "MANAGER"})

    def test_list_returns_active_only(self) -> None:
        ServiceCatalog.objects.create(name="Pintura", category="pintura", suggested_price=Decimal("1200.00"))
        ServiceCatalog.objects.create(name="Inativo", category="outros", suggested_price=Decimal("0"), is_active=False)
        response = self.client.get("/api/v1/service-orders/service-catalog/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["name"] == "Pintura"

    def test_create_service(self) -> None:
        response = self.client.post("/api/v1/service-orders/service-catalog/", {
            "name": "Funilaria Completa",
            "category": "funilaria",
            "suggested_price": "800.00",
        }, format="json")
        assert response.status_code == 201
        assert response.data["name"] == "Funilaria Completa"
        assert response.data["suggested_price"] == "800.00"

    def test_soft_delete(self) -> None:
        svc = ServiceCatalog.objects.create(name="X", category="outros", suggested_price=Decimal("0"))
        response = self.client.delete(f"/api/v1/service-orders/service-catalog/{svc.id}/")
        assert response.status_code == 204
        svc.refresh_from_db()
        assert svc.is_active is False

    def test_search_filter(self) -> None:
        ServiceCatalog.objects.create(name="Polimento Técnico", category="estetica", suggested_price=Decimal("300"))
        ServiceCatalog.objects.create(name="Lavagem Simples", category="lavagem", suggested_price=Decimal("50"))
        response = self.client.get("/api/v1/service-orders/service-catalog/?search=polimento")
        assert response.status_code == 200
        assert len(response.data["results"]) == 1
