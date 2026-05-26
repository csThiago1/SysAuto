"""MVP fiscal contracts for NF-e/NFS-e emission and Focus audit data."""

from __future__ import annotations

from decimal import Decimal
from typing import Any
from unittest.mock import patch

from django_tenants.test.cases import TenantTestCase

from apps.fiscal.clients.focus_nfe_client import FocusResponse
from apps.fiscal.exceptions import NfeBuilderError
from apps.fiscal.models import FiscalConfigModel, FiscalDocument, FiscalEvent
from apps.fiscal.services.fiscal_service import FiscalService
from apps.fiscal.services.manaus_nfse import ManausNfseBuilder, ManualNfseBuilder
from apps.persons.models import Person, PersonAddress, PersonDocument, PersonRole
from apps.service_orders.models import ServiceOrder, ServiceOrderPart, ServiceOrderStatus


class _FakeFocusClient:
    """Minimal context manager used by FiscalService tests."""

    def __init__(self, response: FocusResponse) -> None:
        self.response = response

    def __enter__(self) -> "_FakeFocusClient":
        return self

    def __exit__(self, *_exc: object) -> bool:
        return False

    def emit_nfse(self, _ref: str, _payload: dict[str, Any]) -> FocusResponse:
        return self.response


def _make_focus_response(data: dict[str, Any]) -> FocusResponse:
    return FocusResponse(
        status_code=201,
        data=data,
        raw_text="",
        headers={},
        duration_ms=11,
    )


def _make_person(
    *,
    name: str = "Cliente Fiscal MVP",
    kind: str = "PF",
    doc_type: str = "CPF",
    doc_value: str = "12345678909",
) -> Person:
    person = Person.objects.create(person_kind=kind, full_name=name)
    PersonRole.objects.create(person=person, role="CLIENT")
    PersonDocument.objects.create(
        person=person,
        doc_type=doc_type,
        value=doc_value,
        is_primary=True,
    )
    PersonAddress.objects.create(
        person=person,
        street="Av. Djalma Batista",
        number="1661",
        neighborhood="Chapada",
        city="Manaus",
        state="AM",
        zip_code="69050010",
        municipio_ibge="1302603",
        is_primary=True,
    )
    return person


def _make_order(person: Person, *, number: int = 9701) -> ServiceOrder:
    return ServiceOrder.objects.create(
        number=number,
        plate=f"FIS{number % 10000:04d}",
        customer=person,
        customer_name=person.full_name,
        customer_type="private",
        status=ServiceOrderStatus.REPAIR,
        services_total=Decimal("250.00"),
        parts_total=Decimal("0.00"),
    )


def _prepare_nfe_config(fiscal_config: FiscalConfigModel) -> None:
    fiscal_config.regime_tributario = 3
    fiscal_config.inscricao_estadual = "042906105"
    fiscal_config.nfe_logradouro = "Av. Djalma Batista"
    fiscal_config.nfe_numero = "1661"
    fiscal_config.nfe_bairro = "Chapada"
    fiscal_config.nfe_municipio = "Manaus"
    fiscal_config.nfe_uf = "AM"
    fiscal_config.nfe_cep = "69050010"
    fiscal_config.save(
        update_fields=[
            "regime_tributario",
            "inscricao_estadual",
            "nfe_logradouro",
            "nfe_numero",
            "nfe_bairro",
            "nfe_municipio",
            "nfe_uf",
            "nfe_cep",
        ]
    )


