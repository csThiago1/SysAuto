"""Tests for ServiceOrderService — Task 8 (Ciclo 02).

Covers:
- change_status valid/invalid transitions
- OSEventLogger events (STATUS_CHANGE vs AUTO_TRANSITION)
- previous_status salvo na re-entrada em budget a partir de repair states
- _can_deliver: trava NFS-e para particular e versão autorizada para seguradora
"""
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from apps.persons.models import Person
from apps.service_orders.models import (
    Insurer,
    ServiceOrder,
    ServiceOrderEvent,
    ServiceOrderVersion,
)
from apps.service_orders.services import ServiceOrderService


@pytest.fixture
def person(db):
    return Person.objects.create(full_name="Service Test", person_type="CLIENT")


@pytest.fixture
def os_instance(person):
    return ServiceOrder.objects.create(
        os_number="OS-SVC-1",
        customer=person,
        vehicle_plate="SVC1234",
        vehicle_description="Test",
    )


@pytest.mark.django_db
class TestChangeStatus:

    def test_valid_transition(self, os_instance):
        ServiceOrderService.change_status(
            service_order=os_instance,
            new_status="initial_survey",
            changed_by="alice",
            notes="iniciando vistoria",
        )
        os_instance.refresh_from_db()
        assert os_instance.status == "initial_survey"

    def test_invalid_transition_raises(self, os_instance):
        with pytest.raises(ValidationError):
            ServiceOrderService.change_status(
                service_order=os_instance,
                new_status="painting",  # direto de reception — inválido
            )

    def test_emits_status_change_event(self, os_instance):
        ServiceOrderService.change_status(
            service_order=os_instance,
            new_status="initial_survey",
            changed_by="alice",
            notes="x",
        )
        evs = os_instance.events.filter(event_type="STATUS_CHANGE")
        assert evs.count() == 1
        ev = evs.first()
        assert ev.from_state == "reception"
        assert ev.to_state == "initial_survey"
        assert ev.actor == "alice"

    def test_auto_transition_emits_auto_event(self, os_instance):
        ServiceOrderService.change_status(
            service_order=os_instance,
            new_status="initial_survey",
            changed_by="Sistema",
            is_auto=True,
        )
        evs = os_instance.events.filter(event_type="AUTO_TRANSITION")
        assert evs.count() == 1

    def test_auto_transition_does_not_emit_status_change_event(self, os_instance):
        """is_auto=True gera AUTO_TRANSITION, não STATUS_CHANGE."""
        ServiceOrderService.change_status(
            service_order=os_instance,
            new_status="initial_survey",
            changed_by="Sistema",
            is_auto=True,
        )
        assert os_instance.events.filter(event_type="STATUS_CHANGE").count() == 0

    def test_manual_transition_does_not_emit_auto_event(self, os_instance):
        """is_auto=False (default) gera STATUS_CHANGE, não AUTO_TRANSITION."""
        ServiceOrderService.change_status(
            service_order=os_instance,
            new_status="initial_survey",
            changed_by="alice",
        )
        assert os_instance.events.filter(event_type="AUTO_TRANSITION").count() == 0

    def test_notes_stored_in_event_payload(self, os_instance):
        ServiceOrderService.change_status(
            service_order=os_instance,
            new_status="initial_survey",
            changed_by="alice",
            notes="movendo para vistoria inicial",
        )
        ev = os_instance.events.filter(event_type="STATUS_CHANGE").first()
        assert ev.payload == {"notes": "movendo para vistoria inicial"}

    def test_empty_notes_produces_empty_payload(self, os_instance):
        ServiceOrderService.change_status(
            service_order=os_instance,
            new_status="initial_survey",
            changed_by="alice",
            notes="",
        )
        ev = os_instance.events.filter(event_type="STATUS_CHANGE").first()
        assert ev.payload == {}

    def test_budget_entry_saves_previous_status(self, person):
        """OS em repair → budget salva previous_status=repair."""
        os = ServiceOrder.objects.create(
            os_number="OS-PREV-1",
            customer=person,
            vehicle_plate="PRE1234",
            vehicle_description="Test",
            status="repair",
        )
        ServiceOrderService.change_status(
            service_order=os,
            new_status="budget",
            changed_by="Sistema",
            is_auto=True,
        )
        os.refresh_from_db()
        assert os.previous_status == "repair"

    def test_budget_entry_from_mechanic_saves_previous_status(self, person):
        """OS em mechanic → budget salva previous_status=mechanic."""
        os = ServiceOrder.objects.create(
            os_number="OS-PREV-3",
            customer=person,
            vehicle_plate="PRE3234",
            vehicle_description="Test",
            status="mechanic",
        )
        ServiceOrderService.change_status(
            service_order=os,
            new_status="budget",
            changed_by="Sistema",
            is_auto=True,
        )
        os.refresh_from_db()
        assert os.previous_status == "mechanic"

    def test_budget_entry_from_non_repair_does_not_save_previous(self, person):
        """OS em initial_survey → budget não salva previous_status (não é re-entrada)."""
        os = ServiceOrder.objects.create(
            os_number="OS-PREV-2",
            customer=person,
            vehicle_plate="PRE5678",
            vehicle_description="Test",
            status="initial_survey",
        )
        ServiceOrderService.change_status(
            service_order=os,
            new_status="budget",
            changed_by="Sistema",
        )
        os.refresh_from_db()
        # previous_status deve permanecer vazio (valor inicial)
        assert os.previous_status == ""

    def test_returns_service_order_instance(self, os_instance):
        result = ServiceOrderService.change_status(
            service_order=os_instance,
            new_status="initial_survey",
        )
        assert isinstance(result, ServiceOrder)
        assert result.status == "initial_survey"


