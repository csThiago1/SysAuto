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
        expense_account_id: str | None = None,
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
            expense_account_id=expense_account_id,
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

        # Gera lançamento de reconhecimento de despesa se expense_account informado
        if expense_account_id:
            try:
                from .accounting_service import PayableAccountingService
                PayableAccountingService.post_expense_recognition(document, user)
            except Exception as exc:
                logger.warning(
                    "Erro ao gerar lançamento de despesa para titulo %s: %s",
                    document.id, exc,
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
        # Idempotencia: nao cria lancamento se ja existe para este payment (ex: retry Celery)
        if payment.journal_entry_id:
            logger.info(
                "PayableDocumentService.record_payment: journal_entry ja existe "
                "para payment=%s, pulando",
                payment.id,
            )
        else:
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

        # Estorna lancamentos contabeis das baixas ja realizadas (titulos PARTIAL)
        payments_with_entries = document.payments.filter(
            is_active=True, journal_entry_id__isnull=False
        )
        for payment in payments_with_entries:
            try:
                from apps.accounting.models.journal_entry import JournalEntry
                from apps.accounting.services.journal_entry_service import JournalEntryService

                entry = JournalEntry.objects.get(id=payment.journal_entry_id)
                JournalEntryService.reverse_entry(
                    entry=entry,
                    user=user,
                    description=(
                        f"Estorno automatico — titulo "
                        f"{document.document_number or document.id} cancelado"
                    ),
                )
            except Exception:
                logger.warning(
                    "cancel_payable: falha ao estornar journal_entry=%s para payment=%s",
                    payment.journal_entry_id,
                    payment.id,
                )

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
    @transaction.atomic
    def create_installments(
        cls, base_data: dict, num_parcelas: int, interval_days: int = 30, user: "object" = None
    ) -> list:
        """Cria N titulos a pagar com vencimentos escalonados.

        Divide o valor total em parcelas iguais, ajustando centavos
        na ultima parcela para garantir que a soma bata exatamente.

        Args:
            base_data: Dict com campos de CreatePayableDocumentSerializer.validated_data.
            num_parcelas: Quantidade de parcelas (1-12).
            interval_days: Intervalo em dias entre vencimentos (default 30).
            user: Usuario criador.

        Returns:
            Lista de PayableDocument criados.
        """
        from datetime import timedelta
        from decimal import ROUND_HALF_UP

        total = Decimal(str(base_data["amount"]))
        valor_parcela = (total / num_parcelas).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        valor_ultima = total - (valor_parcela * (num_parcelas - 1))

        parcelas: list = []
        for i in range(num_parcelas):
            data = {**base_data}
            data["amount"] = valor_ultima if i == num_parcelas - 1 else valor_parcela
            data["due_date"] = base_data["due_date"] + timedelta(days=i * interval_days)
            data["description"] = f"{base_data['description']} ({i + 1}/{num_parcelas})"
            doc_number = base_data.get("document_number", "")
            data["document_number"] = f"{doc_number}-{i + 1}" if doc_number else f"P{i + 1}"
            parcelas.append(cls.create_payable(**data, user=user))
        return parcelas

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
