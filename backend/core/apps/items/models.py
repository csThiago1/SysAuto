from django.db import models


class ItemOperationType(models.Model):
    """Tipo de operação aplicada a um item: TROCA / RECUPERACAO / OVERLAP / PINTURA / R_I / MONTAGEM_DESMONTAGEM / DNC.

    Extensível via admin sem migration.
    """

    code = models.CharField(max_length=40, unique=True, db_index=True)
    label = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "code"]
        verbose_name = "Tipo de Operação"
        verbose_name_plural = "Tipos de Operação"

    def __str__(self) -> str:
        return f"{self.code} — {self.label}"


class LaborCategory(models.Model):
    """Categoria de mão-de-obra: FUNILARIA / PINTURA / MECANICA / ELETRICA / TAPECARIA / ACABAMENTO / VIDRACARIA / REPARACAO / SERVICOS.

    Extensível via admin sem migration.
    """

    code = models.CharField(max_length=40, unique=True, db_index=True)
    label = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "code"]
        verbose_name = "Categoria de MO"
        verbose_name_plural = "Categorias de MO"

    def __str__(self) -> str:
        return f"{self.code} — {self.label}"


class NumberSequence(models.Model):
    """Sequência contínua pra numeração global (OR-NNNNNN, OS-NNNNNN)."""

    SEQ_TYPES = [
        ("BUDGET", "Orçamento Particular"),
        ("SERVICE_ORDER", "Ordem de Serviço"),
    ]
    sequence_type = models.CharField(max_length=20, choices=SEQ_TYPES, unique=True)
    prefix = models.CharField(max_length=10)
    padding = models.IntegerField(default=6)
    next_number = models.IntegerField(default=1)

    class Meta:
        verbose_name = "Sequência de Numeração"
        verbose_name_plural = "Sequências de Numeração"

    def __str__(self) -> str:
        return f"{self.sequence_type} @ {self.next_number}"


class ItemOperation(models.Model):
    """Operação aplicada a um item. Um item pode ter várias (TROCA + PINTURA + OVERLAP).

    FK polimórfica: uma operação pertence a um BudgetVersionItem OU a um ServiceOrderVersionItem,
    nunca aos dois. CheckConstraint garante exclusividade XOR.
    """

    item_budget = models.ForeignKey(
        "budgets.BudgetVersionItem",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="operations",
    )
    item_so = models.ForeignKey(
        "service_orders.ServiceOrderVersionItem",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="operations",
    )

    operation_type = models.ForeignKey(
        ItemOperationType,
        on_delete=models.PROTECT,
        related_name="operations",
    )
    labor_category = models.ForeignKey(
        LaborCategory,
        on_delete=models.PROTECT,
        related_name="operations",
    )

    hours = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    labor_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        verbose_name = "Operação de Item"
        verbose_name_plural = "Operações de Item"
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(item_budget__isnull=False, item_so__isnull=True)
                    | models.Q(item_budget__isnull=True, item_so__isnull=False)
                ),
                name="itemop_xor_parent",
            ),
        ]

    def __str__(self) -> str:
        parent = self.item_budget_id or self.item_so_id
        return f"{self.operation_type_id}/{self.labor_category_id} → item={parent}"