@pytest.mark.django_db
class TestDeliveryTrava:

    def test_cannot_deliver_particular_without_nfse(self, person):
        """Particular em ready sem NFS-e emitida → ValidationError."""
        os = ServiceOrder.objects.create(
            os_number="OS-DEL-1",
            customer=person,
            customer_type="PARTICULAR",
            vehicle_plate="DEL1234",
            vehicle_description="x",
            status="ready",
        )
        with pytest.raises(ValidationError, match="NFS-e"):
            ServiceOrderService.change_status(
                service_order=os,
                new_status="delivered",
            )

    def test_particular_delivers_when_nfse_ref_present(self, person):
        """Particular com Payment que tem fiscal_doc_ref preenchido → entrega OK."""
        from apps.payments.models import Payment

        os = ServiceOrder.objects.create(
            os_number="OS-DEL-1B",
            customer=person,
            customer_type="PARTICULAR",
            vehicle_plate="DEL1B34",
            vehicle_description="x",
            status="ready",
        )
        Payment.objects.create(
            service_order=os,
            payer_block="PARTICULAR",
            amount=Decimal("500"),
            method="PIX",
            fiscal_doc_ref="NFSE-12345",  # sinaliza emissão
            status="received",
        )
        ServiceOrderService.change_status(service_order=os, new_status="delivered")
        os.refresh_from_db()
        assert os.status == "delivered"

    def test_seguradora_needs_autorizado_version(self, person):
        """Seguradora sem versão autorizada → ValidationError."""
        yelum = Insurer.objects.get(code="yelum")
        os = ServiceOrder.objects.create(
            os_number="OS-DEL-2",
            customer=person,
            customer_type="SEGURADORA",
            insurer=yelum,
            casualty_number="SIN-99",
            vehicle_plate="DEL5678",
            vehicle_description="x",
            status="ready",
        )
        ServiceOrderVersion.objects.create(
            service_order=os,
            version_number=1,
            source="cilia",
            status="em_analise",
        )
        with pytest.raises(ValidationError, match="autorizada"):
            ServiceOrderService.change_status(
                service_order=os,
                new_status="delivered",
            )

    def test_seguradora_delivers_when_autorizado(self, person):
        """Seguradora com versão autorizada → entrega OK."""
        yelum = Insurer.objects.get(code="yelum")
        os = ServiceOrder.objects.create(
            os_number="OS-DEL-3",
            customer=person,
            customer_type="SEGURADORA",
            insurer=yelum,
            casualty_number="SIN-100",
            vehicle_plate="DEL9999",
            vehicle_description="x",
            status="ready",
        )
        ServiceOrderVersion.objects.create(
            service_order=os,
            version_number=1,
            source="cilia",
            status="autorizado",
        )
        ServiceOrderService.change_status(service_order=os, new_status="delivered")
        os.refresh_from_db()
        assert os.status == "delivered"

    def test_seguradora_without_any_version_raises(self, person):
        """Seguradora sem nenhuma versão → ValidationError."""
        yelum = Insurer.objects.get(code="yelum")
        os = ServiceOrder.objects.create(
            os_number="OS-DEL-4",
            customer=person,
            customer_type="SEGURADORA",
            insurer=yelum,
            casualty_number="SIN-101",
            vehicle_plate="DEL0001",
            vehicle_description="x",
            status="ready",
        )
        with pytest.raises(ValidationError, match="autorizada"):
            ServiceOrderService.change_status(
                service_order=os,
                new_status="delivered",
            )

    def test_delivery_emits_status_change_event(self, person):
        """Entrega bem-sucedida emite evento STATUS_CHANGE ready→delivered."""
        from apps.payments.models import Payment

        os = ServiceOrder.objects.create(
            os_number="OS-DEL-5",
            customer=person,
            customer_type="PARTICULAR",
            vehicle_plate="DEL0005",
            vehicle_description="x",
            status="ready",
        )
        Payment.objects.create(
            service_order=os,
            payer_block="PARTICULAR",
            amount=Decimal("300"),
            method="PIX",
            fiscal_doc_ref="NFSE-99999",
            status="received",
        )
        ServiceOrderService.change_status(service_order=os, new_status="delivered")
        ev = os.events.filter(event_type="STATUS_CHANGE").first()
        assert ev is not None
        assert ev.from_state == "ready"
        assert ev.to_state == "delivered"


