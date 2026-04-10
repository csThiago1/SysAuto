"""
Paddock Solutions — Accounts Receivable Service

ReceivableDocumentService — criacao, baixa e cancelamento de titulos a receber.
"""
import logging
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import ReceivableDocument, ReceivableOrigin, ReceivableReceipt, ReceivableStatus

logger = logging.getLogger(__name__)


class ReceivableDocumentService:
    """
    Servico de negocio para Contas a Receber.

    Centraliza criacao, baixa e cancelamento de titulos a receber.
    Regras de negocio ficam aqui — nunca nos ViewSets.
    """

    @classmethod
    @transaction.atomic
    def create_receivable(
        cls,
        *,
        customer_id: str,
        customer_name: str,
        description: str,
        amount: Decimal | str,
        due_date: "object",
        competence_date: "object",
        origin: str = ReceivableOrigin.MANUAL,
        service_order_id: str | None = None,
        document_number: str = "",
        cost_center_id: str | None = None,
        notes: str = "",
        user: "object",
    ) -> ReceivableDocument:
        """
        Cria novo titulo a receber.

        Define status inicial:
          - OVERDUE se due_date < hoje
          - OPEN caso contrario

        Args:
            customer_id: UUID do cliente (referencia livre — sem FK cross-schema).
            customer_name: Nome desnormalizado do cliente.
            description: Descricao do titulo.
            amount: Valor total do titulo (deve ser > 0).
            due_date: Data de vencimento.
            competence_date: Data de competencia.
            origin: Origem do titulo (MAN, OS, NFE, NFCE, NFSE).
            service_order_id: UUID da OS vinculada (opcional).
            document_number: Numero do documento fiscal (opcional).
            cost_center_id: UUID do centro de custo (opcional).
            notes: Observacoes (opcional).
            user: Usuario criador.

        Returns:
            ReceivableDocument criado.

        Raises:
            ValidationError: Se amount <= 0.
        """
        amount_decimal = Decimal(str(amount))
        if amount_decimal <= 0:
            raise ValidationError({"amount": "O valor do titulo deve ser maior que zero."})

        today = timezone.now().date()
        initial_status = (
            ReceivableStatus.OVERDUE if due_date < today else ReceivableStatus.OPEN
        )

        document = ReceivableDocument.objects.create(
            customer_id=customer_id,
            customer_name=customer_name,
            description=description,
            amount=amount_decimal,
            due_date=due_date,
            competence_date=competence_date,
            origin=origin,
            service_order_id=service_order_id,
            document_number=document_number,
            cost_center_id=cost_center_id,
            notes=notes,
            status=initial_status,
            created_by=user,
        )

        logger.info(
            "ReceivableDocumentService.create_receivable: titulo %s criado para %s — R$%s",
            document.id,
            customer_name,
            amount_decimal,
        )
        return document

    @classmethod
    @transaction.atomic
    def record_receipt(
        cls,
        *,
        document_id: str,
        receipt_date: "object",
        amount: Decimal | str,
        payment_method: str = "pix",
        bank_account: str = "",
        notes: str = "",
        user: "object",
    ) -> ReceivableReceipt:
        """
        Registra baixa de recebimento — parcial ou total.

        Recalcula amount_received via aggregate para consistencia.
        Atualiza status do titulo apos cada baixa.
        Dispara lancamento contabil automatico via ReceivableAccountingService.

        Args:
            document_id: UUID do titulo a receber.
            receipt_date: Data do recebimento.
            amount: Valor a receber (deve ser > 0 e <= amount_remaining).
            payment_method: Forma de pagamento/recebimento.
            bank_account: Identificacao da conta bancaria (opcional).
            notes: Observacoes (opcional).
            user: Usuario que registrou o recebimento.

        Returns:
            ReceivableReceipt criado.

        Raises:
            ValidationError: Se valor invalido, titulo recebido ou cancelado.
        """
        amount_decimal = Decimal(str(amount))
        if amount_decimal <= 0:
            raise ValidationError({"amount": "O valor do recebimento deve ser maior que zero."})

        document = ReceivableDocument.objects.select_for_update().get(id=document_id)

        if document.status == ReceivableStatus.RECEIVED:
            raise ValidationError({"detail": "Titulo ja esta totalmente recebido."})
        if document.status == ReceivableStatus.CANCELLED:
            raise ValidationError(
                {"detail": "Nao e possivel receber um titulo cancelado."}
            )

        if amount_decimal > document.amount_remaining:
            raise ValidationError(
                {
                    "amount": (
                        f"Valor do recebimento (R${amount_decimal}) excede o saldo "
                        f"restante (R${document.amount_remaining})."
                    )
                }
            )

        receipt = ReceivableReceipt.objects.create(
            document=document,
            receipt_date=receipt_date,
            amount=amount_decimal,
            payment_method=payment_method,
            bank_account=bank_account,
            notes=notes,
            created_by=user,
        )

        # Recalcular amount_received via aggregate para consistencia
        total_received = (
            ReceivableReceipt.objects.filter(
                document=document, is_active=True
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )

        document.amount_received = total_received
        new_status = (
            ReceivableStatus.RECEIVED
            if total_received >= document.amount
            else ReceivableStatus.PARTIAL
        )
        document.status = new_status
        document.save(update_fields=["amount_received", "status", "updated_at"])

        # Gerar lancamento contabil automatico
        try:
            from .accounting_service import ReceivableAccountingService

            entry = ReceivableAccountingService.post_receipt(receipt, document, user)
            if entry is not None:
                receipt.journal_entry_id = entry.id
                receipt.save(update_fields=["journal_entry_id", "updated_at"])
        except Exception as exc:
            logger.warning(
                "ReceivableDocumentService.record_receipt: falha ao gerar lancamento "
                "para receipt %s: %s",
                receipt.id,
                exc,
            )

        logger.info(
            "ReceivableDocumentService.record_receipt: recebimento %s registrado — "
            "titulo %s status=%s",
            receipt.id,
            document.id,
            document.status,
        )
        return receipt

    @classmethod
    @transaction.atomic
    def cancel_receivable(
        cls,
        *,
        document_id: str,
        reason: str,
        user: "object",
    ) -> ReceivableDocument:
        """
        Cancela titulo a receber.

        Nao permite cancelar titulo ja recebido ou ja cancelado.

        Args:
            document_id: UUID do titulo a receber.
            reason: Motivo do cancelamento.
            user: Usuario que cancelou.

        Returns:
            ReceivableDocument cancelado.

        Raises:
            ValidationError: Se titulo ja recebido ou ja cancelado.
        """
        document = ReceivableDocument.objects.select_for_update().get(id=document_id)

        if document.status == ReceivableStatus.RECEIVED:
            raise ValidationError(
                {"detail": "Nao e possivel cancelar um titulo ja recebido."}
            )
        if document.status == ReceivableStatus.CANCELLED:
            raise ValidationError({"detail": "Titulo ja esta cancelado."})

        document.status = ReceivableStatus.CANCELLED
        document.cancelled_at = timezone.now()
        document.cancelled_by = user
        document.cancel_reason = reason
        document.save(
            update_fields=[
                "status",
                "cancelled_at",
                "cancelled_by",
                "cancel_reason",
                "updated_at",
            ]
        )

        logger.info(
            "ReceivableDocumentService.cancel_receivable: titulo %s cancelado por %s",
            document.id,
            getattr(user, "id", user),
        )
        return document

    @classmethod
    def refresh_overdue_status(cls) -> int:
        """
        Atualiza status de titulos em aberto ou parcialmente recebidos com vencimento passado.

        Usa queryset.update() para performance — evita carregar cada objeto em memoria.

        Returns:
            Numero de titulos atualizados para OVERDUE.
        """
        today = timezone.now().date()
        count = ReceivableDocument.objects.filter(
            status__in=[ReceivableStatus.OPEN, ReceivableStatus.PARTIAL],
            due_date__lt=today,
            is_active=True,
        ).update(status=ReceivableStatus.OVERDUE)

        if count:
            logger.info(
                "ReceivableDocumentService.refresh_overdue_status: %d titulos atualizados "
                "para OVERDUE",
                count,
            )
        return count
