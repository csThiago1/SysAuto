import pytest
from decimal import Decimal

from django.db.utils import IntegrityError

from apps.persons.models import Person
from apps.service_orders.models import (
    ImpactAreaLabel,
    Insurer,
    ServiceOrder,
    ServiceOrderParecer,
    ServiceOrderVersion,
    ServiceOrderVersionItem,
)


@pytest.fixture
def person(db):
    return Person.objects.create(full_name="João Dono", person_type="CLIENT")


@pytest.fixture
def yelum(db):
    return Insurer.objects.get(code="yelum")


@pytest.mark.django_db
class TestServiceOrderCustomerType:
    def test_default_particular(self, person):
        os = ServiceOrder.objects.create(
            os_number="OS-TEST-001",
            customer=person,
            vehicle_plate="ABC1D23",
            vehicle_description="Test",
        )
        assert os.customer_type == "PARTICULAR"

    def test_create_seguradora(self, person, yelum):
        os = ServiceOrder.objects.create(
            os_number="OS-TEST-002",
            customer=person,
            customer_type="SEGURADORA",
            insurer=yelum,
            casualty_number="SIN-999",
            vehicle_plate="XYZ9Z99",
            vehicle_description="Test",
        )
        assert os.customer_type == "SEGURADORA"
        assert os.insurer == yelum


@pytest.mark.django_db
class TestUniqueInsurerCasualty:
    """UniqueConstraint uq_insurer_casualty com partial index (casualty_number__gt="")."""

    def test_blocks_duplicate(self, person, yelum):
        ServiceOrder.objects.create(
            os_number="OS-DUP-1",
            customer=person,
            customer_type="SEGURADORA",
            insurer=yelum,
            casualty_number="SIN-DUP",
            vehicle_plate="AAA1234",
            vehicle_description="x",
        )
        with pytest.raises(IntegrityError):
            ServiceOrder.objects.create(
                os_number="OS-DUP-2",
                customer=person,
                customer_type="SEGURADORA",
                insurer=yelum,
                casualty_number="SIN-DUP",
                vehicle_plate="BBB1234",
                vehicle_description="y",
            )

    def test_allows_empty_casualty(self, person, yelum):
        """Partial index: casualty_number='' nao bloqueia duplicatas (sem sinistro atribuido ainda)."""
        ServiceOrder.objects.create(
            os_number="OS-EMP-1",
            customer=person,
            customer_type="SEGURADORA",
            insurer=yelum,
            casualty_number="",
            vehicle_plate="CCC1234",
            vehicle_description="z",
        )
        # Nao deve raise
        ServiceOrder.objects.create(
            os_number="OS-EMP-2",
            customer=person,
            customer_type="SEGURADORA",
            insurer=yelum,
            casualty_number="",
            vehicle_plate="DDD1234",
            vehicle_description="w",
        )

    def test_different_insurers_same_casualty_ok(self, person, yelum):
        porto = Insurer.objects.get(code="porto")
        ServiceOrder.objects.create(
            os_number="OS-INS-1",
            customer=person,
            customer_type="SEGURADORA",
            insurer=yelum,
            casualty_number="SAME-NUM",
            vehicle_plate="EEE1234",
            vehicle_description="v",
        )
        # Mesma casualty em outra seguradora e OK
        ServiceOrder.objects.create(
            os_number="OS-INS-2",
            customer=person,
            customer_type="SEGURADORA",
            insurer=porto,
            casualty_number="SAME-NUM",
            vehicle_plate="FFF1234",
            vehicle_description="u",
        )


@pytest.mark.django_db
class TestActiveVersion:
    def test_initially_none(self, person):
        os = ServiceOrder.objects.create(
            os_number="OS-AV-1",
            customer=person,
            vehicle_plate="GGG1234",
            vehicle_description="t",
        )
        assert os.active_version is None

    def test_returns_highest_version_number(self, person):
        os = ServiceOrder.objects.create(
            os_number="OS-AV-2",
            customer=person,
            vehicle_plate="HHH1234",
            vehicle_description="s",
        )
        ServiceOrderVersion.objects.create(service_order=os, version_number=1)
        ServiceOrderVersion.objects.create(service_order=os, version_number=2)
        ServiceOrderVersion.objects.create(service_order=os, version_number=3)
        assert os.active_version.version_number == 3


