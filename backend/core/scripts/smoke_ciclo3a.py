"""Smoke E2E do Ciclo 03A — API REST.

Exercita endpoints via APIClient:
- Criar Budget via POST
- Adicionar items (com operations)
- Enviar ao cliente (send)
- Gerar PDF
- Aprovar → cria OS
- Mover OS no Kanban
- Registrar pagamento
- Listar eventos timeline
- Verificar OpenAPI schema

Uso: python manage.py shell < scripts/smoke_ciclo3a.py
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.persons.models import Person


def check(cond, msg):
    print(f"[{'OK' if cond else 'FAIL'}] {msg}")
    assert cond, msg


User = get_user_model()


def main():
    print("=== Smoke E2E Ciclo 03A ===\n")

    user, _ = User.objects.get_or_create(username="smoke-c3a", defaults={"is_staff": True})
    user.set_password("s")
    user.save()
    client = APIClient()
    client.force_authenticate(user=user)

    person, _ = Person.objects.get_or_create(
        full_name="Smoke C3A", defaults={"person_type": "CLIENT"},
    )

    # 1) Criar budget
    resp = client.post(
        "/api/v1/budgets/",
        {
            "customer_id": person.pk,
            "vehicle_plate": "SMK1",
            "vehicle_description": "Honda",
        },
        format="json",
    )
    check(resp.status_code == 201, f"Create budget: {resp.status_code}")
    budget_id = resp.json()["id"]
    version_id = resp.json()["active_version"]["id"]

    # 2) Adicionar item (com operations)
    resp = client.post(
        f"/api/v1/budgets/{budget_id}/versions/{version_id}/items/",
        {
            "description": "AMORTECEDOR",
            "quantity": "1",
            "unit_price": "500",
            "net_price": "500",
            "item_type": "PART",
            "operations": [
                {
                    "operation_type_code": "TROCA",
                    "labor_category_code": "FUNILARIA",
                    "hours": "1",
                    "hourly_rate": "40",
                }
            ],
        },
        format="json",
    )
    check(resp.status_code == 201, f"Add item: {resp.status_code}")

    # 3) Enviar ao cliente (send)
    resp = client.post(f"/api/v1/budgets/{budget_id}/versions/{version_id}/send/")
    check(resp.status_code == 200 and resp.json()["status"] == "sent", "Send version")

    # 4) Gerar PDF
    resp = client.get(f"/api/v1/budgets/{budget_id}/versions/{version_id}/pdf/")
    check(resp.status_code == 200 and len(resp.content) > 100, "PDF download")

    # 5) Aprovar → cria OS particular
    resp = client.post(
        f"/api/v1/budgets/{budget_id}/versions/{version_id}/approve/",
        {"approved_by": "cliente", "evidence_s3_key": ""},
        format="json",
    )
    check(resp.status_code == 200, "Approve budget")
    os_id = resp.json()["service_order"]["id"]
    check(resp.json()["service_order"]["customer_type"] == "PARTICULAR", "OS customer_type=PARTICULAR")

    # 6) Mover OS no Kanban (change-status)
    resp = client.post(
        f"/api/v1/service-orders/{os_id}/change-status/",
        {"new_status": "initial_survey"},
        format="json",
    )
    check(resp.status_code == 200, "Change status")

    # 7) Registrar pagamento
    resp = client.post(
        f"/api/v1/service-orders/{os_id}/payments/",
        {"payer_block": "PARTICULAR", "amount": "500", "method": "PIX"},
        format="json",
    )
    check(resp.status_code == 201, "Record payment")

    # 8) Listar eventos timeline (>=3 eventos)
    resp = client.get(f"/api/v1/service-orders/{os_id}/events/")
    check(resp.status_code == 200 and resp.json()["count"] >= 3, "Events timeline (>=3)")

    # 9) Verificar OpenAPI schema acessível
    resp = client.get("/api/v1/schema/")
    check(resp.status_code == 200, "OpenAPI schema accessible")

    print("\n[DONE] Smoke E2E Ciclo 03A OK")


main()
