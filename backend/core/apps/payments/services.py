"""PaymentService: registro atômico de pagamentos com auditoria."""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.service_orders.events import OSEventLogger
from apps.service_orders.models import ServiceOrder

from .models import Payment


class PaymentService:
    """Regras de negócio de pagamentos — nunca mutante direto do model."""

    @classmethod
    @transaction.atomic
    def record(
        cls,
        *,
        service_order: ServiceOrder,
        payer_block: str,
        amount: Decimal,
        method: str,
        reference: str = "",
        received_by: str = "",
    ) -> Payment:
        """Registra pagamento recebido + evento de auditoria PAYMENT_RECORDED.

        Args:
            service_order: OS à qual o pagamento se refere.
            payer_block: bloco financeiro (SEGURADORA, PARTICULAR, FRANQUIA, COMPLEMENTO_PARTICULAR).
            amount: valor recebido.
            method: método de pagamento (PIX, BOLETO, DINHEIRO, CARTAO, TRANSFERENCIA).
            reference: texto livre (txid PIX, nº boleto, etc.).
            received_by: nome do operador para auditoria.

        Returns:
            Payment criado com status='received' e received_at preenchido.
        """
        payment = Payment.objects.create(
            service_order=service_order,
            payer_block=payer_block,
            amount=amount,
            method=method,
            reference=reference,
            received_by=received_by,
            received_at=timezone.now(),
            status="received",
        )

        OSEventLogger.log_event(
            service_order,
            "PAYMENT_RECORDED",
            actor=received_by or "Sistema",
            payload={
                "amount": str(amount),
                "method": method,
                "block": payer_block,
                "payment_id": payment.pk,
            },
            swallow_errors=True,
        )

        return payment