from dataclasses import dataclass, field


@dataclass
class _FakeParsedBudget:
    """Mock do ParsedBudget (dataclass real fica no Ciclo 4)."""
    source: str = "cilia"
    external_version: str = ""
    external_numero_vistoria: str = ""
    external_integration_id: str = ""
    external_status: str = "analisado"
    hourly_rates: dict = field(default_factory=dict)
    global_discount_pct: Decimal = Decimal("0")
    raw_hash: str = ""


@pytest.mark.django_db
class TestCreateNewVersionFromImport:

    def _make_os_seguradora(self, person):
        yelum = Insurer.objects.get(code="yelum")
        return ServiceOrder.objects.create(
            os_number="OS-IMP-1", customer=person, customer_type="SEGURADORA",
            insurer=yelum, casualty_number="SIN-IMP-1",
            external_budget_number="821980",
            vehicle_plate="IMP1234", vehicle_description="Kicks",
            status="reception",
        )

    def test_creates_version_numbered_next(self, person):
        os = self._make_os_seguradora(person)
        ServiceOrderVersion.objects.create(
            service_order=os, version_number=1, source="cilia",
            external_version="821980.1", status="analisado",
        )
        parsed = _FakeParsedBudget(
            source="cilia", external_version="821980.2",
            external_status="analisado", raw_hash="abc",
        )
        new_v = ServiceOrderService.create_new_version_from_import(
            service_order=os, parsed_budget=parsed, import_attempt=None,
        )
        assert new_v.version_number == 2
        assert new_v.external_version == "821980.2"

    def test_first_version_is_v1(self, person):
        os = self._make_os_seguradora(person)  # sem versions ainda
        parsed = _FakeParsedBudget(external_version="999.1", raw_hash="h")
        new_v = ServiceOrderService.create_new_version_from_import(
            service_order=os, parsed_budget=parsed, import_attempt=None,
        )
        assert new_v.version_number == 1

    def test_emits_version_created_and_import_events(self, person):
        os = self._make_os_seguradora(person)
        parsed = _FakeParsedBudget(external_version="821980.1", raw_hash="h")
        ServiceOrderService.create_new_version_from_import(
            service_order=os, parsed_budget=parsed, import_attempt=None,
        )
        assert os.events.filter(event_type="VERSION_CREATED").exists()
        assert os.events.filter(event_type="IMPORT_RECEIVED").exists()

    def test_pauses_os_in_budget_if_not_reception(self, person):
        os = self._make_os_seguradora(person)
        os.status = "repair"
        os.save()
        parsed = _FakeParsedBudget(external_version="821980.2", raw_hash="h")
        ServiceOrderService.create_new_version_from_import(
            service_order=os, parsed_budget=parsed, import_attempt=None,
        )
        os.refresh_from_db()
        assert os.status == "budget"
        assert os.previous_status == "repair"

    def test_does_not_pause_if_reception(self, person):
        os = self._make_os_seguradora(person)
        os.status = "reception"
        os.save()
        parsed = _FakeParsedBudget(external_version="821980.1", raw_hash="h")
        ServiceOrderService.create_new_version_from_import(
            service_order=os, parsed_budget=parsed, import_attempt=None,
        )
        os.refresh_from_db()
        assert os.status == "reception"

    def test_does_not_pause_if_already_in_budget(self, person):
        os = self._make_os_seguradora(person)
        os.status = "budget"
        os.save()
        parsed = _FakeParsedBudget(external_version="821980.2", raw_hash="h")
        ServiceOrderService.create_new_version_from_import(
            service_order=os, parsed_budget=parsed, import_attempt=None,
        )
        os.refresh_from_db()
        assert os.status == "budget"


