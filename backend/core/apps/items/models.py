"""
Paddock Solutions — Items App — Modelos

Tabelas de referência e operações de linha para itens de OS versionada.

Modelos:
- ItemOperationType: catálogo de tipos de operação (TROCA, RECUPERACAO, etc.)
- LaborCategory: catálogo de categorias de mão de obra (FUNILARIA, PINTURA, etc.)
- ItemOperation: registro de operação aplicada a um item de OS versionada

Nota: ItemOperation.item_so_id é um BigIntegerField (não ForeignKey) porque
ServiceOrderVersionItem ainda não existe em service_orders/models.py neste
momento. A coluna `item_so_id` no banco é criada via SeparateDatabaseAndState
na migration 0001_initial como uma FK sem DB constraint, mas o ORM Django
acessa via BigIntegerField para evitar o erro de sistema (fields.E300/E307).
Quando service_orders/0021 criar ServiceOrderVersionItem, uma migration
items/0003 pode promover o campo para ForeignKey real.
"""
from __future__ import annotations

from django.db import models


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
    Operacao de mao de obra aplicada a um item de OS versionada.

    Registra o tipo de operacao, categoria de mao de obra, horas trabalhadas
    e o custo resultante para fins de auditoria e calculo.

    item_so_id: ID logico do ServiceOrderVersionItem. Armazenado como
    BigIntegerField porque ServiceOrderVersionItem ainda nao existe no
    app service_orders neste momento. A coluna no banco e criada como FK
    sem db_constraint via SeparateDatabaseAndState em 0001_initial.
    O related_name="operations" sera acessivel via reverse manager apos
    service_orders/0021 criar ServiceOrderVersionItem.
    """

    # FK logica — sem ForeignKey real para evitar erro de sistema Django
    # (ServiceOrderVersionItem ainda nao existe em service_orders/models.py)
    item_so_id = models.BigIntegerField(
        db_index=True,
        verbose_name="ID do Item de OS",
        help_text="ID de service_orders.ServiceOrderVersionItem (sem FK constraint).",
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
        max_digits=6,
        decimal_places=2,
        verbose_name="Horas",
    )
    hourly_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Valor Hora",
    )
    labor_cost = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        verbose_name="Custo Mao de Obra",
        help_text="hours * hourly_rate",
    )

    class Meta:
        verbose_name = "Operacao de Item"
        verbose_name_plural = "Operacoes de Item"
        ordering = ["id"]

    def __str__(self) -> str:
        return (
            f"{self.operation_type.code} {self.hours}h "
            f"@ {self.hourly_rate}/h = {self.labor_cost}"
        )
