"""
Paddock Solutions — Inventory — Contagem de Inventário
Suporte a contagem cíclica (por rua) e total (por armazém).
Ao finalizar, gera MovimentacaoEstoque(AJUSTE_INVENTARIO) para divergências.
"""
from decimal import Decimal

from django.db import models

from apps.authentication.models import PaddockBaseModel


class ContagemInventario(PaddockBaseModel):
    """Sessão de contagem de inventário — cíclica ou total."""

    class Tipo(models.TextChoices):
        CICLICA = "ciclica", "Cíclica"
        TOTAL = "total", "Total"

    class Status(models.TextChoices):
        ABERTA = "aberta", "Aberta"
        EM_ANDAMENTO = "em_andamento", "Em Andamento"
        FINALIZADA = "finalizada", "Finalizada"
        CANCELADA = "cancelada", "Cancelada"

    tipo = models.CharField(max_length=15, choices=Tipo.choices)
    status = models.CharField(
        max_length=15,
        choices=Status.choices,
        default=Status.ABERTA,
    )
    armazem = models.ForeignKey(
        "inventory.Armazem",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="contagens",
        help_text="Contagem total = armazém inteiro.",
    )
    rua = models.ForeignKey(
        "inventory.Rua",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="contagens",
        help_text="Contagem cíclica = por rua.",
    )
    data_abertura = models.DateTimeField(auto_now_add=True)
    data_fechamento = models.DateTimeField(null=True, blank=True)
    iniciado_por = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.PROTECT,
        related_name="contagens_iniciadas",
    )
    fechado_por = models.ForeignKey(
        "authentication.GlobalUser",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="contagens_fechadas",
    )
    observacoes = models.TextField(blank=True, default="")

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_contagem_inventario"
        verbose_name = "Contagem de Inventário"
        verbose_name_plural = "Contagens de Inventário"
        ordering = ["-data_abertura"]

    def __str__(self) -> str:
        scope = self.armazem or self.rua or "?"
        return f"Contagem {self.tipo} — {scope} ({self.status})"


class ItemContagem(PaddockBaseModel):
    """Item individual numa sessão de contagem."""

    contagem = models.ForeignKey(
        ContagemInventario,
        on_delete=models.CASCADE,
        related_name="itens",
    )
    nivel = models.ForeignKey(
        "inventory.Nivel",
        on_delete=models.CASCADE,
        related_name="itens_contagem",
    )
    # XOR: peça OU insumo
    unidade_fisica = models.ForeignKey(
        "inventory.UnidadeFisica",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="itens_contagem",
    )
    lote_insumo = models.ForeignKey(
        "inventory.LoteInsumo",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="itens_contagem",
    )
    quantidade_sistema = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        help_text="Quantidade que o sistema registra.",
    )
    quantidade_contada = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        null=True,
        blank=True,
        help_text="Quantidade contada pelo operador.",
    )
    divergencia = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=Decimal("0"),
        help_text="contada - sistema. Computado no save().",
    )
    contado_por = models.ForeignKey(
        "authentication.GlobalUser",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="itens_contados",
    )
    observacao = models.CharField(max_length=200, blank=True, default="")

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_item_contagem"
        verbose_name = "Item de Contagem"
        verbose_name_plural = "Itens de Contagem"
        ordering = ["nivel__prateleira__codigo", "nivel__codigo"]

    def save(self, *args: object, **kwargs: object) -> None:
        """Computa divergência quando quantidade_contada é preenchida."""
        if self.quantidade_contada is not None:
            self.divergencia = self.quantidade_contada - self.quantidade_sistema
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        item = self.unidade_fisica or self.lote_insumo or "?"
        return f"Item contagem: {item} — sistema={self.quantidade_sistema}, contada={self.quantidade_contada}"
