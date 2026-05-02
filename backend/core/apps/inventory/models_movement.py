"""
Paddock Solutions — Inventory — Movimentação de Estoque
WMS-1: MovimentacaoEstoque é IMUTÁVEL — save() bloqueia update após criação.
WMS-3: realizado_por NUNCA nullable.
"""
import logging
from typing import Any

from django.db import models

from apps.authentication.models import PaddockBaseModel

logger = logging.getLogger(__name__)


class MovimentacaoEstoque(PaddockBaseModel):
    """
    Log imutável de toda operação que altera o estoque.
    Substitui StockMovement. Após criação, save() levanta ValueError.
    """

    class Tipo(models.TextChoices):
        ENTRADA_NF = "entrada_nf", "Entrada via NF-e"
        ENTRADA_MANUAL = "entrada_manual", "Entrada Manual"
        ENTRADA_DEVOLUCAO = "entrada_devolucao", "Devolução"
        SAIDA_OS = "saida_os", "Saída para OS"
        SAIDA_PERDA = "saida_perda", "Perda/Avaria"
        TRANSFERENCIA = "transferencia", "Transferência"
        AJUSTE_INVENTARIO = "ajuste_inventario", "Ajuste de Inventário"

    tipo = models.CharField(max_length=20, choices=Tipo.choices)

    # Item movimentado (XOR: um dos dois)
    unidade_fisica = models.ForeignKey(
        "inventory.UnidadeFisica",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="movimentacoes",
    )
    lote_insumo = models.ForeignKey(
        "inventory.LoteInsumo",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="movimentacoes",
    )
    quantidade = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        help_text="1 para peça, N para insumo.",
    )

    # Localização
    nivel_origem = models.ForeignKey(
        "inventory.Nivel",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="movimentacoes_origem",
        help_text="De onde saiu.",
    )
    nivel_destino = models.ForeignKey(
        "inventory.Nivel",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="movimentacoes_destino",
        help_text="Para onde foi.",
    )

    # Vínculos
    ordem_servico = models.ForeignKey(
        "service_orders.ServiceOrder",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="movimentacoes_estoque",
    )
    nfe_entrada = models.ForeignKey(
        "fiscal.NFeEntrada",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="movimentacoes_estoque",
    )

    # Auditoria
    motivo = models.TextField(
        blank=True,
        default="",
        help_text="Obrigatório para PERDA e AJUSTE.",
    )
    evidencia = models.FileField(
        upload_to="inventory/evidencias/%Y/%m/",
        null=True,
        blank=True,
        help_text="Foto para perda/ajuste.",
    )
    aprovado_por = models.ForeignKey(
        "authentication.GlobalUser",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="movimentacoes_aprovadas",
        help_text="PERDA e AJUSTE requerem MANAGER+.",
    )
    aprovado_em = models.DateTimeField(null=True, blank=True)

    # WMS-3: SEMPRE obrigatório
    realizado_por = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.PROTECT,
        related_name="movimentacoes_realizadas",
    )

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_movimentacao_estoque"
        verbose_name = "Movimentação de Estoque"
        verbose_name_plural = "Movimentações de Estoque"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tipo", "created_at"]),
            models.Index(fields=["unidade_fisica"]),
            models.Index(fields=["lote_insumo"]),
            models.Index(fields=["ordem_servico"]),
            models.Index(fields=["realizado_por"]),
        ]

    def save(self, *args: Any, **kwargs: Any) -> None:
        """WMS-1: bloqueia update após criação."""
        if self._state.adding:
            super().save(*args, **kwargs)
        else:
            # Allow only aprovado_por and aprovado_em updates (for approval flow)
            update_fields = kwargs.get("update_fields")
            if update_fields and set(update_fields) <= {
                "aprovado_por",
                "aprovado_por_id",
                "aprovado_em",
                "updated_at",
            }:
                super().save(*args, **kwargs)
            else:
                raise ValueError(
                    "MovimentacaoEstoque é imutável (WMS-1). "
                    "Apenas aprovado_por e aprovado_em podem ser atualizados."
                )

    def __str__(self) -> str:
        return f"[{self.tipo}] {self.created_at:%Y-%m-%d %H:%M} por {self.realizado_por_id}"
