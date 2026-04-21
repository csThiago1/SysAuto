from decimal import Decimal

import pytest

from apps.persons.models import Person
from apps.service_orders.models import (
    ServiceOrder, ServiceOrderEvent, ServiceOrderStatusHistory,
)


@pytest.fixture
def person(db):
    return Person.objects.create(full_name="Test", person_type="CLIENT")


@pytest.mark.django_db
class TestServiceOrderEvent:

    def test_create_status_change(self, person):
        os = ServiceOrder.objects.create(
            os_number="OS-EV-1", customer=person,
            vehicle_plate="EV1A234", vehicle_description="Test",
        )
        ev = ServiceOrderEvent.objects.create(
            service_order=os, event_type="STATUS_CHANGE",
            actor="alice", payload={"notes": "moving"},
            from_state="reception", to_state="initial_survey",
        )
        assert ev.event_type == "STATUS_CHANGE"
        assert os.events.count() == 1

    def test_create_import_received_event(self, person):
        os = ServiceOrder.objects.create(
            os_number="OS-EV-2", customer=person,
            vehicle_plate="EV2A234", vehicle_description="Test",
        )
        ServiceOrderEvent.objects.create(
            service_order=os, event_type="IMPORT_RECEIVED",
            payload={"source": "cilia", "version": "821980.1"},
        )
        assert os.events.filter(event_type="IMPORT_RECEIVED").exists()

    def test_ordering_desc_by_created_at(self, person):
        os = ServiceOrder.objects.create(
            os_number="OS-EV-3", customer=person,
            vehicle_plate="EV3A234", vehicle_description="Test",
        )
        ServiceOrderEvent.objects.create(service_order=os, event_type="STATUS_CHANGE")
        ServiceOrderEvent.objects.create(service_order=os, event_type="VERSION_CREATED")
        events = list(os.events.all())
        # Ordering descendente: mais recente primeiro
        assert events[0].event_type == "VERSION_CREATED"
        assert events[1].event_type == "STATUS_CHANGE"


@pytest.mark.django_db
class TestDataMigrationStatusHistory:
    """Data migration copia ServiceOrderStatusHistory → ServiceOrderEvent.

    Como o pytest-django reaplica migrations do zero, a data migration 0007 roda
    quando o test DB é setup. Validamos que a lógica de cópia funciona criando
    um StatusHistory e invocando a função da migration diretamente.
    """

    def test_copy_function_creates_event(self, person):
        from datetime import timedelta

        from django.utils import timezone

        os = ServiceOrder.objects.create(
            os_number="OS-DM-1", customer=person,
            vehicle_plate="DM1A234", vehicle_description="Test",
        )

        # Criar StatusHistory com timestamp antigo (simular histórico)
        old_timestamp = timezone.now() - timedelta(days=90)
        h = ServiceOrderStatusHistory.objects.create(
            service_order=os, from_status="reception", to_status="initial_survey",
            changed_by="alice", notes="first move",
        )
        # Forçar o changed_at pro passado (auto_now_add não permite direto; update via queryset)
        ServiceOrderStatusHistory.objects.filter(pk=h.pk).update(changed_at=old_timestamp)
        h.refresh_from_db()

        # Invocar a função de copy manualmente (simula data migration)
        import os as os_module
        from importlib import import_module

        migrations_dir = os_module.path.join(
            os_module.path.dirname(
                import_module("apps.service_orders").__file__
            ),
            "migrations",
        )
        mig_name = None
        for fname in os_module.listdir(migrations_dir):
            if "migrate_status_history" in fname and fname.endswith(".py"):
                mig_name = fname[:-3]
                break
        assert mig_name is not None, "Migration de copy_history não encontrada"

        mod = import_module(f"apps.service_orders.migrations.{mig_name}")
        from django.apps import apps as django_apps

        # Limpa events previamente criados pela migration real (se testdb persistir)
        ServiceOrderEvent.objects.filter(service_order=os).delete()
        mod.copy_history(django_apps, None)

        events = ServiceOrderEvent.objects.filter(service_order=os, event_type="STATUS_CHANGE")
        assert events.count() == 1
        ev = events.first()
        assert ev.from_state == "reception"
        assert ev.to_state == "initial_survey"
        assert ev.actor == "alice"
        assert ev.payload == {"notes": "first move"}
        # Critical: timestamp histórico preservado (não sobrescrito por auto_now_add)
        assert abs((ev.created_at - old_timestamp).total_seconds()) < 2, (
            f"Timestamp não preservado: event.created_at={ev.created_at}, expected={old_timestamp}"
        )
