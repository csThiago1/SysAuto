"""Smoke test integration do Ciclo 02 — Core Services.

Exercita:
- BudgetService (create + send + approve → cria OS)
- ServiceOrderService (change_status + trava delivery)
- ComplementoParticularService
- PaymentService
- OSEventLogger (timeline consistente)

Uso: python manage.py shell < scripts/smoke_ciclo2.py
"""
from decimal import Decimal

from apps.budgets.models import BudgetVersionItem
from apps.budgets.services import BudgetService
from apps.items.models import ItemOperation, ItemOperationType, LaborCategory
from apps.payments.services import PaymentService
from apps.persons.models import Person
from apps.service_orders.models import Insurer, ServiceOrder, ServiceOrderVersion
from apps.service_orders.services import ComplementoParticularService, ServiceOrderService


def check(cond: bool, msg: str) -> None:
    status = "OK" if cond else "FAIL"
    print(f"[{status}] {msg}")
    assert cond, msg


def main() -> None:
    print("=== Smoke Ciclo 02 ===\n")

    person, _ = Person.objects.get_or_create(
        full_name="Smoke C2", defaults={"person_type": "CLIENT"},
    )

    # 1) Budget particular completo
    budget = BudgetService.create(
        customer=person, vehicle_plate="SMC1234",
        vehicle_description="Honda Fit C2", created_by="smoke",
    )
    v = budget.active_version
    item = BudgetVersionItem.objects.create(
        version=v, description="TESTE",
        quantity=Decimal("1"), unit_price=Decimal("1000"),
        net_price=Decimal("1000"), item_type="PART",
    )
    ItemOperation.objects.create(
        item_budget=item,
        operation_type=ItemOperationType.objects.get(code="TROCA"),
        labor_category=LaborCategory.objects.get(code="FUNILARIA"),
        hours=Decimal("2"), hourly_rate=Decimal("40"), labor_cost=Decimal("80"),
    )
    BudgetService.send_to_customer(version=v, sent_by="smoke")
    v.refresh_from_db()
    check(v.net_total == Decimal("1080"), f"Budget net_total={v.net_total}")

    # 2) Approve → OS particular criada
    os_instance = BudgetService.approve(
        version=v, approved_by="smoke", evidence_s3_key="whatsapp://ok",
    )
    check(os_instance.customer_type == "PARTICULAR", "OS particular criada")
    check(os_instance.source_budget == budget, "OS amarrada ao budget")
    check(os_instance.active_version.items.count() == 1, "Items copiados")

    # 3) Transição Kanban
    ServiceOrderService.change_status(
        service_order=os_instance, new_status="initial_survey", changed_by="smoke",
    )
    check(os_instance.events.filter(event_type="STATUS_CHANGE").count() == 1, "Evento STATUS_CHANGE")

    # 4) OS Seguradora com complemento
    yelum = Insurer.objects.get(code="yelum")
    os_seg = ServiceOrder.objects.create(
        os_number="SMOKE-SEG-1", customer=person, customer_type="SEGURADORA",
        insurer=yelum, casualty_number="SMOKE-CPL-1",
        vehicle_plate="SEG1234", vehicle_description="x", status="repair",
    )
    ServiceOrderVersion.objects.create(
        service_order=os_seg, version_number=1, source="cilia",
        external_version="111.1", status="autorizado",
        net_total=Decimal("2000"),
    )

    new_v = ComplementoParticularService.add_complement(
        service_order=os_seg,
        items_data=[{
            "description": "EXTRA",
            "quantity": Decimal("1"), "unit_price": Decimal("200"),
            "net_price": Decimal("200"), "item_type": "SERVICE",
        }],
        approved_by="smoke",
    )
    check(new_v.version_number == 2, "Complemento cria v2")
    check(new_v.total_complemento_particular == Decimal("200"), "Total complemento correto")

    # 5) Payment
    p = PaymentService.record(
        service_order=os_seg, payer_block="COMPLEMENTO_PARTICULAR",
        amount=Decimal("200"), method="PIX",
        reference="pix-smoke", received_by="smoke",
    )
    check(p.status == "received", "Payment received")
    check(os_seg.events.filter(event_type="PAYMENT_RECORDED").count() == 1, "Payment event")

    # Cleanup
    os_instance.delete()
    os_seg.delete()
    budget.delete()
    print("\n[DONE] Ciclo 02 smoke OK")


main()
