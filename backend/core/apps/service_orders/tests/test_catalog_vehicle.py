"""OS grava família e versão do catálogo; o texto do veículo é snapshot do servidor."""

import hashlib
from typing import Any

from django.utils import timezone
from django_tenants.test.cases import TenantTestCase
from rest_framework.response import Response
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.parts_catalog.models import PartApplication
from apps.parts_catalog.tests.factories import PartReferenceFactory
from apps.service_orders.models import ServiceOrder, ServiceOrderPart
from apps.vehicle_catalog.models import VehicleYearVersion
from apps.vehicle_catalog.tests.factories import make_catalog

URL = "/api/v1/service-orders/"


def montana() -> VehicleYearVersion:
    return make_catalog(
        family="Montana", model="MONTANA RS 1.2 Turbo Flex 12V Aut.", codigo="004546-2"
    )


class CatalogVehicleOSTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        email = "catalogo@dscar.com"
        self.user = GlobalUser.objects.create_user(
            email=email, email_hash=hashlib.sha256(email.encode()).hexdigest(), password="x"
        )
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})

    def post_os(self, **data: Any) -> Response:
        payload = {"plate": "ABC1D23", "customer_name": "Cliente Catálogo", **data}
        return self.client.post(URL, payload, format="json")

    def patch_os(self, pk: str, **data: Any) -> Response:
        return self.client.patch(f"{URL}{pk}/", data, format="json")

    def test_com_versao_preenche_snapshot_e_sem_selo(self) -> None:
        v = make_catalog()
        r = self.post_os(catalog_version=v.id, make="LIXO", model="LIXO")
        assert r.status_code == 201, r.data
        o = ServiceOrder.objects.get(pk=r.data["id"])
        assert (o.make, o.model, o.year, o.fuel_type) == ("Chevrolet", "Onix Plus", 2025, "Flex")
        assert o.vehicle_version == "ONIX SED. Plus PREM. 1.0 12V TB Flex Aut"
        assert o.fipe_value == v.valor_referencia == o.vehicle_fipe_value_snapshot
        assert o.catalog_family.nome == "Onix Plus" and o.vehicle_needs_review is False
        assert r.data["catalog_path"]["version"]["label"] == "2025 Flex"

    def test_so_familia_fica_com_selo(self) -> None:
        r = self.post_os(catalog_family=make_catalog().modelo.familia_id)
        assert r.status_code == 201 and r.data["vehicle_needs_review"] is True
        assert r.data["catalog_version"] is None and r.data["model"] == "Onix Plus"
        assert r.data["catalog_path"]["family"]["label"] == "Onix Plus"

    def test_versao_de_outra_familia_400(self) -> None:
        a = make_catalog()
        b = montana()
        r = self.post_os(catalog_family=a.modelo.familia_id, catalog_version=b.id)
        assert r.status_code == 400 and "catalog_version" in r.data

    def test_versao_inativa_400(self) -> None:
        v = make_catalog()
        VehicleYearVersion.objects.filter(pk=v.pk).update(is_active=False)
        assert self.post_os(catalog_version=v.id).status_code == 400

    def test_campos_derivados_sao_so_leitura(self) -> None:
        r = self.post_os(
            catalog_family=make_catalog().modelo.familia_id,
            vehicle_needs_review=False,
            zero_km=True,
            vehicle_source="cilia",
            vehicle_source_text="ONIX",
            vehicle_source_year=2020,
        )
        o = ServiceOrder.objects.get(pk=r.data["id"])
        assert o.vehicle_needs_review is True and o.zero_km is False
        assert (o.vehicle_source, o.vehicle_source_text, o.vehicle_source_year) == ("", "", None)

    def test_patch_familia_nova_limpa_versao_antiga(self) -> None:
        r = self.post_os(catalog_version=make_catalog().id)
        nova = montana().modelo.familia
        p = self.patch_os(r.data["id"], catalog_family=nova.id)
        assert p.status_code == 200, p.data
        o = ServiceOrder.objects.get(pk=r.data["id"])
        assert o.catalog_family == nova and o.catalog_version is None
        assert (o.model, o.vehicle_version, o.year) == ("Montana", "", None)
        assert o.vehicle_needs_review is True

    def test_patch_so_versao_null_mantem_familia_e_religa_selo(self) -> None:
        v = make_catalog()
        r = self.post_os(catalog_version=v.id)
        p = self.patch_os(r.data["id"], catalog_version=None)
        assert p.status_code == 200, p.data
        o = ServiceOrder.objects.get(pk=r.data["id"])
        assert o.catalog_family == v.modelo.familia and o.catalog_version is None
        assert o.vehicle_needs_review is True

    def test_patch_so_versao_de_outra_familia_400(self) -> None:
        r = self.post_os(catalog_version=make_catalog().id)
        p = self.patch_os(r.data["id"], catalog_version=montana().id)
        assert p.status_code == 400 and "catalog_version" in p.data

    def test_patch_so_ano_fabricacao_fora_400(self) -> None:
        r = self.post_os(catalog_version=make_catalog().id)
        p = self.patch_os(r.data["id"], year_manufacture=2022)
        assert p.status_code == 400 and "year_manufacture" in p.data

    def test_patch_km_em_os_pendente_200(self) -> None:
        r = self.post_os(catalog_family=make_catalog().modelo.familia_id)
        p = self.patch_os(r.data["id"], mileage_in=12345)
        assert p.status_code == 200, p.data
        o = ServiceOrder.objects.get(pk=r.data["id"])
        assert o.mileage_in == 12345 and o.vehicle_needs_review is True
        assert o.model == "Onix Plus"

    def test_ano_fabricacao_fora_400(self) -> None:
        r = self.post_os(catalog_version=make_catalog().id, year_manufacture=2022)
        assert r.status_code == 400 and "year_manufacture" in r.data

    def test_ano_fabricacao_aceita_ano_modelo_e_anterior(self) -> None:
        v = make_catalog()
        assert self.post_os(catalog_version=v.id, year_manufacture=2025).status_code == 201
        assert self.post_os(catalog_version=v.id, year_manufacture=2024).status_code == 201

    def test_zero_km_usa_ano_corrente(self) -> None:
        v = make_catalog(codigo="004519-5", model="ONIX 0KM", ano=32000, zero_km=True)
        ano = timezone.localdate().year
        r = self.post_os(catalog_version=v.id, year_manufacture=ano - 1)
        assert r.status_code == 201, r.data
        assert r.data["year"] == ano and r.data["zero_km"] is True
        assert self.post_os(catalog_version=v.id, year_manufacture=ano - 2).status_code == 400

    def test_propaga_para_outra_os_da_mesma_placa(self) -> None:
        primeira = self.post_os(catalog_family=make_catalog().modelo.familia_id)
        segunda = self.post_os(make="Chevrolet", model="Onix")
        v = VehicleYearVersion.objects.get(modelo__codigo_fipe="004504-7")
        p = self.patch_os(primeira.data["id"], catalog_version=v.id, year_manufacture=2024)
        assert p.status_code == 200, p.data
        o = ServiceOrder.objects.get(pk=segunda.data["id"])
        assert o.catalog_family == v.modelo.familia and o.catalog_version == v
        assert (o.model, o.year, o.fuel_type, o.year_manufacture) == (
            "Onix Plus",
            2025,
            "Flex",
            2024,
        )
        assert o.fipe_value == v.valor_referencia and o.vehicle_needs_review is False

    def test_sem_catalogo_continua_aceitando_texto(self) -> None:
        # Transição — removido na Task 16.
        r = self.post_os(make="Honda", model="Civic")
        assert r.status_code == 201
        assert (r.data["make"], r.data["model"], r.data["catalog_path"]) == ("Honda", "Civic", None)

    def test_entrega_registra_aplicacao_da_peca_na_versao(self) -> None:
        v = make_catalog()
        ref = PartReferenceFactory(manufacturer_code="52058207")
        o = ServiceOrder.objects.get(pk=self.post_os(catalog_version=v.id).data["id"])
        ServiceOrderPart.objects.create(
            service_order=o, description="Para-choque", part_number="52058207", unit_price=10
        )
        o.status = "delivered"
        o.save()
        app = PartApplication.objects.get(part_ref=ref)
        assert app.make == v.modelo.marca and app.model == v.modelo

    def test_entrega_sem_catalogo_casa_marca_pelo_nome_exibido(self) -> None:
        v = make_catalog()
        make_catalog(tipo="moto", fipe_make="Chevrolet", family="Moto", codigo="811111-1")
        ref = PartReferenceFactory(manufacturer_code="52058208")
        o = ServiceOrder.objects.get(pk=self.post_os(make="Chevrolet", model="Onix").data["id"])
        ServiceOrderPart.objects.create(
            service_order=o, description="Farol", part_number="52058208", unit_price=10
        )
        o.status = "delivered"
        o.save()
        app = PartApplication.objects.get(part_ref=ref)
        assert app.make == v.modelo.marca and app.model is None
