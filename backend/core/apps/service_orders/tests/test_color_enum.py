"""Cor do veículo é enum fechado (CorVeiculo) na OS, no orçamento e no lookup de placa."""

import hashlib
import importlib

from django.apps import apps as django_apps
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.budgets.models import Budget
from apps.items.models import NumberSequence
from apps.persons.models import Person
from apps.service_orders.models import ServiceOrder
from apps.vehicle_catalog.models import PlateCache
from apps.vehicle_catalog.tests.factories import make_catalog
from apps.vehicle_catalog.views import _normalize_plate_response

URL = "/api/v1/service-orders/"


class ColorEnumTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        email = "cores@dscar.com"
        self.user = GlobalUser.objects.create_user(
            email=email, email_hash=hashlib.sha256(email.encode()).hexdigest(), password="x"
        )
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})

    def create_os(self) -> str:
        r = self.client.post(
            URL,
            {
                "plate": "COR1D23",
                "customer_name": "Cliente Cor",
                "catalog_family": make_catalog().modelo.familia_id,
            },
            format="json",
        )
        assert r.status_code == 201, r.data
        return str(r.data["id"])

    def test_patch_cor_fora_do_enum_400(self) -> None:
        pk = self.create_os()
        r = self.client.patch(f"{URL}{pk}/", {"color": "Preto"}, format="json")
        assert r.status_code == 400 and "color" in r.data
        assert ServiceOrder.objects.get(pk=pk).color == "NAO_INFORMADA"

    def test_patch_cor_enum_200(self) -> None:
        pk = self.create_os()
        r = self.client.patch(f"{URL}{pk}/", {"color": "PRETA"}, format="json")
        assert r.status_code == 200, r.data
        assert ServiceOrder.objects.get(pk=pk).color == "PRETA"

    def test_endpoint_cores(self) -> None:
        r = self.client.get("/api/v1/vehicle-catalog/colors/")
        assert r.status_code == 200
        assert len(r.data) == 17
        assert set(r.data[0]) == {"value", "label", "hex"}
        assert {"value": "PRETA", "label": "Preta", "hex": "#111111"} in r.data

    def test_migracao_mapeia(self) -> None:
        migration = importlib.import_module("apps.service_orders.migrations.0039_color_enum_data")
        prta = ServiceOrder.objects.create(
            number=9001, plate="MIG1D23", customer_name="A", color="Prta"
        )
        lixo = ServiceOrder.objects.create(
            number=9002, plate="MIG2D23", customer_name="B", color="Furta-cor"
        )
        migration.map_colors(django_apps, None)
        prta.refresh_from_db()
        lixo.refresh_from_db()
        assert (prta.color, lixo.color) == ("PRETA", "NAO_INFORMADA")

    def test_lookup_placa_devolve_codigo_da_cor(self) -> None:
        PlateCache.objects.create(plate="CCH1D23", make="Volkswagen", model="Gol", color="Branca")
        r = self.client.get("/api/v1/vehicle-catalog/plate/CCH1D23/")
        assert r.status_code == 200 and r.data["color"] == "BRANCA"
        assert _normalize_plate_response("CCH1D23", {"cor": "BRANCA"})["color"] == "BRANCA"
        assert _normalize_plate_response("CCH1D23", {"cor": "Furta-cor"})["color"] == ""

    def test_post_os_cor_livre_vira_codigo(self) -> None:
        # App mobile manda a cor digitada à mão (online e no replay offline com null).
        for color, expected in (("Prata", "PRATA"), ("Furta-cor", "NAO_INFORMADA"), (None, "")):
            r = self.client.post(
                URL,
                {
                    "plate": "MOB1D23",
                    "customer_name": "Cliente Mobile",
                    "color": color,
                    "catalog_family": make_catalog().modelo.familia_id,
                },
                format="json",
            )
            assert r.status_code == 201, r.data
            assert ServiceOrder.objects.get(pk=r.data["id"]).color == expected

    def test_post_orcamento_cor_livre_vira_codigo(self) -> None:
        NumberSequence.objects.get_or_create(
            sequence_type="BUDGET",
            defaults={"prefix": "ORC-2026-", "padding": 6, "next_number": 1},
        )
        customer = Person.objects.create(full_name="Cliente Orçamento", person_kind="PF")
        r = self.client.post(
            "/api/v1/budgets/",
            {"customer_id": customer.pk, "vehicle_plate": "ORC1D23", "vehicle_color": "Preto"},
            format="json",
        )
        assert r.status_code == 201, r.data
        assert Budget.objects.get(pk=r.data["id"]).vehicle_color == "PRETA"
