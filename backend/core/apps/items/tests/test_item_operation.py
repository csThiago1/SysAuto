from decimal import Decimal

import pytest
from django.db.utils import IntegrityError

from apps.budgets.models import Budget, BudgetVersion, BudgetVersionItem
from apps.items.models import ItemOperation, ItemOperationType, LaborCategory
from apps.persons.models import Person
from apps.service_orders.models import ServiceOrder, ServiceOrderVersion, ServiceOrderVersionItem


@pytest.fixture
def person(db):
    return Person.objects.create(full_name="Cliente Teste", person_type="CLIENT")


@pytest.fixture
def troca_funilaria(db):
    return (
        ItemOperationType.objects.get(code="TROCA"),
        LaborCategory.objects.get(code="FUNILARIA"),
    )


@pytest.fixture
def budget_item(person, db):
    b = Budget.objects.create(
        number="OR-ITEMOP-1",
        customer=person,
        vehicle_plate="OPP1234",
        vehicle_description="Test",
    )
    v = BudgetVersion.objects.create(budget=b, version_number=1)
    return BudgetVersionItem.objects.create(
        version=v,
        description="PARA-CHOQUE",
        quantity=Decimal("1"),
        unit_price=Decimal("2000"),
        net_price=Decimal("2000"),
    )


@pytest.fixture
def so_item(person, db):
    os = ServiceOrder.objects.create(
        os_number="OS-ITEMOP-1",
        customer=person,
        vehicle_plate="OPP4321",
        vehicle_description="Test",
    )
    v = ServiceOrderVersion.objects.create(service_order=os, version_number=1)
    return ServiceOrderVersionItem.objects.create(
        version=v,
        description="PARA-CHOQUE SO",
        quantity=Decimal("1"),
        unit_price=Decimal("2000"),
        net_price=Decimal("2000"),
    )


@pytest.mark.django_db
class TestItemOperationForBudget:

    def test_create_for_budget_item(self, budget_item, troca_funilaria):
        op_type, labor_cat = troca_funilaria
        op = ItemOperation.objects.create(
            item_budget=budget_item,
            operation_type=op_type,
            labor_category=labor_cat,
            hours=Decimal("1.00"),
            hourly_rate=Decimal("40"),
            labor_cost=Decimal("40"),
        )
        assert op.item_so is None
        assert op.item_budget == budget_item
        assert budget_item.operations.count() == 1

    def test_multiple_operations_per_item(self, budget_item, db):
        troca = ItemOperationType.objects.get(code="TROCA")
        pintura = ItemOperationType.objects.get(code="PINTURA")
        funi = LaborCategory.objects.get(code="FUNILARIA")
        pint = LaborCategory.objects.get(code="PINTURA")

        ItemOperation.objects.create(
            item_budget=budget_item,
            operation_type=troca,
            labor_category=funi,
            hours=Decimal("1"),
            hourly_rate=Decimal("40"),
            labor_cost=Decimal("40"),
        )
        ItemOperation.objects.create(
            item_budget=budget_item,
            operation_type=pintura,
            labor_category=pint,
            hours=Decimal("4"),
            hourly_rate=Decimal("50"),
            labor_cost=Decimal("200"),
        )
        assert budget_item.operations.count() == 2


@pytest.mark.django_db
class TestItemOperationForServiceOrder:

    def test_create_for_so_item(self, so_item, troca_funilaria):
        op_type, labor_cat = troca_funilaria
        op = ItemOperation.objects.create(
            item_so=so_item,
            operation_type=op_type,
            labor_category=labor_cat,
            hours=Decimal("1"),
            hourly_rate=Decimal("40"),
            labor_cost=Decimal("40"),
        )
        assert op.item_budget is None
        assert op.item_so == so_item
        assert so_item.operations.count() == 1


@pytest.mark.django_db
class TestXorConstraint:
    """CheckConstraint itemop_xor_parent: exatamente uma das 2 FKs deve estar populada."""

    def test_both_parents_none_raises(self, troca_funilaria, db):
        op_type, labor_cat = troca_funilaria
        with pytest.raises(IntegrityError):
            ItemOperation.objects.create(
                item_budget=None,
                item_so=None,
                operation_type=op_type,
                labor_category=labor_cat,
                hours=Decimal("1"),
                hourly_rate=Decimal("40"),
            )

    def test_both_parents_set_raises(self, budget_item, so_item, troca_funilaria):
        op_type, labor_cat = troca_funilaria
        with pytest.raises(IntegrityError):
            ItemOperation.objects.create(
                item_budget=budget_item,
                item_so=so_item,
                operation_type=op_type,
                labor_category=labor_cat,
                hours=Decimal("1"),
                hourly_rate=Decimal("40"),
            )


@pytest.mark.django_db
class TestProtectOnTypeDelete:
    """on_delete=PROTECT em operation_type e labor_category — não apaga ref em uso."""

    def test_cannot_delete_in_use_operation_type(self, budget_item, troca_funilaria):
        op_type, labor_cat = troca_funilaria
        ItemOperation.objects.create(
            item_budget=budget_item,
            operation_type=op_type,
            labor_category=labor_cat,
            hours=Decimal("1"),
            hourly_rate=Decimal("40"),
        )
        from django.db.models import ProtectedError

        with pytest.raises(ProtectedError):
            op_type.delete()