@pytest.mark.django_db
class TestServiceOrderVersion:
    def test_status_label_with_external(self, person, yelum):
        os = ServiceOrder.objects.create(
            os_number="OS-SL-1",
            customer=person,
            customer_type="SEGURADORA",
            insurer=yelum,
            casualty_number="SIN-SL1",
            vehicle_plate="III1234",
            vehicle_description="r",
        )
        v = ServiceOrderVersion.objects.create(
            service_order=os,
            version_number=1,
            external_version="821980.1",
            source="cilia",
            status="autorizado",
        )
        assert v.status_label == "821980.1 — Autorizado"

    def test_status_label_without_external(self, person):
        os = ServiceOrder.objects.create(
            os_number="OS-SL-2",
            customer=person,
            vehicle_plate="JJJ1234",
            vehicle_description="q",
        )
        v = ServiceOrderVersion.objects.create(
            service_order=os,
            version_number=2,
            source="manual",
            status="approved",
        )
        assert v.status_label == "v2 — Aprovada"

    def test_unique_version_per_os(self, person):
        os = ServiceOrder.objects.create(
            os_number="OS-UQ-1",
            customer=person,
            vehicle_plate="KKK1234",
            vehicle_description="p",
        )
        ServiceOrderVersion.objects.create(service_order=os, version_number=1)
        with pytest.raises(IntegrityError):
            ServiceOrderVersion.objects.create(service_order=os, version_number=1)


@pytest.mark.django_db
class TestServiceOrderVersionItem:
    def test_default_payer_block_particular(self, person):
        os = ServiceOrder.objects.create(
            os_number="OS-IT-1",
            customer=person,
            vehicle_plate="LLL1234",
            vehicle_description="o",
        )
        v = ServiceOrderVersion.objects.create(service_order=os, version_number=1)
        item = ServiceOrderVersionItem.objects.create(
            version=v,
            description="PARA-CHOQUE",
            quantity=Decimal("1"),
            unit_price=Decimal("1000"),
            net_price=Decimal("1000"),
        )
        assert item.payer_block == "PARTICULAR"  # default do mixin


@pytest.fixture
def os_instance(db, person):
    return ServiceOrder.objects.create(
        os_number="OS-PA-1", customer=person,
        vehicle_plate="PA1A234", vehicle_description="Test",
    )


@pytest.mark.django_db
class TestParecer:
    def test_create_internal(self, os_instance):
        p = ServiceOrderParecer.objects.create(
            service_order=os_instance,
            source="internal",
            author_internal="alice",
            parecer_type="COMENTARIO_INTERNO",
            body="Cliente ligou pedindo atualização",
        )
        assert p.source == "internal"
        assert p.body.startswith("Cliente")

    def test_create_external_cilia(self, os_instance):
        p = ServiceOrderParecer.objects.create(
            service_order=os_instance,
            source="cilia",
            flow_number=1,
            author_external="Marcelo",
            author_org="Yelum Seguradora",
            parecer_type="AUTORIZADO",
            body="Reparos autorizados.",
        )
        assert p.flow_number == 1
        assert p.author_org == "Yelum Seguradora"


@pytest.mark.django_db
class TestImpactAreaLabel:
    def test_unique_area_per_os(self, os_instance):
        ImpactAreaLabel.objects.create(service_order=os_instance, area_number=1, label_text="Frontal")
        with pytest.raises(IntegrityError):
            ImpactAreaLabel.objects.create(service_order=os_instance, area_number=1, label_text="Outro")

    def test_ordering_by_area_number(self, os_instance):
        ImpactAreaLabel.objects.create(service_order=os_instance, area_number=3, label_text="C")
        ImpactAreaLabel.objects.create(service_order=os_instance, area_number=1, label_text="A")
        ImpactAreaLabel.objects.create(service_order=os_instance, area_number=2, label_text="B")
        labels = list(os_instance.area_labels.all())
        assert [label.area_number for label in labels] == [1, 2, 3]


@pytest.mark.django_db
class TestSnapshotFields:

    def test_raw_payload_stores_json(self, person):
        os = ServiceOrder.objects.create(
            os_number="OS-SNAP-1", customer=person,
            vehicle_plate="SNP1234", vehicle_description="Test",
        )
        v = ServiceOrderVersion.objects.create(
            service_order=os, version_number=1,
            raw_payload={"source": "cilia", "budget_id": 17732641, "items": [1, 2, 3]},
            external_budget_id=17732641,
            external_version_id=30629056,
            external_flow_number=2,
        )
        assert v.raw_payload["budget_id"] == 17732641
        assert v.external_flow_number == 2

    def test_report_base64_fields(self, person):
        os = ServiceOrder.objects.create(
            os_number="OS-SNAP-2", customer=person,
            vehicle_plate="SNP5678", vehicle_description="Test",
        )
        v = ServiceOrderVersion.objects.create(
            service_order=os, version_number=1,
            report_pdf_base64="PDFCONTENT_BASE64",
            report_html_base64="<html>base64</html>",
        )
        assert v.report_pdf_base64 == "PDFCONTENT_BASE64"
