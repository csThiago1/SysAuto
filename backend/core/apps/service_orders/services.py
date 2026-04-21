from django.db import transaction
from rest_framework.exceptions import ValidationError

from .kanban import VALID_TRANSITIONS
from .models import ServiceOrder, ServiceOrderStatusHistory


class ServiceOrderService:
    @classmethod
    @transaction.atomic
    def change_status(
        cls,
        *,
        service_order: ServiceOrder,
        new_status: str,
        changed_by: str = "Sistema",
        notes: str = "",
    ) -> ServiceOrder:
        current_status = service_order.status
        allowed_statuses = VALID_TRANSITIONS.get(current_status, [])

        if new_status not in allowed_statuses:
            raise ValidationError(
                {
                    "status": (
                        f"Transição inválida: {current_status} -> {new_status}. "
                        f"Permitidos: {allowed_statuses}"
                    )
                }
            )

        service_order.status = new_status
        service_order.save(update_fields=["status", "updated_at"])

        ServiceOrderStatusHistory.objects.create(
            service_order=service_order,
            from_status=current_status,
            to_status=new_status,
            changed_by=changed_by,
            notes=notes,
        )
        return service_order
