"""
Paddock Solutions — Service Orders: Delivery Service
Logica de entrega da OS ao cliente.
"""
import logging
from typing import Any

from django.db import transaction
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)


class ServiceOrderDeliveryService:
    """Logica de entrega da OS ao cliente."""

    @classmethod
    @transaction.atomic
    def deliver(
        cls,
        order: "ServiceOrder",
        data: dict[str, Any],
        delivered_by_id: str,
    ) -> "ServiceOrder":
        """
        Entrega a OS ao cliente.

        Regras:
        - OS deve estar no status 'ready'
        - Cliente particular: NF-e ou NFS-e obrigatoria
        - Cria BudgetSnapshot com trigger='delivery'
        - Cria ActivityLog com tipo 'delivery'
        - Registra mileage_out e notas se fornecidos

        Args:
            order: Instancia da ServiceOrder (deve estar em status 'ready').
            data: Payload validado (mileage_out, notes, nfe_key, nfse_number).
            delivered_by_id: UUID do usuario realizando a entrega.

        Raises:
            ValidationError: Se status invalido ou fiscal obrigatorio ausente.

        Returns:
            ServiceOrder com status 'delivered'.
        """
        from apps.service_orders.models import (
            ServiceOrderActivityLog,
            ActivityType,
        )
        from apps.service_orders.services.order_service import _ServiceOrderCoreMixin
        from django.utils import timezone

        if order.status != "ready":
            raise ValidationError(
                {"detail": f"OS deve estar 'Pronto para Entrega' para ser entregue. Status atual: {order.status}"}
            )

        # Validacao fiscal para clientes particulares
        if order.customer_type == "private":
            nfe_key = data.get("nfe_key") or order.nfe_key
            nfse_number = data.get("nfse_number") or order.nfse_number
            # 06C: aceita tambem FiscalDocument autorizado vinculado a OS
            has_authorized_doc = order.fiscal_documents.filter(
                status="authorized"
            ).exists() if hasattr(order, "fiscal_documents") else False
            if not nfe_key and not nfse_number and not has_authorized_doc:
                raise ValidationError(
                    {"fiscal": "NF-e ou NFS-e obrigatoria para entrega de cliente particular."}
                )

        now = timezone.now()

        # Aplicar campos do payload
        if data.get("mileage_out"):
            order.mileage_out = data["mileage_out"]
        if data.get("notes"):
            order.notes = (order.notes + "\n" + data["notes"]).strip()
        nf_issued_now = False
        if data.get("nfe_key"):
            order.nfe_key = data["nfe_key"]
            if not order.invoice_issued:
                order.invoice_issued = True
                nf_issued_now = True
        if data.get("nfse_number"):
            order.nfse_number = data["nfse_number"]
            if not order.invoice_issued:
                order.invoice_issued = True
                nf_issued_now = True

        # Atualizar status e datas de entrega
        order.status = "delivered"
        if not order.client_delivery_date:
            order.client_delivery_date = now
        if not order.delivered_at:
            order.delivered_at = now

        order.save()

        # Log de nota fiscal emitida na entrega
        if nf_issued_now:
            ServiceOrderActivityLog.objects.create(
                service_order=order,
                user_id=delivered_by_id,
                activity_type="invoice_issued",
                description=f"Nota fiscal registrada na entrega: {order.nfe_key or order.nfse_number}",
            )

        # Snapshot do orcamento final
        # Use the composed ServiceOrderService to access create_budget_snapshot
        from apps.service_orders.services import ServiceOrderService
        ServiceOrderService.create_budget_snapshot(
            order=order,
            trigger="delivery",
            created_by_id=delivered_by_id,
        )

        # Log de atividade
        from apps.authentication.models import GlobalUser
        user = GlobalUser.objects.filter(id=delivered_by_id).first()
        user_name = user.get_full_name() or user.email if user else "Usuario"

        ServiceOrderActivityLog.objects.create(
            service_order=order,
            user_id=delivered_by_id,
            activity_type=ActivityType.DELIVERY,
            description=f"{user_name} realizou a entrega do veiculo ao cliente.",
            metadata={
                "mileage_out": order.mileage_out,
                "invoice_issued": order.invoice_issued,
                "delivered_at": now.isoformat(),
            },
        )

        # Criar titulo a receber automaticamente ao entregar a OS.
        # Savepoint isola a criacao do recebivel: se falhar, apenas reverte
        # esse bloco sem abortar a transacao principal da entrega da OS.
        from django.db import transaction as _tx

        _sp = _tx.savepoint()
        try:
            from apps.accounts_receivable.models import ReceivableOrigin
            from apps.accounts_receivable.services import ReceivableDocumentService

            os_total = order.parts_total + order.services_total
            if os_total > 0:
                ReceivableDocumentService.create_receivable(
                    customer_id=str(order.customer_id) if order.customer_id else str(order.id),
                    customer_name=order.customer_name,
                    description=f"OS #{order.number} -- {order.plate}",
                    amount=os_total,
                    due_date=now.date(),
                    competence_date=now.date(),
                    origin=ReceivableOrigin.OS,
                    service_order_id=str(order.id),
                    user=GlobalUser.objects.filter(id=delivered_by_id).first(),
                )
                _tx.savepoint_commit(_sp)
                logger.info(
                    "OS #%d: ReceivableDocument criado automaticamente (R$%s)",
                    order.number,
                    os_total,
                )
            else:
                _tx.savepoint_commit(_sp)
        except Exception as exc:
            _tx.savepoint_rollback(_sp)
            logger.error(
                "OS #%d: falha ao criar ReceivableDocument na entrega -- %s",
                order.number,
                exc,
            )

        logger.info(
            "OS #%d: entregue ao cliente por user_id=%s",
            order.number,
            delivered_by_id,
        )
        return order