@pytest.mark.django_db
class TestApproveVersion:

    def _setup(self, person):
        yelum = Insurer.objects.get(code="yelum")
        os = ServiceOrder.objects.create(
            os_number="OS-APV-1", customer=person, customer_type="SEGURADORA",
            insurer=yelum, casualty_number="SIN-APV-1",
            vehicle_plate="APV1234", vehicle_description="x",
            status="budget",
            previous_status="repair",
        )
        v = ServiceOrderVersion.objects.create(
            service_order=os, version_number=1, source="cilia",
            external_version="999999.1", status="em_analise",
        )
        return os, v

    def test_approve_seguradora_marks_autorizado(self, person):
        os, v = self._setup(person)
        ServiceOrderService.approve_version(version=v, approved_by="manager")
        v.refresh_from_db()
        assert v.status == "autorizado"
        assert v.approved_at is not None

    def test_approve_returns_os_to_previous_status(self, person):
        os, v = self._setup(person)
        ServiceOrderService.approve_version(version=v, approved_by="manager")
        os.refresh_from_db()
        assert os.status == "repair"  # voltou

    def test_approve_particular_uses_approved_status(self, person):
        os = ServiceOrder.objects.create(
            os_number="OS-APV-2", customer=person, customer_type="PARTICULAR",
            vehicle_plate="APV5678", vehicle_description="x",
            status="budget",
            previous_status="",
        )
        v = ServiceOrderVersion.objects.create(
            service_order=os, version_number=1, source="manual", status="pending",
        )
        ServiceOrderService.approve_version(version=v, approved_by="alice")
        v.refresh_from_db()
        assert v.status == "approved"

    def test_approve_supersedes_others(self, person):
        os, v1 = self._setup(person)
        v2 = ServiceOrderVersion.objects.create(
            service_order=os, version_number=2, source="cilia",
            external_version="999999.2", status="em_analise",
        )
        ServiceOrderService.approve_version(version=v2, approved_by="manager")
        v1.refresh_from_db()
        assert v1.status == "superseded"

    def test_approve_emits_event(self, person):
        os, v = self._setup(person)
        ServiceOrderService.approve_version(version=v, approved_by="manager")
        assert os.events.filter(event_type="VERSION_APPROVED").exists()
