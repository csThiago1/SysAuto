"""
Paddock Solutions — Purchasing — Módulo de Compras
PedidoCompra: solicitação individual (1 peça, 1 OS)
OrdemCompra: documento agrupador por OS (múltiplos fornecedores) — PC-4: uma OC por OS
ItemOrdemCompra: item na OC (peça + fornecedor + valor)
"""
import logging

from django.db import models
from django.db.models import Sum

from apps.authentication.models import PaddockBaseModel

logger = logging.getLogger(__name__)


class PedidoCompra(PaddockBaseModel):
    """Solicitação individual de compra — gerada automaticamente pelo consultor."""

    class Status(models.TextChoices):
        SOLICITADO = "solicitado", "Solicitado"
        EM_COTACAO = "em_cotacao", "Em Cotação"
        OC_PENDENTE = "oc_pendente", "OC Pendente"
        APROVADO = "aprovado", "Aprovado"
        COMPRADO = "comprado", "Comprado"
        RECEBIDO = "recebido", "Recebido"
        CANCELADO = "cancelado", "Cancelado"

    class TipoQualidade(models.TextChoices):
        GENUINA = "genuina", "Genuína"
        REPOSICAO = "reposicao", "Reposição Original"
        SIMILAR = "similar", "Similar/Paralela"
        USADA = "usada", "Usada/Recondicionada"

    service_order = models.ForeignKey(
        "service_orders.ServiceOrder",
        on_delete=models.CASCADE,
        related_name="pedidos_compra",
    )
    service_order_part = models.ForeignKey(
        "service_orders.ServiceOrderPart",
        on_delete=models.CASCADE,
        related_name="pedidos_compra",
    )
    descricao = models.CharField(max_length=300)
    codigo_referencia = models.CharField(max_length=100, blank=True, default="")
    tipo_qualidade = models.CharField(
        max_length=15,
        choices=TipoQualidade.choices,
    )
    quantidade = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    valor_cobrado_cliente = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Valor que será cobrado na OS (preço do orçamento — PC-9).",
    )
    observacoes = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=15,
        choices=Status.choices,
        default=Status.SOLICITADO,
    )
    solicitado_por = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.PROTECT,
        related_name="pedidos_compra_solicitados",
    )

    class Meta(PaddockBaseModel.Meta):
        db_table = "purchasing_pedido_compra"
        verbose_name = "Pedido de Compra"
        verbose_name_plural = "Pedidos de Compra"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["service_order"]),
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"PC-{self.pk} — {self.descricao[:50]} ({self.status})"


class OrdemCompra(PaddockBaseModel):
    """
    Documento agrupador para aprovação financeira.
    PC-4: Uma OC por OS (múltiplos fornecedores dentro).
    PC-5: Aprovação é tudo ou nada.
    PC-10: Sem frete — valor é só peça.
    """

    class Status(models.TextChoices):
        RASCUNHO = "rascunho", "Rascunho"
        PENDENTE_APROVACAO = "pendente_aprovacao", "Pendente de Aprovação"
        APROVADA = "aprovada", "Aprovada"
        REJEITADA = "rejeitada", "Rejeitada"
        PARCIAL_RECEBIDA = "parcial_recebida", "Parcialmente Recebida"
        CONCLUIDA = "concluida", "Concluída"

    numero = models.CharField(
        max_length=20,
        unique=True,
        help_text="Auto-gerado: OC-{year}-{seq:04d}",
    )
    service_order = models.ForeignKey(
        "service_orders.ServiceOrder",
        on_delete=models.CASCADE,
        related_name="ordens_compra",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.RASCUNHO,
    )
    valor_total = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        help_text="Soma dos itens — recomputado no save().",
    )
    observacoes = models.TextField(blank=True, default="")
    criado_por = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.PROTECT,
        related_name="ordens_compra_criadas",
    )
    aprovado_por = models.ForeignKey(
        "authentication.GlobalUser",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ordens_compra_aprovadas",
    )
    aprovado_em = models.DateTimeField(null=True, blank=True)
    rejeitado_por = models.ForeignKey(
        "authentication.GlobalUser",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ordens_compra_rejeitadas",
    )
    motivo_rejeicao = models.TextField(blank=True, default="")

    class Meta(PaddockBaseModel.Meta):
        db_table = "purchasing_ordem_compra"
        verbose_name = "Ordem de Compra"
        verbose_name_plural = "Ordens de Compra"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["service_order"]),
            models.Index(fields=["status"]),
            models.Index(fields=["numero"]),
        ]

    def recompute_total(self) -> None:
        """Recomputa valor_total a partir dos itens."""
        total = self.itens.filter(is_active=True).aggregate(
            total=Sum("valor_total"),
        )["total"] or 0
        OrdemCompra.objects.filter(pk=self.pk).update(valor_total=total)

    def __str__(self) -> str:
        return f"{self.numero} — {self.status} (R$ {self.valor_total})"


class ItemOrdemCompra(PaddockBaseModel):
    """
    Item na OC — vincula peça + fornecedor.
    PC-7: fornecedor pode ser ad-hoc (campos desnormalizados) ou cadastrado (FK).
    PC-10: sem frete — valor é só peça.
    """

    class TipoQualidade(models.TextChoices):
        GENUINA = "genuina", "Genuína"
        REPOSICAO = "reposicao", "Reposição Original"
        SIMILAR = "similar", "Similar/Paralela"
        USADA = "usada", "Usada/Recondicionada"

    ordem_compra = models.ForeignKey(
        OrdemCompra,
        on_delete=models.CASCADE,
        related_name="itens",
    )
    pedido_compra = models.ForeignKey(
        PedidoCompra,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="itens_oc",
    )
    # Fornecedor — PC-7: FK ou ad-hoc
    fornecedor = models.ForeignKey(
        "pricing_catalog.Fornecedor",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="itens_oc",
    )
    fornecedor_nome = models.CharField(max_length=150)
    fornecedor_cnpj = models.CharField(max_length=20, blank=True, default="")
    fornecedor_contato = models.CharField(max_length=100, blank=True, default="")
    # Peça
    descricao = models.CharField(max_length=300)
    codigo_referencia = models.CharField(max_length=100, blank=True, default="")
    tipo_qualidade = models.CharField(
        max_length=15,
        choices=TipoQualidade.choices,
    )
    quantidade = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    valor_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    valor_total = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        help_text="qty × unit — computed no save().",
    )
    prazo_entrega = models.CharField(max_length=100, blank=True, default="")
    observacoes = models.TextField(blank=True, default="")

    class Meta(PaddockBaseModel.Meta):
        db_table = "purchasing_item_ordem_compra"
        verbose_name = "Item de Ordem de Compra"
        verbose_name_plural = "Itens de Ordem de Compra"
        indexes = [
            models.Index(fields=["ordem_compra"]),
            models.Index(fields=["fornecedor"]),
        ]

    def save(self, *args: object, **kwargs: object) -> None:
        self.valor_total = self.quantidade * self.valor_unitario
        super().save(*args, **kwargs)
        self.ordem_compra.recompute_total()

    def __str__(self) -> str:
        return f"{self.descricao[:50]} — {self.fornecedor_nome} (R$ {self.valor_total})"
