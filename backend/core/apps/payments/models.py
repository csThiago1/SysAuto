from django.db import models

from apps.service_orders.models import ServiceOrder


class Payment(models.Model):
    """Pagamento registrado contra uma OS e bloco financeiro específico."""

    METHOD_CHOICES = [
        ("PIX", "Pix"),
        ("BOLETO", "Boleto"),
        ("DINHEIRO", "Dinheiro"),
        ("CARTAO", "Cartão"),
        ("TRANSFERENCIA", "Transferência"),
    ]

    STATUS_CHOICES = [
        ("pending", "Pendente"),
        ("received", "Recebido"),
        ("refunded", "Estornado"),
    ]

    PAYER_BLOCK_CHOICES = [
        ("SEGURADORA", "Coberto pela Seguradora"),
        ("COMPLEMENTO_PARTICULAR", "Complemento Particular"),
        ("FRANQUIA", "Franquia"),
        ("PARTICULAR", "Particular (OS particular inteira)"),
    ]

    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.PROTECT, related_name="payments",
    )
    payer_block = models.CharField(
        max_length=30, choices=PAYER_BLOCK_CHOICES, db_index=True,
    )

    amount = models.DecimalField(max_digits=14, decimal_places=2)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    reference = models.CharField(max_length=200, blank=True, default="")

    received_at = models.DateTimeField(null=True, blank=True)
    received_by = models.CharField(max_length=120, blank=True, default="")

    # TODO(Ciclo 5): converter em FK real quando app fiscal existir
    fiscal_doc_ref = models.CharField(max_length=60, blank=True, default="")

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True,
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["service_order", "payer_block", "status"],
                name="pay_so_block_status_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.method} R$ {self.amount} — {self.service_order.os_number}"
