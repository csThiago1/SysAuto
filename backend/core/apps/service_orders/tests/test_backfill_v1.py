from decimal import Decimal
from importlib import import_module

import pytest
from django.apps import apps as django_apps

from apps.persons.models import Person
from apps.service_orders.models import ServiceOrder, ServiceOrderVersion


@pytest.fixture
def person(db):
    return Person.objects.create(full_name="Backfill Test", person_type="CLIENT")


@pytest.mark.django_db
class TestBackfillV1:
    """Data migration 0009 cria v1 para OS sem versions.

    Como o pytest-django roda migrations ao setup, qualquer OS criada nos testes
    vem já após a migration. Invocamos a função manualmente pra validar a lógica.
    """

    def _invoke_backfill(self) -> None:
        mod = import_module(
            "apps.service_orders.migrations.0009_backfill_v1_for_existing_os",
        )
        mod.backfill_v1(django_apps, None)

    def test_creates_v1_with_net_total_from_total_value(self, person):
        os = ServiceOrder.objects.create(
            os_number="OS-BF-1", customer=person,
            vehicle_plate="BF1A234", vehicle_description="Legacy",
            total_value=Decimal("1250.50"),
            status="repair",
        )
        # OS legada sem versions
        assert os.versions.count() == 0

        self._invoke_backfill()

        os.refresh_from_db()
        assert os.versions.count() == 1
        v = os.active_version
        assert v.version_number == 1
        assert v.source == "manual"
        assert v.status == "approved"
        assert v.net_total == Decimal("1250.50")
        assert v.subtotal == Decimal("1250.50")
        assert v.created_by == "Sistema (migração 0.1 backfill)"

    def test_cancelled_os_gets_rejected_version(self, person):
        os = ServiceOrder.objects.create(
            os_number="OS-BF-2", customer=person,
            vehicle_plate="BF2A234", vehicle_description="Cancelled",
            total_value=Decimal("500"),
            status="cancelled",
        )
        self._invoke_backfill()
        v = os.active_version
        assert v.status == "rejected"

    def test_idempotent_skips_os_with_existing_version(self, person):
        os = ServiceOrder.objects.create(
            os_number="OS-BF-3", customer=person,
            vehicle_plate="BF3A234", vehicle_description="Has version",
            total_value=Decimal("300"),
        )
        # Cria version manualmente
        ServiceOrderVersion.objects.create(
            service_order=os, version_number=1,
            source="manual", status="approved", net_total=Decimal("999"),
        )
        initial_count = os.versions.count()

        self._invoke_backfill()

        # Não deve criar nova version nem alterar existente
        os.refresh_from_db()
        assert os.versions.count() == initial_count
        assert os.active_version.net_total == Decimal("999")  # não foi sobrescrito

    def test_zero_total_value_handled(self, person):
        os = ServiceOrder.objects.create(
            os_number="OS-BF-4", customer=person,
            vehicle_plate="BF4A234", vehicle_description="Zero",
            total_value=Decimal("0"),
        )
        self._invoke_backfill()
        v = os.active_version
        assert v.net_total == Decimal("0")

    def test_reverse_removes_only_backfill_versions(self, person):
        os = ServiceOrder.objects.create(
            os_number="OS-BF-5", customer=person,
            vehicle_plate="BF5A234", vehicle_description="Reverse test",
            total_value=Decimal("100"),
        )
        # Cria version manual (não-backfill)
        manual_v = ServiceOrderVersion.objects.create(
            service_order=os, version_number=2,
            source="manual", status="approved", net_total=Decimal("200"),
            created_by="João manual",
        )
        # Roda backfill (skip — já tem version)
        self._invoke_backfill()
        # Cria backfill version "artificial" pra validar reverse
        bf_v = ServiceOrderVersion.objects.create(
            service_order=os, version_number=3,
            source="manual", status="approved", net_total=Decimal("150"),
            created_by="Sistema (migração 0.1 backfill)",
        )

        mod = import_module(
            "apps.service_orders.migrations.0009_backfill_v1_for_existing_os",
        )
        mod.reverse_backfill(django_apps, None)

        # A backfill foi removida; a manual permanece
        os.refresh_from_db()
        remaining = list(os.versions.values_list("version_number", flat=True))
        assert 2 in remaining
        assert 3 not in remaining
