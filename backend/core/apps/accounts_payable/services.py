"""
Paddock Solutions — Accounts Payable Service

PayableDocumentService — criacao, baixa e cancelamento de titulos a pagar.
"""
import logging
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import DocumentStatus, PayableDocument, PayableOrigin, PayablePayment, Supplier

logger = logging.getLogger(__name__)


class PayableDocumentService:
    """
    Servico de negocio para Contas a Pagar.

    Centraliza criacao, baixa e cancelamento de titulos a pagar.
    Regras de negocio ficam aqui — nunca nos ViewSets.
    """

    @classmethod
    @transaction.atomic
    def create_payable(
        cls,
        *,
        supplier_id: str,
        description: str,
        amount: Decimal | str,
        due_date: "object",
        competence_date: "object",
        document_number: str = "",
        origin: str = PayableOrigin.MANUAL,
        cost_center_id: str | None = None,
        notes: str = "",
        user: "object",
    ) -> PayableDocument:
        """
        Cria novo titulo a pagar.

        Define status inicial:
          - OVERDUE se due_date < hoje
          - OPEN caso contrario

        Args:
            supplier_id: UUID do fornecedor.
            description: Descricao do titulo.
            amount: Valor total do titulo (deve ser > 0).
            due_date: Data de vencimento.
            competence_date: Data de competencia.
            document_number: Numero do documento (opcional).
            origin: Origem do titulo (MAN, FOLHA, NFE_E, AUTO).
            cost_center_id: UUID do centro de custo (opcional).
            notes: Observacoes (opcional).
            user: Usuario criador.

        Returns:
            PayableDocument criado.

        Raises:
            ValidationError: Se amount <= 0 ou supplier nao encontrado.
        """
        amount_decimal = Decimal(str(amount))
        if amount_decimal <= 0:
            raise ValidationError({"amount": "O valor do titulo deve ser maior que zero."})

        try:
            supplier = Supplier.objects.get(id=supplier_id)
        except Supplier.DoesNotExist:
            raise ValidationError({"supplier_id": f"Fornecedor {supplier_id} nao encontrado."})

        today = timezone.now().date()
        initial_status = (
            DocumentStatus.OVERDUE if due_date < today else DocumentStatus.OPEN
        )

        document = PayableDocument.objects.create(
            supplier=supplier,
            description=description,
            amount=amount_decimal,
            due_date=due_date,
            competence_date=competence_date,
            document_number=document_number,
            origin=origin,
            cost_center_id=cost_center_id,
            notes=notes,
            status=initial_status,
            created_by=user,
        )

        logger.info(
            "PayableDocumentService.create_payable: titulo %s criado para %s — R$%s",
            document.id,
            supplier.name,
            amount_decimal,
        )
        return document

    @classmethod
    @transaction.atomic
    def record_payment(
        cls,
        *,
        document_id: str,
        payment_date: "object",
        amount: Decimal | str,
        payment_method: str = "bank_transfer",
        bank_account: str = "",
        notes: str = "",
        user: "object",
    ) -> PayablePayment:
        """
        Registra baixa de pagamento — parcial ou total.

        Recalcula amount_paid via aggregate para consistencia.
        Atualiza status do titulo apos cada baixa.
        Dispara lancamento contabil automatico via PayableAccountingService.

        Args:
            document_id: UUID do titulo a pagar.
            payment_date: Data do pagamento.
            amount: Valor a pagar (deve ser > 0 e <= amount_remaining).
            payment_method: Forma de pagamento.
            bank_account: Identificacao da conta bancaria (opcional).
            notes: Observacoes (opcional).
            user: Usuario que registrou o pagamento.

        Returns:
            PayablePayment criado.

        Raises:
            ValidationError: Se valor invalido, titulo pago ou cancelado.
        """
        amount_decimal = Decimal(str(amount))
        if amount_decimal <= 0:
            raise ValidationError({"amount": "O valor do pagamento deve ser maior que zero."})

        document = PayableDocument.objects.select_for_update().get(id=document_id)

        if document.status == DocumentStatus.PAID:
            raise ValidationError({"detail": "Titulo ja esta totalmente pago."})
        if document.status == DocumentStatus.CANCELLED:
            raise ValidationError({"detail": "Nao e possivel pagar um titulo cancelado."})

        if amount_decimal > document.amount_remaining:
            raise ValidationError(
                {
                    "amount": (
                        f"Valor do pagamento (R${amount_decimal}) excede o saldo "
                        f"restante (R${document.amount_remaining})."
                    )
                }
            )

        payment = PayablePayment.objects.create(
            document=document,
            payment_date=payment_date,
            amount=amount_decimal,
            payment_method=payment_method,
            bank_account=bank_account,
            notes=notes,
            created_by=user,
        )

        # Recalcular amount_paid via aggregate para consistencia
        total_paid = (
            PayablePayment.objects.filter(
                document=document, is_active=True
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )

        document.amount_paid = total_paid
        new_status = (
            DocumentStatus.PAID
            if total_paid >= document.amount
            else DocumentStatus.PARTIAL
        )
        document.status = new_status
        document.save(update_fields=["amount_paid", "status", "updated_at"])

        # Gerar lancamento contabil automatico
        try:
            from .accounting_service import PayableAccountingService

            entry = PayableAccountingService.post_payment(payment, document, user)
            if entry is not None:
                payment.journal_entry_id = entry.id
                payment.save(update_fields=["journal_entry_id", "updated_at"])
        except Exception as exc:
            logger.warning(
                "PayableDocumentService.record_payment: falha ao gerar lancamento "
                "para payment %s: %s",
                payment.id,
                exc,
            )

        logger.info(
            "PayableDocumentService.record_payment: pagamento %s registrado — "
            "titulo %s status=%s",
            payment.id,
            document.id,
            document.status,
        )
        return payment

    @classmethod
    @transaction.atomic
    def cancel_payable(
        cls,
        *,
        document_id: str,
        reason: str,
        user: "object",
    ) -> PayableDocument:
        """
        Cancela titulo a pagar.

        Nao permite cancelar titulo ja pago ou ja cancelado.

        Args:
            document_id: UUID do titulo a pagar.
            reason: Motivo do cancelamento.
            user: Usuario que cancelou.

        Returns:
            PayableDocument cancelado.

        Raises:
            ValidationError: Se titulo ja pago ou ja cancelado.
        """
        document = PayableDocument.objects.select_for_update().get(id=document_id)

        if document.status == DocumentStatus.PAID:
            raise ValidationError(
                {"detail": "Nao e possivel cancelar um titulo ja pago."}
            )
        if document.status == DocumentStatus.CANCELLED:
            raise ValidationError({"detail": "Titulo ja esta cancelado."})

        document.status = DocumentStatus.CANCELLED
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
            "PayableDocumentService.cancel_payable: titulo %s cancelado por %s",
            document.id,
            getattr(user, "id", user),
        )
        return document

    @classmethod
    def refresh_overdue_status(cls) -> int:
        """
        Atualiza status de titulos em aberto ou parcialmente pagos com vencimento passado.

        Usa queryset.update() para performance — evita carregar cada objeto em memoria.

        Returns:
            Numero de titulos atualizados para OVERDUE.
        """
        today = timezone.now().date()
        count = PayableDocument.objects.filter(
            status__in=[DocumentStatus.OPEN, DocumentStatus.PARTIAL],
            due_date__lt=today,
            is_active=True,
        ).update(status=DocumentStatus.OVERDUE)

        if count:
            logger.info(
                "PayableDocumentService.refresh_overdue_status: %d titulos atualizados "
                "para OVERDUE",
                count,
            )
        return count
