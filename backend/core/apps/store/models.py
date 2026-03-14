"""
Paddock Solutions — Store App
Sale, CartItem — PDV 100% digital
"""
import uuid

from django.db import models

from apps.authentication.models import PaddockBaseModel


class Sale(PaddockBaseModel):
    """
    Venda — PDV do tenant.
    Fluxo: carrinho → cliente (opt) → desconto → pagamento → NFC-e → WhatsApp.
    Hard delete proibido — evidência fiscal.
    """

    class PaymentMethod(models.TextChoices):
        CASH = "cash", "Dinheiro"
        CREDIT = "credit", "Cartão de Crédito"
        DEBIT = "debit", "Cartão de Débito"
        PIX = "pix", "PIX"
        TRANSFER = "transfer", "Transferência"

    class SaleStatus(models.TextChoices):
        PENDING = "pending", "Pendente"
        COMPLETED = "completed", "Concluída"
        CANCELLED = "cancelled", "Cancelada"

    number = models.PositiveIntegerField(db_index=True, auto_created=True)
    customer_id = models.UUIDField(null=True, blank=True, db_index=True)
    customer_name = models.CharField(max_length=200, blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=SaleStatus.choices,
        default=SaleStatus.PENDING,
        db_index=True,
    )
    payment_method = models.CharField(
        max_length=20, choices=PaymentMethod.choices, blank=True, default=""
    )
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # Fiscal
    nfce_key = models.CharField(max_length=44, blank=True, default="")
    nfce_xml_s3_key = models.CharField(max_length=500, blank=True, default="")
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta(PaddockBaseModel.Meta):
        db_table = "store_sale"
        verbose_name = "Venda"
        verbose_name_plural = "Vendas"

    def __str__(self) -> str:
        return f"Venda #{self.number} — R$ {self.total}"


class CartItem(models.Model):
    """Item do carrinho (linha de venda)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items")
    product_id = models.UUIDField()
    sku = models.CharField(max_length=100)
    name = models.CharField(max_length=300)
    quantity = models.DecimalField(max_digits=10, decimal_places=4)
    unit_price = models.DecimalField(max_digits=12, decimal_places=4)
    discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    discount_reason = models.CharField(
        max_length=30,
        choices=[
            ("group_loyalty", "Fidelidade grupo"),
            ("promotion", "Promoção"),
            ("manual", "Manual"),
        ],
        blank=True,
        default="",
    )
    total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = "store_cart_item"
