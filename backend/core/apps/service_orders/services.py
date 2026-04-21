from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.items.models import ItemOperation
from apps.items.services import NumberAllocator

from .events import OSEventLogger
from .kanban import VALID_TRANSITIONS
from .models import ServiceOrder, ServiceOrderStatusHistory, ServiceOrderVersion, ServiceOrderVersionItem


class ServiceOrderService:
    @classmethod
    @transaction.atomic
    def create_from_budget(cls, *, version) -> ServiceOrder:
        """Budget aprovada vira OS particular v1 com items copiados.

        Args:
            version: BudgetVersion com status='approved'.

        Returns:
            ServiceOrder recém-criada em status 'reception', vinculada ao Budget.
        """
        budget = version.budget
        os = ServiceOrder.objects.create(
            os_number=NumberAllocator.allocate("SERVICE_ORDER"),
            customer=budget.customer,
            customer_type="PARTICULAR",
            vehicle_plate=budget.vehicle_plate,
            vehicle_description=budget.vehicle_description,
            source_budget=budget,
            status="reception",
        )
        os_v = ServiceOrderVersion.objects.create(
            service_order=os,
            version_number=1,
            source="budget_approval",
            status="approved",
            subtotal=version.subtotal,
            discount_total=version.discount_total,
            net_total=version.net_total,
            labor_total=version.labor_total,
            parts_total=version.parts_total,
        )
        cls._copy_items_from_budget(source_version=version, target_version=os_v)

        OSEventLogger.log_event(
            os,
            "BUDGET_LINKED",
            payload={
                "budget_number": budget.number,
                "budget_version": version.version_number,
            },
        )
        OSEventLogger.log_event(
            os,
            "VERSION_CREATED",
            payload={"version_number": 1, "source": "budget_approval"},
        )
        return os

    @classmethod
    def _copy_items_from_budget(cls, *, source_version, target_version) -> None:
        """Copia BudgetVersionItem → ServiceOrderVersionItem preservando operations + payer_block.

        OS particular sempre usa payer_block='PARTICULAR'. Qualquer outro
        payer_block vindo do budget é normalizado na cópia.
        """
        shared_fields = [
            "bucket", "payer_block", "impact_area", "item_type",
            "description", "external_code", "part_type", "supplier",
            "quantity", "unit_price", "unit_cost", "discount_pct", "net_price",
            "flag_abaixo_padrao", "flag_acima_padrao", "flag_inclusao_manual",
            "flag_codigo_diferente", "flag_servico_manual", "flag_peca_da_conta",
            "sort_order",
        ]
        for item in source_version.items.all().prefetch_related("operations"):
            new_item = ServiceOrderVersionItem.objects.create(
                version=target_version,
                **{f: getattr(item, f) for f in shared_fields},
            )
            # OS particular usa payer_block="PARTICULAR"
            if new_item.payer_block != "PARTICULAR":
                new_item.payer_block = "PARTICULAR"
                new_item.save(update_fields=["payer_block"])

            for op in item.operations.all():
                ItemOperation.objects.create(
                    item_so=new_item,
                    operation_type=op.operation_type,
                    labor_category=op.labor_category,
                    hours=op.hours,
                    hourly_rate=op.hourly_rate,
                    labor_cost=op.labor_cost,
                )

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
