"""Tests for Cilia import persistence into Service Orders."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import date
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from django.core.files.uploadedfile import SimpleUploadedFile
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.budgets.models import Budget, BudgetVersion
from apps.cilia.dtos import ImportService, ParsedBudget, ParsedItemDTO
from apps.cilia.models import ImportAttempt
from apps.cilia.services import apply_parsed_budget_to_order
from apps.cilia.sources.cilia_parser import CiliaParser
from apps.cilia.sources.hdi_html_parser import HdiHtmlParser
from apps.insurers.models import Insurer
from apps.persons.models import Person, TipoDocumento
from apps.service_orders.models import ServiceOrder
from apps.service_orders.services import ServiceOrderService
from apps.service_orders.services.vehicle import apply_catalog_vehicle
from apps.vehicle_catalog.fipe_sync import load_fipex
from apps.vehicle_catalog.matching import alias_key
from apps.vehicle_catalog.models import VehicleAlias, VehicleYearVersion
from apps.vehicle_catalog.normalize import CorVeiculo
from apps.vehicle_catalog.tests.factories import SAMPLE

FIXTURES = Path(__file__).parent / "fixtures"
GOL_TEXT = "VOLKSWAGEN GOL 1.0MI TOTAL FLEX 8V 4P"
ONIX_TEXT = "CHEVROLET ONIX PLUS (2020 A 2025) PREMIER 1.0 12V TURBO FLEX 2025"


def cilia_payload(name: str) -> dict[str, Any]:
    return json.loads((FIXTURES / name).read_text())


def new_attempt(source: str = "cilia") -> ImportAttempt:
    return ImportAttempt.objects.create(source=source, trigger="user_requested")


def persist(parsed: ParsedBudget) -> ServiceOrder:
    order, _ = ImportService._persist_cilia_budget(
        parsed=parsed, attempt=new_attempt(parsed.source)
    )
    return order


def fipe_version(codigo: str, ano: int) -> VehicleYearVersion:
    return VehicleYearVersion.objects.get(modelo__codigo_fipe=codigo, ano=ano)


def parsed_budget(**kwargs: Any) -> ParsedBudget:
    defaults: dict[str, Any] = {
        "source": "cilia",
        "insurer_code": "porto",
        "casualty_number": "SIN-T11",
        "external_version": "T11.1",
        "segurado_name": "Segurado Teste",
        "vehicle_plate": "TST1A23",
        "raw_hash": "c" * 64,
        "items": [
            ParsedItemDTO(
                description="Parachoque",
                quantity=Decimal("1"),
                unit_price=Decimal("100"),
                net_price=Decimal("100"),
            )
        ],
    }
    return ParsedBudget(**{**defaults, **kwargs})


def api_client(domain: str, email: str, role: str = "ADMIN") -> APIClient:
    user = GlobalUser.objects.create_user(
        email=email, email_hash=hashlib.sha256(email.encode()).hexdigest(), password="x"
    )
    client = APIClient()
    client.defaults["SERVER_NAME"] = client.defaults["HTTP_HOST"] = domain
    client.force_authenticate(user=user, token={"role": role})
    return client


class CatalogTenantTestCase(TenantTestCase):
    """Catálogo FIPE da fixture carregado por teste (setUpTestData não roda em TenantTestCase)."""

    def setUp(self) -> None:
        super().setUp()
        load_fipex(SAMPLE, ref="2026-10")


class CiliaImportServiceTest(TenantTestCase):
    """Valida persistência do importador Cilia no fluxo MVP."""

    @classmethod
    def setup_tenant(cls, tenant):
        tenant.name = "Tenant DS Car Cilia"
        tenant.slug = "dscar_cilia"
        tenant.client_slug = "grupo-dscar_cilia"
        return tenant

    @classmethod
    def setup_domain(cls, domain):
        domain.domain = "cilia.paddock.solutions"
        domain.is_primary = True
        return domain

    def test_cilia_import_creates_service_order_waiting_auth(self) -> None:
        insurer = Insurer.objects.create(
            name=f"Tokio Marine MVP {uuid.uuid4()}",
            trade_name="Tokio Marine",
            code="TOKIO_MARINE_MVP",
            cnpj=f"{uuid.uuid4().int % 10**14:014d}",
            uses_cilia=True,
        )
        attempt = ImportAttempt.objects.create(
            source="cilia",
            trigger="user_requested",
            casualty_number="406571903",
            budget_number="1446508",
            version_number=1,
        )
        parsed = ParsedBudget(
            source="cilia",
            insurer_code=insurer.code or "",
            casualty_number="406571903",
            external_budget_number="1446508",
            external_version="1446508.1",
            external_version_id=30228697,
            external_status="analisado",
            segurado_name="Cliente Importado Cilia",
            segurado_cpf="04497844000140",
            vehicle_plate="TAF8E63",
            vehicle_brand="MERCEDES-BENZ",
            vehicle_description="SPRINTER 517 CDI",
            vehicle_chassis="8AC907655SE254082",
            vehicle_color="BRANCA",
            vehicle_km="12345.0",
            vehicle_year=2025,
            franchise_amount=Decimal("500.00"),
            raw_hash="b" * 64,
            raw_payload={"insurer": {"trade": "Tokio Marine"}},
            items=[
                ParsedItemDTO(
                    description="Parachoque traseiro",
                    external_code="A90788512009K83",
                    quantity=Decimal("1"),
                    unit_price=Decimal("1200.00"),
                    net_price=Decimal("1200.00"),
                )
            ],
        )

        order, version = ImportService._persist_cilia_budget(
            parsed=parsed,
            attempt=attempt,
        )

        self.assertEqual(order.status, "waiting_auth")
        self.assertEqual(order.customer_type, "insurer")
        self.assertEqual(order.insurer_id, insurer.id)
        self.assertEqual(order.casualty_number, "406571903")
        self.assertEqual(order.plate, "TAF8E63")
        self.assertIsNotNone(order.customer_id)
        self.assertTrue(order.customer.roles.filter(role="CLIENT").exists())
        self.assertEqual(version.source, "cilia")
        self.assertEqual(version.external_integration_id, "30228697")
        self.assertEqual(version.items.count(), 1)

        duplicate_attempt = ImportAttempt.objects.create(
            source="cilia",
            trigger="user_requested",
            casualty_number="406571903",
            budget_number="1446508",
            version_number=1,
        )
        duplicate_order, duplicate_version = ImportService._persist_cilia_budget(
            parsed=parsed,
            attempt=duplicate_attempt,
        )

        self.assertEqual(duplicate_order.pk, order.pk)
        self.assertEqual(duplicate_version.pk, version.pk)


class PersistTest(CatalogTenantTestCase):
    def test_kicks_yelum_cria_os_com_versao(self) -> None:
        order = persist(CiliaParser.parse(cilia_payload("cilia_yelum_insurer_supplied.json")))
        assert order.status == "waiting_auth"
        assert order.catalog_version.modelo.codigo_fipe == "023158-4"
        assert order.vehicle_needs_review is False
        assert order.insurer.code == "yelum" and order.insurer_cnpj == "61550141009129"
        assert (order.make, order.model, order.color) == ("Nissan", "Kicks", "PRATA")

    def test_sprinter_fica_so_familia_com_texto_original(self) -> None:
        order = persist(CiliaParser.parse(cilia_payload("cilia_1446508_v1.json")))
        assert order.catalog_family.nome == "Sprinter" and order.catalog_version is None
        assert order.vehicle_needs_review is True and order.vehicle_source == "cilia"
        assert order.vehicle_source_text.startswith("MERCEDES-BENZ SPRINTER VANS")
        # o texto inteiro (com o intervalo de anos) fica em vehicle_source_text, não em model
        assert order.vehicle_source_text == (
            "MERCEDES-BENZ SPRINTER VANS (2023 A 2026) 517 CDI - EXTRA LONGO TETO ALTO 18L "
            "OM-654 CDI 2025"
        )
        assert order.vehicle_source_year == 2025 and order.model == "Sprinter"

    def test_seguradora_desconhecida_para_com_texto(self) -> None:
        payload = cilia_payload("cilia_bradesco_discount_10pct.json")
        payload["insurer"] = {"trade": "Seguradora X", "document_identifier": "11222333000181"}
        response = SimpleNamespace(status_code=200, data=payload, duration_ms=1, raw_text="")
        client = SimpleNamespace(get_budget=lambda **_: response)

        attempt = ImportService.fetch_cilia_budget(
            casualty_number="SIN-X", budget_number="1", client=client
        )

        assert attempt.parsed_ok is False and attempt.error_type == "UnknownInsurer"
        assert attempt.error_message == "Seguradora não reconhecida: 'Seguradora X'"
        assert not ServiceOrder.objects.exists()

    def test_xml_com_codigo_desconhecido_para_com_o_codigo(self) -> None:
        attempt = ImportService.import_xml_ifx(
            xml_bytes=(FIXTURES / "xml_ifx_chevrolet_montana.xml").read_bytes(),
            insurer_code="inexistente",
        )
        assert attempt.error_type == "UnknownInsurer"
        assert "inexistente" in attempt.error_message
        assert not ServiceOrder.objects.exists()

    def test_filial_nova_valida_entra_nos_cnpjs_da_seguradora(self) -> None:
        payload = cilia_payload("cilia_yelum_insurer_supplied.json")
        payload["insurer"]["document_identifier"] = "61550141000172"  # raiz da Yelum, DV válido
        order = persist(CiliaParser.parse(payload))
        assert order.insurer_cnpj == "61550141000172"
        assert "61550141000172" in Insurer.objects.get(code="yelum").cnpjs

        client = api_client(self.domain.domain, "filial@dscar.com")
        r = client.patch(f"/api/v1/service-orders/{order.pk}/", {"notes": "ok"}, format="json")
        assert r.status_code == 200, r.data

    def test_cnpj_invalido_nao_vai_para_a_nota(self) -> None:
        payload = cilia_payload("cilia_yelum_insurer_supplied.json")
        payload["insurer"]["document_identifier"] = "61550141000107"  # raiz casa, DV inválido
        order = persist(CiliaParser.parse(payload))
        assert order.insurer.code == "yelum" and order.insurer_cnpj == ""
        assert "61550141000107" not in Insurer.objects.get(code="yelum").cnpjs

    def test_cor_sem_casamento_fica_nao_informada_com_aviso(self) -> None:
        order = persist(parsed_budget(vehicle_color="AZUL ESCURO XYZ"))
        assert order.color == CorVeiculo.NAO_INFORMADA
        assert order.import_warnings == ["Cor do arquivo não reconhecida: 'AZUL ESCURO XYZ'"]

    def test_segurado_com_cpf_valido_e_municipio(self) -> None:
        order = persist(
            parsed_budget(
                segurado_cpf="529.982.247-25",
                segurado_phone="92992255093",
                segurado_city="Manaus",
                segurado_uf="AM",
                segurado_cep="69073-000",
            )
        )
        person = Person.objects.get(pk=order.customer_id)
        doc = person.documents.get()
        assert (doc.doc_type, doc.value, doc.is_primary) == (TipoDocumento.CPF, "52998224725", True)
        assert person.contacts.get().value == "92992255093"
        address = person.addresses.get()
        assert (address.municipio_ibge, address.city, address.state) == ("1302603", "Manaus", "AM")
        assert address.zip_code == "69073-000" and address.is_primary

    def test_segurado_com_cpf_invalido_nao_grava_documento(self) -> None:
        order = persist(
            parsed_budget(segurado_cpf="11111111111", segurado_city="Xyz", segurado_uf="XX")
        )
        person = Person.objects.get(pk=order.customer_id)
        assert not person.documents.exists() and not person.addresses.exists()
        assert not person.contacts.exists()


class ApplyToExistingOrderTest(CatalogTenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.kicks = fipe_version("023158-4", 2019)
        self.bradesco = Insurer.objects.get(code="bradesco")

    def order(self, *, version: VehicleYearVersion | None = None, **kwargs: Any) -> ServiceOrder:
        order = ServiceOrder(
            number=ServiceOrderService.get_next_number(), customer_name="Cliente", plate="NAV8H06"
        )
        for key, value in kwargs.items():
            setattr(order, key, value)
        if version is not None:
            apply_catalog_vehicle(order, family=None, version=version)
        order.save()
        return order

    def apply(self, order: ServiceOrder, parsed: ParsedBudget) -> ServiceOrder:
        fields = apply_parsed_budget_to_order(order, parsed)
        order.save(update_fields=fields)
        order.refresh_from_db()
        return order

    def test_veiculo_diferente_gera_aviso(self) -> None:
        order = self.order(version=self.kicks, insurer=self.bradesco)
        onix = CiliaParser.parse(cilia_payload("cilia_bradesco_discount_10pct.json"))
        order = self.apply(order, onix)
        assert order.import_warnings == [f"Veículo diverge: o cilia diz '{ONIX_TEXT}'"]
        assert (
            order.catalog_version == self.kicks
            and order.catalog_family == self.kicks.modelo.familia
        )
        assert order.vehicle_needs_review is False and order.model == "Kicks"

        order = self.apply(
            order, CiliaParser.parse(cilia_payload("cilia_bradesco_discount_10pct.json"))
        )
        assert len(order.import_warnings) == 1  # reimportar não repete o aviso

    def test_texto_sem_casamento_conta_confirmacao(self) -> None:
        order = self.order(version=self.kicks)
        self.apply(order, ParsedBudget(source="cilia", vehicle_model="XPTO 123", vehicle_year=2019))
        alias = VehicleAlias.objects.get(source="cilia", raw_key=alias_key("XPTO 123", 2019))
        assert (alias.confirmacoes, alias.version, alias.family) == (1, self.kicks, None)
        assert order.import_warnings == []

    def test_os_sem_veiculo_recebe_o_casado(self) -> None:
        order = self.order()
        order = self.apply(
            order, CiliaParser.parse(cilia_payload("cilia_bradesco_discount_10pct.json"))
        )
        assert order.catalog_version.modelo.codigo_fipe == "004504-7"
        assert order.vehicle_needs_review is False and order.vehicle_source == "cilia"
        assert order.vehicle_source_text == ONIX_TEXT and order.vehicle_source_year == 2025
        assert order.color == "PRETA"
        assert order.insurer == self.bradesco and order.customer_type == "insurer"
        assert order.insurer_cnpj == "33055146000193"

    def test_cor_sem_casamento_em_os_sem_cor_gera_aviso(self) -> None:
        order = self.order(version=self.kicks)
        order = self.apply(order, ParsedBudget(source="cilia", vehicle_color="AZUL ESCURO XYZ"))
        assert order.color == CorVeiculo.NAO_INFORMADA
        assert order.import_warnings == ["Cor do arquivo não reconhecida: 'AZUL ESCURO XYZ'"]

    def test_cor_ja_informada_nao_muda(self) -> None:
        order = self.order(version=self.kicks, color="BRANCA", insurer=self.bradesco)
        order = self.apply(order, ParsedBudget(source="cilia", vehicle_color="-PRETA"))
        assert order.color == "BRANCA" and order.import_warnings == []

    def test_seguradora_diferente_gera_aviso_e_mantem_a_da_os(self) -> None:
        porto = Insurer.objects.get(code="porto")
        order = self.order(version=self.kicks, insurer=porto, customer_type="insurer")
        order = self.apply(
            order,
            ParsedBudget(
                source="cilia", insurer_trade="Bradesco Seguros", insurer_cnpj="33055146000193"
            ),
        )
        assert order.insurer == porto and order.insurer_cnpj == ""
        assert order.import_warnings == ["Seguradora diverge: o arquivo diz 'Bradesco Seguros'"]

    def test_seguradora_nao_reconhecida_gera_aviso(self) -> None:
        order = self.order(version=self.kicks)
        order = self.apply(order, ParsedBudget(source="cilia", insurer_trade="Seguradora X"))
        assert order.insurer is None and order.customer_type is None
        assert order.import_warnings == ["Seguradora do arquivo não reconhecida: 'Seguradora X'"]


class ConfirmacaoPelaTelaTest(CatalogTenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.gol = fipe_version("005275-2", 2013)
        self.client = api_client(self.domain.domain, "confirma@dscar.com")

    def hdi_order(self) -> ServiceOrder:
        order = ServiceOrder(
            number=ServiceOrderService.get_next_number(), customer_name="Cliente", plate="OAO2325"
        )
        apply_catalog_vehicle(
            order,
            family=self.gol.modelo.familia,
            version=None,
            source="hdi",
            source_text=GOL_TEXT,
            source_year=2013,
        )
        order.save()
        return order

    def confirm(self, order: ServiceOrder) -> None:
        r = self.client.patch(
            f"/api/v1/service-orders/{order.pk}/", {"catalog_version": self.gol.pk}, format="json"
        )
        assert r.status_code == 200, r.data

    def alias(self) -> VehicleAlias:
        return VehicleAlias.objects.get(source="hdi", raw_key=alias_key(GOL_TEXT, 2013))

    def test_patch_que_confirma_grava_regra(self) -> None:
        self.confirm(self.hdi_order())
        assert self.alias().confirmacoes == 1 and self.alias().version == self.gol
        self.confirm(self.hdi_order())
        assert self.alias().is_exact

    def test_reenviar_a_mesma_versao_numa_os_confirmada_nao_conta(self) -> None:
        order = self.hdi_order()
        self.confirm(order)
        self.confirm(order)
        assert self.alias().confirmacoes == 1

    def test_patch_que_so_limpa_a_versao_nao_conta(self) -> None:
        order = self.hdi_order()
        r = self.client.patch(
            f"/api/v1/service-orders/{order.pk}/", {"catalog_version": None}, format="json"
        )
        assert r.status_code == 200, r.data
        assert not VehicleAlias.objects.exists()

    def test_importacao_so_com_familia_aprende_com_o_ano_da_fonte(self) -> None:
        def import_hdi(casualty: str) -> ServiceOrder:
            parsed = HdiHtmlParser.parse((FIXTURES / "hdi_1.html").read_bytes())
            parsed.casualty_number = casualty
            return persist(parsed)

        first = import_hdi("SIN-1")
        assert (first.catalog_family, first.catalog_version) == (self.gol.modelo.familia, None)
        assert (first.vehicle_source_text, first.vehicle_source_year) == (GOL_TEXT, 2013)
        self.confirm(first)

        second = import_hdi("SIN-2")  # regra nova: preenche a versão, ainda com selo
        assert second.catalog_version == self.gol and second.vehicle_needs_review is True
        self.confirm(second)
        assert self.alias().is_exact

        third = import_hdi("SIN-3")
        assert third.catalog_version == self.gol and third.vehicle_needs_review is False


class DispensarAvisosTest(TenantTestCase):
    def test_import_warnings_so_aceita_lista_vazia(self) -> None:
        order = ServiceOrder.objects.create(
            number=1, customer_name="Cliente", plate="ABC1D23", import_warnings=["Aviso"]
        )
        client = api_client(self.domain.domain, "avisos@dscar.com")
        url = f"/api/v1/service-orders/{order.pk}/"

        r = client.patch(url, {"import_warnings": ["Outro"]}, format="json")
        assert r.status_code == 400 and "import_warnings" in r.data
        order.refresh_from_db()
        assert order.import_warnings == ["Aviso"]

        r = client.patch(url, {"import_warnings": []}, format="json")
        assert r.status_code == 200, r.data
        order.refresh_from_db()
        assert order.import_warnings == []
        assert client.get(url).data["import_warnings"] == []


class XmlUploadNaOsTest(CatalogTenantTestCase):
    def test_soma_com_seguradora_sem_fonte_propria_nao_e_400(self) -> None:
        order = ServiceOrder.objects.create(number=1, customer_name="Cliente", plate="ABC1D23")
        client = api_client(self.domain.domain, "xml@dscar.com")
        xml = (FIXTURES / "xml_ifx_chevrolet_montana.xml").read_bytes()
        r = client.post(
            f"/api/v1/service-orders/{order.pk}/import-budget/",
            {
                "source": "soma",
                "insurer_code": "bradesco",
                "file": SimpleUploadedFile("orc.xml", xml, content_type="text/xml"),
            },
            format="multipart",
        )
        assert 200 <= r.status_code < 300, r.data
        order.refresh_from_db()
        assert order.insurer.code == "bradesco"
        assert order.catalog_version.modelo.codigo_fipe == "004546-2"


class CaminhosDeTextoTest(CatalogTenantTestCase):
    def test_create_from_budget_sem_fk_usa_casamento(self) -> None:
        customer = Person.objects.create(full_name="Cliente Orçamento", person_kind="PF")
        budget = Budget.objects.create(
            number="ORC-2026-000999",
            customer=customer,
            vehicle_plate="ORC1D23",
            vehicle_description="Chevrolet Onix Plus Premier 1.0 Turbo",
        )
        version = BudgetVersion.objects.create(
            budget=budget, version_number=1, status="sent", created_by="test"
        )
        order = ServiceOrderService.create_from_budget(version=version)
        assert order.catalog_family.nome == "Onix Plus" and order.catalog_version is None
        assert order.vehicle_needs_review is True and order.vehicle_source == "orcamento"
        assert order.vehicle_source_text == "Chevrolet Onix Plus Premier 1.0 Turbo"

    def test_quotes_aprovar_usa_casamento(self) -> None:
        from apps.customers.models import UnifiedCustomer
        from apps.pricing_engine.models import CalculoCustoSnapshot
        from apps.pricing_profile.models import Empresa
        from apps.quotes.models import Orcamento, OrcamentoItemAdicional
        from apps.quotes.services import OrcamentoService
        from apps.service_orders.models import ServiceCatalog

        empresa = Empresa.objects.create(
            cnpj="55555555000155", nome_fantasia="DS Car", razao_social="DS Car Ltda"
        )
        orc = Orcamento.objects.create(
            empresa=empresa,
            numero="ORC-T11",
            customer=UnifiedCustomer.objects.create(name="Cliente Quotes"),
            veiculo_marca="NISSAN",
            veiculo_modelo="KICKS",
            veiculo_versao="S DIRECT AUT 1.6 16V FLEX",
            veiculo_ano=2019,
            enquadramento_snapshot={},
            validade=date(2026, 12, 31),
        )
        snapshot = CalculoCustoSnapshot.objects.create(
            empresa=empresa,
            origem="simulacao",
            contexto={},
            custo_mo=Decimal("0"),
            custo_insumos=Decimal("0"),
            rateio=Decimal("0"),
            custo_peca_base=Decimal("0"),
            custo_total_base=Decimal("0"),
            fator_responsabilidade=Decimal("0"),
            margem_base=Decimal("0"),
            margem_ajustada=Decimal("0"),
            preco_calculado=Decimal("50"),
            preco_final=Decimal("50"),
            decomposicao={},
        )
        OrcamentoItemAdicional.objects.create(
            orcamento=orc,
            service_catalog=ServiceCatalog.objects.create(name="Lavagem"),
            preco_unitario=Decimal("50"),
            preco_total=Decimal("50"),
            snapshot=snapshot,
        )

        order = OrcamentoService.aprovar(
            orcamento_id=str(orc.pk),
            intervencoes_ids=None,
            itens_adicionais_ids=None,
            areas_negadas=None,
            user_id=None,
        )

        assert order.catalog_version == fipe_version("023158-4", 2019)
        assert order.catalog_family.nome == "Kicks" and order.vehicle_source == "quotes"
        assert order.vehicle_source_text == "NISSAN KICKS S DIRECT AUT 1.6 16V FLEX"
