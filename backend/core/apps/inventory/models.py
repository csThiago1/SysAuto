"""
Paddock Solutions — Inventory App
InventoryItem com constraint de estoque não-negativo.
MO-5: modelos de estoque físico em models_physical.py + etiquetagem em models_label.py
"""
import uuid

from django.db import models

from apps.authentication.models import PaddockBaseModel


class Product(PaddockBaseModel):
    """
    Produto do catálogo — reside no schema do tenant.
    """

    sku = models.CharField(max_length=100, unique=True, db_index=True)
    name = models.CharField(max_length=300)
    description = models.TextField(blank=True, default="")
    unit = models.CharField(max_length=20, default="un")
    category = models.CharField(max_length=100, blank=True, default="")
    brand = models.CharField(max_length=100, blank=True, default="")

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_product"
        verbose_name = "Produto"
        verbose_name_plural = "Produtos"

    def __str__(self) -> str:
        return f"[{self.sku}] {self.name}"


class InsufficientStockError(Exception):
    """Raised quando não há estoque suficiente para a operação."""

    pass


class InventoryItem(PaddockBaseModel):
    """
    Item de estoque — reside no schema do tenant.

    Estoque NUNCA pode ser negativo:
    - Constraint em banco: CHECK (quantity >= 0)
    - No código: select_for_update() + verificação antes de debitar
    """

    product = models.OneToOneField(
        Product, on_delete=models.CASCADE, related_name="inventory"
    )
    quantity = models.DecimalField(max_digits=15, decimal_places=4, default=0)
    min_quantity = models.DecimalField(
        max_digits=15, decimal_places=4, default=0, verbose_name="Estoque mínimo"
    )
    cost_price = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    sale_price = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    location = models.CharField(max_length=50, blank=True, default="", verbose_name="Localização")

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_item"
        verbose_name = "Item de Estoque"
        verbose_name_plural = "Itens de Estoque"
        # Constraint: estoque nunca negativo
        constraints = [
            models.CheckConstraint(
                check=models.Q(quantity__gte=0),
                name="inventory_item_quantity_non_negative",
            )
        ]

    def __str__(self) -> str:
        return f"{self.product.sku} — {self.quantity} {self.product.unit}"

    @property
    def is_low_stock(self) -> bool:
        """Retorna True se estoque abaixo do mínimo."""
        return self.quantity <= self.min_quantity


# Re-exporta modelos de estoque físico e etiquetagem para que o Django os descubra
from apps.inventory.models_physical import (  # noqa: E402, F401
    ConsumoInsumo,
    LoteInsumo,
    UnidadeFisica,
)
from apps.inventory.models_label import (  # noqa: E402, F401
    EtiquetaImpressa,
    ImpressoraEtiqueta,
)
from apps.inventory.models_location import (  # noqa: E402, F401
    Armazem,
    Nivel,
    Prateleira,
    Rua,
)
from apps.inventory.models_product import (  # noqa: E402, F401
    CategoriaInsumo,
    CategoriaProduto,
    LadoPeca,
    PosicaoVeiculo,
    ProdutoComercialInsumo,
    ProdutoComercialPeca,
    TipoPeca,
)


class StockMovement(models.Model):
    """
    Log imutável de movimentações de estoque — auditoria.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class MovementType(models.TextChoices):
        ENTRY = "entry", "Entrada"
        EXIT = "exit", "Saída"
        TRANSFER_OUT = "transfer_out", "Transferência saída"
        TRANSFER_IN = "transfer_in", "Transferência entrada"
        ADJUSTMENT = "adjustment", "Ajuste"

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="movements")
    type = models.CharField(max_length=20, choices=MovementType.choices)
    quantity = models.DecimalField(max_digits=15, decimal_places=4)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    reference_id = models.UUIDField(null=True, blank=True)  # OS, venda, etc.
    reference_type = models.CharField(max_length=50, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    created_by_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inventory_movement"
        ordering = ["-created_at"]
        verbose_name = "Movimentação de Estoque"
        verbose_name_plural = "Movimentações de Estoque"
