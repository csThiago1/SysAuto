"""
Paddock Solutions — Items App — Modelos

Tabelas de referência e operações de linha para itens de OS versionada e Orçamentos.

Modelos:
- NumberSequence: sequência contínua para numeração global (ORC-NNNNNN, OS-NNNNNN)
- ItemOperationType: catálogo de tipos de operação (TROCA, RECUPERACAO, etc.)
- LaborCategory: catálogo de categorias de mão de obra (FUNILARIA, PINTURA, etc.)
- ItemOperation: registro de operação aplicada a um item de OS versionada ou Budget

Nota: ItemOperation.item_so_id é um BigIntegerField (não ForeignKey) porque
ServiceOrderVersionItem ainda não existe em service_orders/models.py neste
momento. A coluna `item_so_id` no banco é criada via SeparateDatabaseAndState
na migration 0001_initial como uma FK sem DB constraint, mas o ORM Django
acessa via BigIntegerField para evitar o erro de sistema (fields.E300/E307).
Quando service_orders/0021 criar ServiceOrderVersionItem, uma migration
items/0003 pode promover o campo para ForeignKey real.

ItemOperation.item_budget é uma FK real para budgets.BudgetVersionItem.
O app budgets é registrado em Task 2 — a FK usa string reference lazy.
"""
from __future__ import annotations

from django.db import models


class NumberSequence(models.Model):
    """Sequência contínua para numeração global (ORC-NNNNNN, OS-NNNNNN).

    Seeded by migration 0004 with one row per sequence_type.
    NumberAllocator.allocate() uses SELECT FOR UPDATE for thread safety.
    """

    SEQ_TYPES = [
        ("BUDGET", "Orçamento Particular"),
        ("SERVICE_ORDER", "Ordem de Serviço"),
    ]
    sequence_type = models.CharField(
        max_length=20, choices=SEQ_TYPES, unique=True,
        verbose_name="Tipo de Sequência",
    )
    prefix = models.CharField(max_length=10, verbose_name="Prefixo")
    padding = models.IntegerField(default=6, verbose_name="Padding")
    next_number = models.IntegerField(default=1, verbose_name="Próximo Número")

    class Meta:
        verbose_name = "Sequência de Numeração"
        verbose_name_plural = "Sequências de Numeração"

    def __str__(self) -> str:
        return f"{self.sequence_type} @ {self.next_number}"


class ItemOperationType(models.Model):
    """
    Tipo de operacao aplicavel a um item de OS.

    Catalogo de referencia: TROCA, RECUPERACAO, OVERLAP, PINTURA, R_I,
    MONTAGEM_DESMONTAGEM, DNC.
    Seeded by migration 0002_seed_reference_tables.
    """

    code = models.CharField(
        max_length=40,
        unique=True,
        verbose_name="Codigo",
    )
    label = models.CharField(
        max_length=100,
        verbose_name="Label",
    )
    description = models.TextField(
        blank=True,
        verbose_name="Descricao",
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="Ativo",
    )
    sort_order = models.IntegerField(
        default=0,
        verbose_name="Ordem",
    )

    class Meta:
        verbose_name = "Tipo de Operacao"
        verbose_name_plural = "Tipos de Operacao"
        ordering = ["sort_order", "code"]

    def __str__(self) -> str:
        return f"{self.code} - {self.label}"


class LaborCategory(models.Model):
    """
    Categoria de mao de obra.

    Catalogo de referencia: FUNILARIA, PINTURA, MECANICA, ELETRICA,
    TAPECARIA, ACABAMENTO, VIDRACARIA, REPARACAO, SERVICOS.
    Seeded by migration 0002_seed_reference_tables.
    """

    code = models.CharField(
        max_length=40,
        unique=True,
        verbose_name="Codigo",
    )
    label = models.CharField(
        max_length=100,
        verbose_name="Label",
    )
    description = models.TextField(
        blank=True,
        verbose_name="Descricao",
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="Ativo",
    )
    sort_order = models.IntegerField(
        default=0,
        verbose_name="Ordem",
    )

    class Meta:
        verbose_name = "Categoria de Mao de Obra"
        verbose_name_plural = "Categorias de Mao de Obra"
        ordering = ["sort_order", "code"]

    def __str__(self) -> str:
        return f"{self.code} - {self.label}"


class ItemOperation(models.Model):
    """
    Operacao de mao de obra aplicada a um item de OS versionada ou Budget.

    FK polimórfica: pertence a BudgetVersionItem (item_budget) OU a
    ServiceOrderVersionItem (item_so_id), nunca ambos. XOR garantido
    via CheckConstraint itemop_xor_parent.
    """

    item_so_id = models.BigIntegerField(
        db_index=True,
        null=True,
        blank=True,
        verbose_name="ID do Item de OS",
        help_text="ID de service_orders.ServiceOrderVersionItem (sem FK constraint).",
    )
    item_budget = models.ForeignKey(
        "budgets.BudgetVersionItem",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="operations",
        verbose_name="Item de Orçamento",
    )
    operation_type = models.ForeignKey(
        ItemOperationType,
        on_delete=models.PROTECT,
        related_name="item_operations",
        verbose_name="Tipo de Operacao",
    )
    labor_category = models.ForeignKey(
        LaborCategory,
        on_delete=models.PROTECT,
        related_name="item_operations",
        verbose_name="Categoria de Mao de Obra",
    )
    hours = models.DecimalField(
        max_digits=6, decimal_places=2, verbose_name="Horas",
    )
    hourly_rate = models.DecimalField(
        max_digits=10, decimal_places=2, verbose_name="Valor Hora",
    )
    labor_cost = models.DecimalField(
        max_digits=14, decimal_places=2, verbose_name="Custo Mao de Obra",
        help_text="hours * hourly_rate",
    )

    class Meta:
        verbose_name = "Operacao de Item"
        verbose_name_plural = "Operacoes de Item"
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(item_budget__isnull=False, item_so_id__isnull=True)
                    | models.Q(item_budget__isnull=True, item_so_id__isnull=False)
                ),
                name="itemop_xor_parent",
            ),
        ]


    def __str__(self) -> str:
        parent = self.item_budget_id or self.item_so_id
        return (
            f"{self.operation_type.code} {self.hours}h "
            f"@ {self.hourly_rate}/h = {self.labor_cost} (item={parent})"
        )
