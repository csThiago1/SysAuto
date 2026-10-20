"""Orçamento grava família e versão do catálogo e as leva para a OS."""

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.budgets.models import Budget, BudgetVersion
from apps.budgets.services import BudgetService
from apps.items.models import NumberSequence
from apps.persons.models import Person
from apps.service_orders.models import ServiceOrder
from apps.service_orders.services import ServiceOrderService
from apps.vehicle_catalog.tests.factories import make_catalog


class CatalogVehicleBudgetTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        NumberSequence.objects.get_or_create(
            sequence_type="BUDGET",
            defaults={"prefix": "ORC-2026-", "padding": 6, "next_number": 1},
        )
        self.customer = Person.objects.create(full_name="Cliente Catálogo", person_kind="PF")

    def create_budget(self, **kwargs: object) -> Budget:
        return BudgetService.create(
            customer=self.customer, vehicle_plate="abc1d23", created_by="test", **kwargs
        )

    def to_os(self, budget: Budget) -> ServiceOrder:
        version = BudgetVersion.objects.get(budget=budget)
        return ServiceOrderService.create_from_budget(version=version)

    def test_post_com_versao_preenche_snapshot(self) -> None:
        v = make_catalog()
        client = APIClient()
        client.defaults["HTTP_X_TENANT_DOMAIN"] = self.domain.domain
        user = GlobalUser.objects.create_user(email="orc@dscar.com", password="x")
        client.force_authenticate(user=user, token={"role": "CONSULTANT"})
        r = client.post(
            "/api/v1/budgets/",
            {
                "customer_id": self.customer.pk,
                "vehicle_plate": "ABC1D23",
                "catalog_version": v.id,
                "vehicle_year_manufacture": 2024,
            },
            format="json",
        )
        assert r.status_code == 201, r.data
        b = Budget.objects.get(pk=r.data["id"])
        assert (
            b.vehicle_description == "Chevrolet Onix Plus ONIX SED. Plus PREM. 1.0 12V TB Flex Aut"
        )
        assert b.vehicle_year == 2025 and b.vehicle_fuel_type == "Flex"
        assert b.vehicle_version == "ONIX SED. Plus PREM. 1.0 12V TB Flex Aut"
        assert b.catalog_family == v.modelo.familia and b.catalog_version == v
        assert b.vehicle_year_manufacture == 2024 and b.vehicle_needs_review is False
        assert r.data["catalog_path"]["version"]["label"] == "2025 Flex"

    def test_create_from_budget_copia_fks_e_selo(self) -> None:
        fam = make_catalog().modelo.familia
        os = self.to_os(self.create_budget(catalog_family=fam, vehicle_year_manufacture=2024))
        assert os.catalog_family == fam and os.catalog_version is None
        assert os.vehicle_needs_review is True and os.model == "Onix Plus"
        assert os.year_manufacture == 2024

        v = make_catalog()
        os = self.to_os(self.create_budget(catalog_version=v))
        assert os.catalog_family == fam and os.catalog_version == v
        assert os.vehicle_needs_review is False and os.year == 2025

    def test_clone_copia_fks(self) -> None:
        v = make_catalog()
        clone = BudgetService.clone(
            source_budget=self.create_budget(catalog_version=v), created_by="t"
        )
        assert clone.catalog_family == v.modelo.familia and clone.catalog_version == v
        assert clone.vehicle_needs_review is False

    def test_nome_fipe_de_120_caracteres_grava(self) -> None:
        nome = "X" * 120
        v = make_catalog(model=nome, codigo="999999-9")
        budget = self.create_budget(catalog_version=v)
        budget.refresh_from_db()
        assert budget.vehicle_version == nome
        assert budget.vehicle_description == f"Chevrolet Onix Plus {nome}"
        os = self.to_os(budget)
        os.refresh_from_db()
        assert os.vehicle_version == nome