class FiscalMvpFlowTestCase(TenantTestCase):
    """MVP fiscal contracts with the same tenant harness used by OS tests."""

    def setUp(self) -> None:
        super().setUp()
        self.fiscal_config = FiscalConfigModel.objects.create(
            cnpj="12345678000195",
            razao_social="DS Car Homologação Ltda",
            nome_fantasia="DS Car Teste",
            inscricao_municipal="123456",
            regime_tributario=1,
            environment="homologacao",
            focus_token="test-token-homologacao",
            serie_rps="1",
            seq_nfse=1,
            seq_nfe=1,
            seq_nfce=1,
            is_active=True,
        )

    def test_emit_nfe_requires_real_eight_digit_ncm(self) -> None:
        """NF-e must not use commercial part_number as NCM fallback."""
        person = _make_person()
        order = _make_order(person, number=9702)
        _prepare_nfe_config(self.fiscal_config)
        ServiceOrderPart.objects.create(
            service_order=order,
            description="Parachoque dianteiro",
            part_number="PCH-ABC-123",
            ncm="",
            quantity=Decimal("1.00"),
            unit_price=Decimal("900.00"),
        )

        with self.assertRaisesRegex(NfeBuilderError, "sem NCM"):
            FiscalService.emit_nfe(order, config=self.fiscal_config)

    def test_manaus_nfse_builders_use_configured_dps_series(self) -> None:
        """DPS series is an emitter configuration, not a hard-coded payload value."""
        self.fiscal_config.serie_rps = "2"
        self.fiscal_config.save(update_fields=["serie_rps"])
        person = _make_person()
        order = _make_order(person, number=9703)
        order.destinatario = person

        payload = ManausNfseBuilder.build(
            order,
            self.fiscal_config,
            "12345678-NFSE-20260519-000123",
        )
        manual_payload = ManualNfseBuilder.build(
            {
                "itens": [{"valor_unitario": "100.00", "quantidade": "1"}],
                "discriminacao": "Serviço automotivo",
            },
            person,
            self.fiscal_config,
            "12345678-NFSE-20260519-000124",
        )

        self.assertEqual(payload["serie_dps"], "2")
        self.assertEqual(manual_payload["serie_dps"], "2")

    def test_emit_nfse_persists_authorized_xml_pdf_and_audit(self) -> None:
        """Authorized Focus response must persist XML/PDF references and events."""
        self.fiscal_config.serie_rps = "2"
        self.fiscal_config.save(update_fields=["serie_rps"])
        person = _make_person()
        order = _make_order(person, number=9704)
        response = _make_focus_response(
            {
                "status": "autorizado",
                "numero_nfse": "99",
                "caminho_xml_nota_fiscal": "focus/xml/99.xml",
                "url_danfse": "https://focus.example/danfse/99.pdf",
            }
        )

        with patch.object(
            FiscalService,
            "_make_client",
            staticmethod(lambda _config: _FakeFocusClient(response)),
        ):
            doc = FiscalService.emit_nfse(order, config=self.fiscal_config)

        self.assertEqual(doc.status, FiscalDocument.Status.AUTHORIZED)
        self.assertEqual(doc.number, "99")
        self.assertEqual(doc.series, "2")
        self.assertEqual(doc.caminho_xml, "focus/xml/99.xml")
        self.assertEqual(doc.caminho_pdf, "https://focus.example/danfse/99.pdf")
        self.assertIsNotNone(doc.authorized_at)
        self.assertEqual(FiscalEvent.objects.filter(document=doc).count(), 2)

    def test_emit_nfse_persists_focus_rejection_reason(self) -> None:
        """Focus rejection code/message must be kept for fiscal triage."""
        person = _make_person()
        order = _make_order(person, number=9705)
        response = _make_focus_response(
            {
                "status": "erro_autorizacao",
                "erros": [
                    {
                        "codigo": "E212",
                        "mensagem": "Data de emissão fora do timezone esperado.",
                    }
                ],
            }
        )

        with patch.object(
            FiscalService,
            "_make_client",
            staticmethod(lambda _config: _FakeFocusClient(response)),
        ):
            doc = FiscalService.emit_nfse(order, config=self.fiscal_config)
        doc.refresh_from_db()

        self.assertEqual(doc.status, FiscalDocument.Status.REJECTED)
        self.assertEqual(doc.natureza_rejeicao, "E212")
        self.assertIn("timezone", doc.mensagem_sefaz)
        self.assertEqual(doc.ultima_resposta["status"], "erro_autorizacao")
