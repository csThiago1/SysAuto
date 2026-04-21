from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.items.models import ItemOperation
from apps.items.services import NumberAllocator

from .events import OSEventLogger
from .kanban import STATES_WITH_BUDGET_REENTRY, VALID_TRANSITIONS
from .models import ServiceOrder, ServiceOrderVersion, ServiceOrderVersionItem


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
        is_auto: bool = False,
    ) -> ServiceOrder:
        """Valida transição, muda status, loga evento, aplica travas.

        Args:
            service_order: OS a ser alterada.
            new_status: próximo status. Validado contra VALID_TRANSITIONS.
            changed_by: identificação do agente (username ou "Sistema").
            notes: observação livre para a timeline.
            is_auto: se True, evento é "AUTO_TRANSITION"; se False, "STATUS_CHANGE".

        Raises:
            ValidationError: se transição inválida ou trava de delivery ativada.
        """
        current = service_order.status
        allowed = VALID_TRANSITIONS.get(current, [])
        if new_status not in allowed:
            raise ValidationError({
                "status": f"Transição inválida: {current} → {new_status}. Permitidos: {allowed}",
            })

        # Trava: delivery exige NFS-e (particular) ou versão autorizada (seguradora)
        if new_status == "delivered":
            ok, reason = cls._can_deliver(service_order)
            if not ok:
                raise ValidationError({"delivery": reason})

        # Ao entrar em 'budget' a partir de estado de reparo, salva previous_status
        # pra poder retomar depois que a versão for aprovada
        if new_status == "budget" and current in STATES_WITH_BUDGET_REENTRY:
            service_order.previous_status = current

        service_order.status = new_status
        service_order.save(update_fields=["status", "previous_status", "updated_at"])

        OSEventLogger.log_event(
            service_order,
            "AUTO_TRANSITION" if is_auto else "STATUS_CHANGE",
            actor=changed_by,
            from_state=current,
            to_state=new_status,
            payload={"notes": notes} if notes else {},
        )
        return service_order

    @classmethod
    def _can_deliver(cls, os: ServiceOrder) -> tuple[bool, str]:
        """Aplica trava antes de ready → delivered.

        - PARTICULAR: precisa ter pelo menos um Payment com fiscal_doc_ref preenchido
          (stub de NFS-e emitida; Ciclo 5 substitui por FK real em fiscal.FiscalDocument).
        - SEGURADORA: versão ativa deve estar em status "autorizado".
        """
        if os.customer_type == "PARTICULAR":
            from apps.payments.models import Payment

            has_nfse = Payment.objects.filter(
                service_order=os,
                payer_block="PARTICULAR",
                fiscal_doc_ref__gt="",
            ).exists()
            if not has_nfse:
                return False, "NFS-e pendente — emitir antes da entrega"
        else:  # SEGURADORA
            active = os.active_version
            if not active or active.status != "autorizado":
                label = active.external_version if active else "?"
                return False, f"Versão {label} não autorizada"
        return True, ""
