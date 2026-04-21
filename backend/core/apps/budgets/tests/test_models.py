import pytest
from decimal import Decimal

from apps.budgets.models import Budget, BudgetVersion, BudgetVersionItem
from apps.persons.models import Person


@pytest.fixture
def person(db):
    """Pessoa cliente para testes de Budget.

    Ajustado para o model Person real (full_name + person_type, sem 'document').
    """
    return Person.objects.create(
        full_name="João Particular",
        person_type="CLIENT",
    )


@pytest.mark.django_db
class TestBudget:
    def test_create(self, person):
        b = Budget.objects.create(
            number="OR-000001",
            customer=person,
            vehicle_plate="ABC1D23",
            vehicle_description="Honda Fit 2019",
        )
        assert str(b) == "OR-000001 — ABC1D23"

    def test_active_version_initially_none(self, person):
        b = Budget.objects.create(
            number="OR-000002",
            customer=person,
            vehicle_plate="XYZ9Z99",
            vehicle_description="Fiat",
        )
        assert b.active_version is None


@pytest.mark.django_db
class TestBudgetVersion:
    def test_status_label(self, person):
        b = Budget.objects.create(
            number="OR-000010",
            customer=person,
            vehicle_plate="PQR1S23",
            vehicle_description="VW Up",
        )
        v = BudgetVersion.objects.create(budget=b, version_number=1, status="draft")
        assert v.status_label == "OR-000010 v1 — Rascunho"

    def test_is_frozen(self, person):
        b = Budget.objects.create(
            number="OR-000011",
            customer=person,
            vehicle_plate="PQR1S24",
            vehicle_description="VW Up",
        )
        draft = BudgetVersion.objects.create(budget=b, version_number=1, status="draft")
        sent = BudgetVersion.objects.create(budget=b, version_number=2, status="sent")
        assert draft.is_frozen() is False
        assert sent.is_frozen() is True

    def test_unique_version_per_budget(self, person):
        from django.db.utils import IntegrityError

        b = Budget.objects.create(
            number="OR-000012",
            customer=person,
            vehicle_plate="PQR1S25",
            vehicle_description="VW Up",
        )
        BudgetVersion.objects.create(budget=b, version_number=1)
        with pytest.raises(IntegrityError):
            BudgetVersion.objects.create(budget=b, version_number=1)


@pytest.mark.django_db
class TestBudgetVersionItem:
    def test_create_part_item(self, person):
        b = Budget.objects.create(
            number="OR-000020",
            customer=person,
            vehicle_plate="ABC1D23",
            vehicle_description="Honda",
        )
        v = BudgetVersion.objects.create(budget=b, version_number=1)
        item = BudgetVersionItem.objects.create(
            version=v,
            description="AMORTECEDOR DIANT ESQ",
            external_code="543035RA1C",
            part_type="ORIGINAL",
            quantity=Decimal("1"),
            unit_price=Decimal("625.00"),
            net_price=Decimal("625.00"),
            item_type="PART",
        )
        assert item.description == "AMORTECEDOR DIANT ESQ"
        assert item.payer_block == "PARTICULAR"  # default do mixin
