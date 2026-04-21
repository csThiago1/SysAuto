"""Smoke test do Ciclo 01 — Foundation.

Valida que:
- Tabelas de referência foram seedadas
- NumberAllocator funciona
- É possível criar Budget + BudgetVersion + BudgetVersionItem + ItemOperation
- É possível criar ServiceOrder + ServiceOrderVersion + ItemOperation
- ServiceOrderEvent funciona

Uso: cd backend/core && python manage.py shell < scripts/smoke_foundation.py
"""
from decimal import Decimal

from apps.authz.models import Permission, Role
from apps.budgets.models import Budget, BudgetVersion, BudgetVersionItem
from apps.items.models import (
    ItemOperation, ItemOperationType, LaborCategory, NumberSequence,
)
from apps.items.services import NumberAllocator
from apps.persons.models import Person
from apps.service_orders.models import (
    Insurer, ServiceOrder, ServiceOrderEvent,
    ServiceOrderVersion, ServiceOrderVersionItem,
)


def check(cond: bool, msg: str) -> None:
    status = "✅" if cond else "❌"
    print(f"{status} {msg}")
    assert cond, msg


def main() -> None:
    print("=== Smoke Test Ciclo 01 — Foundation ===\n")

    # Seeds
    check(ItemOperationType.objects.count() >= 7, "ItemOperationType seed (>=7)")
    check(LaborCategory.objects.count() >= 9, "LaborCategory seed (>=9)")
    check(Role.objects.count() >= 6, "Role seed (>=6)")
    check(Permission.objects.count() >= 18, "Permission seed (>=18)")
    check(NumberSequence.objects.count() == 2, "NumberSequence seed (2)")
    check(Insurer.objects.count() >= 10, "Insurer seed (>=10)")

    # Number allocator
    n1 = NumberAllocator.allocate("BUDGET")
    n2 = NumberAllocator.allocate("BUDGET")
    check(n1.startswith("OR-") and n2.startswith("OR-"), f"Alloc BUDGET: {n1}, {n2}")

    # Budget completo (particular)
    person, _ = Person.objects.get_or_create(
        full_name="Smoke Test", defaults={"person_type": "CLIENT"},
    )
    b = Budget.objects.create(
        number=NumberAllocator.allocate("BUDGET"),
        customer=person, vehicle_plate="SMK1234", vehicle_description="Smoke",
    )
    v = BudgetVersion.objects.create(budget=b, version_number=1)
    i = BudgetVersionItem.objects.create(
        version=v, description="AMORTECEDOR TESTE",
        quantity=Decimal("1"), unit_price=Decimal("500"), net_price=Decimal("500"),
    )
    ItemOperation.objects.create(
        item_budget=i,
        operation_type=ItemOperationType.objects.get(code="TROCA"),
        labor_category=LaborCategory.objects.get(code="FUNILARIA"),
        hours=Decimal("1.00"), hourly_rate=Decimal("40"),
        labor_cost=Decimal("40"),
    )
    check(b.active_version.items.count() == 1, "Budget com 1 item")
    check(i.operations.count() == 1, "Item com 1 operation")

    # ServiceOrder seguradora
    yelum = Insurer.objects.get(code="yelum")
    os_instance = ServiceOrder.objects.create(
        os_number=NumberAllocator.allocate("SERVICE_ORDER"),
        customer=person, customer_type="SEGURADORA",
        vehicle_plate="SEG1234", vehicle_description="Seg",
        insurer=yelum, casualty_number="SMK-99999",
        external_budget_number="999999",
    )
    sv = ServiceOrderVersion.objects.create(
        service_order=os_instance, version_number=1, source="cilia",
        external_version="999999.1", status="autorizado",
    )
    svi = ServiceOrderVersionItem.objects.create(
        version=sv, description="PARA-CHOQUE SMK",
        payer_block="SEGURADORA", quantity=Decimal("1"),
        unit_price=Decimal("2000"), net_price=Decimal("2000"),
    )
    ItemOperation.objects.create(
        item_so=svi,
        operation_type=ItemOperationType.objects.get(code="TROCA"),
        labor_category=LaborCategory.objects.get(code="FUNILARIA"),
        hours=Decimal("1"), hourly_rate=Decimal("57"),
        labor_cost=Decimal("57"),
    )
    check(os_instance.active_version.items.count() == 1, "OS seguradora com 1 item")
    check(svi.operations.count() == 1, "Item OS com 1 operation")

    # Event
    ServiceOrderEvent.objects.create(
        service_order=os_instance, event_type="VERSION_CREATED", actor="smoke",
        payload={"version": 1},
    )
    check(os_instance.events.count() == 1, "OS event criado")

    # Cleanup
    os_instance.delete()
    b.delete()
    print("\n✅ Smoke test OK — Foundation ready.")


main()
