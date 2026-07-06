"""Testes do preflight de faturamento (validation.validate_service_order_for_billing)."""
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.fiscal.models import FiscalConfigModel
from apps.fiscal.services.validation import validate_service_order_for_billing
from apps.persons.models import Person, PersonAddress, PersonDocument, PersonRole
from apps.service_orders.models import ServiceOrder, ServiceOrderPart, ServiceOrderStatus

import hashlib


def _codes(issues: list[dict]) -> set[str]:
    return {i["code"] for i in issues}


class BillingValidationTestCase(TenantTestCase):

    def setUp(self) -> None:
        super().setUp()
        self.user = GlobalUser.objects.create_user(
            email="preflight@dscar.com",
            email_hash=hashlib.sha256(b"preflight@dscar.com").hexdigest(),
            password="x",
        )

    def _make_order(self, person: Person | None = None, **kwargs) -> ServiceOrder:
        return ServiceOrder.objects.create(
            number=kwargs.pop("number", 9500),
            plate="PRE1F23",
            customer=person,
            customer_name=person.full_name if person else "Sem Cadastro",
            customer_type="private",
            status=ServiceOrderStatus.READY,
            created_by=self.user,
            **kwargs,
        )

    def _make_complete_person(self) -> Person:
        person = Person.objects.create(person_kind="PF", full_name="Cliente Completo")
        PersonRole.objects.create(person=person, role="CLIENT")
        PersonDocument.objects.create(
            person=person, doc_type="CPF", value="52998224725", is_primary=True,
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

    def _make_config(self) -> FiscalConfigModel:
        return FiscalConfigModel.objects.create(
            cnpj="12345678000195",
            razao_social="DS Car Teste Ltda",
            inscricao_estadual="042906105",
            inscricao_municipal="123456",
            regime_tributario=3,
            environment="homologacao",
            focus_token="test-token",
            nfe_logradouro="Av. Teste",
            nfe_cep="69050010",
        )

    def test_os_incompleta_lista_todos_os_problemas(self) -> None:
        """Sem config, cliente sem doc/endereço e peça sem NCM → tudo de uma vez."""
        person = Person.objects.create(person_kind="PF", full_name="Cliente Incompleto")
        PersonRole.objects.create(person=person, role="CLIENT")
        order = self._make_order(person, services_total=Decimal("100.00"))
        ServiceOrderPart.objects.create(
            service_order=order,
            description="Parachoque dianteiro",
            quantity=1,
            unit_price=Decimal("500.00"),
        )

        issues = validate_service_order_for_billing(order)
        codes = _codes(issues)

        assert "config_missing" in codes
        assert "customer_no_document" in codes
        assert "customer_no_address" in codes
        assert "part_missing_ncm" in codes
        ncm_issue = next(i for i in issues if i["code"] == "part_missing_ncm")
        assert len(ncm_issue["parts"]) == 1
        assert ncm_issue["parts"][0]["description"] == "Parachoque dianteiro"

    def test_endereco_sem_ibge(self) -> None:
        person = self._make_complete_person()
        person.addresses.update(municipio_ibge="")
        self._make_config()
        order = self._make_order(person, number=9501, services_total=Decimal("100.00"))

        codes = _codes(validate_service_order_for_billing(order))
        assert "customer_no_ibge" in codes
        assert "customer_no_address" not in codes

    def test_os_completa_pronta_para_faturar(self) -> None:
        person = self._make_complete_person()
        self._make_config()
        order = self._make_order(person, number=9502, services_total=Decimal("100.00"))
        ServiceOrderPart.objects.create(
            service_order=order,
            description="Farol LED",
            quantity=1,
            unit_price=Decimal("800.00"),
            ncm="85122011",
        )

        issues = validate_service_order_for_billing(order)
        assert issues == []

    def test_os_sem_valor(self) -> None:
        person = self._make_complete_person()
        self._make_config()
        order = self._make_order(person, number=9503)

        codes = _codes(validate_service_order_for_billing(order))
        assert codes == {"no_billable_value"}

    def test_correcao_de_ncm_em_os_ready_resolve_issue(self) -> None:
        """Fluxo do painel: OS READY permite PATCH ncm-only e o preflight limpa."""
        person = self._make_complete_person()
        self._make_config()
        order = self._make_order(person, number=9505)
        part = ServiceOrderPart.objects.create(
            service_order=order,
            description="Retrovisor",
            quantity=1,
            unit_price=Decimal("200.00"),
        )
        assert "part_missing_ncm" in _codes(validate_service_order_for_billing(order))

        # Simula o fix inline: serializer aceita ncm e OS READY não bloqueia
        from apps.service_orders.serializers.core import ServiceOrderPartSerializer

        serializer = ServiceOrderPartSerializer(part, data={"ncm": "87089990"}, partial=True)
        assert serializer.is_valid(), serializer.errors
        serializer.save()

        part.refresh_from_db()
        assert part.ncm == "87089990"
        assert "part_missing_ncm" not in _codes(validate_service_order_for_billing(order))

    def test_nfse_exige_im_e_nfe_exige_ie(self) -> None:
        person = self._make_complete_person()
        config = self._make_config()
        config.inscricao_municipal = ""
        config.inscricao_estadual = ""
        config.save()
        order = self._make_order(person, number=9504, services_total=Decimal("100.00"))
        ServiceOrderPart.objects.create(
            service_order=order,
            description="Filtro",
            quantity=1,
            unit_price=Decimal("50.00"),
            ncm="84212300",
        )

        codes = _codes(validate_service_order_for_billing(order))
        assert "config_no_im" in codes
        assert "config_no_ie" in codes
