"""
Paddock Solutions — Inventory App — Estoque Físico
Motor de Orçamentos (MO) — Sprint MO-5: Estoque Físico + NF-e Entrada

UnidadeFisica: peça individual identificada por código de barras único.
LoteInsumo: material fungível com saldo em unidade_base + FIFO.
ConsumoInsumo: baixa auditável de insumo em OS (snapshot imutável de valor).
"""
from decimal import Decimal

from django.db import models
from django.db.models import F, Q
from django.core.validators import MinValueValidator

from apps.authentication.models import PaddockBaseModel


class UnidadeFisica(PaddockBaseModel):
    """
    Uma peça fisicamente identificável — um item único no estoque.
    Se chegaram 10 para-choques na NF-e, criamos 10 UnidadeFisica.

    codigo_barras gerado automaticamente no save(): P{pk.hex}
    P4: determinístico por instância, não sequencial global.
    """

    class Status(models.TextChoices):
        AVAILABLE = "available", "Disponível"
        RESERVED = "reserved", "Reservada para OS"
        CONSUMED = "consumed", "Consumida em OS"
        RETURNED = "returned", "Devolvida ao fornecedor"
        LOST = "lost", "Perdida/Avariada"

    peca_canonica = models.ForeignKey(
        "pricing_catalog.PecaCanonica",
        on_delete=models.PROTECT,
        related_name="unidades",
    )
    codigo_fornecedor = models.ForeignKey(
        "pricing_catalog.CodigoFornecedorPeca",
        null=True, blank=True,
        on_delete=models.PROTECT,
        help_text="Variante específica do fornecedor (se aplicável).",
    )
    nfe_entrada = models.ForeignKey(
        "fiscal.NFeEntrada",
        null=True, blank=True,
        on_delete=models.PROTECT,
        related_name="unidades_fisicas",
    )
    numero_serie = models.CharField(max_length=80, blank=True, default="")
    # Formato: P{pk.hex} — gerado no save() — P4
    codigo_barras = models.CharField(max_length=40, unique=True, blank=True, default="")

    # P1: valor COM tributação embutida (ICMS/IPI/PIS/COFINS)
    valor_nf = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="Valor unitário na NF-e COM tributação embutida.",
    )
    localizacao = models.CharField(
        max_length=80, blank=True, default="",
        verbose_name="Localização física",
    )
    nivel = models.ForeignKey(
        "inventory.Nivel",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="unidades_fisicas",
        help_text="Posição no armazém (WMS).",
    )
    ordem_servico = models.ForeignKey(
        "service_orders.ServiceOrder",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="unidades_fisicas",
        help_text="Preenchido quando status=reserved/consumed.",
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.AVAILABLE
    )
    consumida_em = models.DateTimeField(null=True, blank=True)

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_unidade_fisica"
        verbose_name = "Unidade Física"
        verbose_name_plural = "Unidades Físicas"
        indexes = [
            models.Index(fields=["peca_canonica", "status"]),
            models.Index(fields=["codigo_barras"]),
            models.Index(fields=["ordem_servico", "status"]),
        ]

    def save(self, *args: object, **kwargs: object) -> None:
        """P4: gera codigo_barras determinístico após obter o pk."""
        if not self.codigo_barras:
            super().save(*args, **kwargs)
            self.codigo_barras = f"P{self.pk.hex}"
            UnidadeFisica.objects.filter(pk=self.pk).update(
                codigo_barras=self.codigo_barras
            )
        else:
            super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"[{self.codigo_barras}] {self.peca_canonica} — {self.status}"


class LoteInsumo(PaddockBaseModel):
    """
    Compra fungível de um insumo — ex: galão de 5L de tinta, caixa de parafusos.
    Baixas consomem saldo via FIFO (criado_em ASC).

    A5: sempre operar em unidade_base; conversão ocorre UMA VEZ aqui via fator_conversao.
    """

    material_canonico = models.ForeignKey(
        "pricing_catalog.MaterialCanonico",
        on_delete=models.PROTECT,
        related_name="lotes",
    )
    nfe_entrada = models.ForeignKey(
        "fiscal.NFeEntrada",
        null=True, blank=True,
        on_delete=models.PROTECT,
        related_name="lotes_insumo",
    )
    # Formato: L{pk.hex} — gerado no save()
    codigo_barras = models.CharField(max_length=40, unique=True, blank=True, default="")

    # Como veio na NF: "GL", "CX-100", "L", "KG"
    unidade_compra = models.CharField(max_length=20)
    quantidade_compra = models.DecimalField(max_digits=10, decimal_places=3)
    # Quantos unidade_base cabem em 1 unidade_compra (ex: galão 5L → fator=5 se base=L)
    fator_conversao = models.DecimalField(
        max_digits=10, decimal_places=4,
        help_text="Quantas unidade_base cabem em 1 unidade_compra.",
    )
    # Saldo inicial em unidade_base = quantidade_compra × fator_conversao
    quantidade_base = models.DecimalField(max_digits=10, decimal_places=3)
    saldo = models.DecimalField(
        max_digits=10, decimal_places=3,
        help_text="Saldo restante em unidade_base.",
    )

    # P1: valor COM tributação embutida
    valor_total_nf = models.DecimalField(max_digits=12, decimal_places=2)
    # valor_total_nf / quantidade_base — calculado no save()
    valor_unitario_base = models.DecimalField(
        max_digits=12, decimal_places=4,
        help_text="Custo unitário em unidade_base. Calculado no save().",
    )

    validade = models.DateField(null=True, blank=True)
    localizacao = models.CharField(
        max_length=80, blank=True, default="",
        verbose_name="Localização física",
    )
    nivel = models.ForeignKey(
        "inventory.Nivel",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="lotes_insumo",
        help_text="Posição no armazém (WMS).",
    )

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_lote_insumo"
        verbose_name = "Lote de Insumo"
        verbose_name_plural = "Lotes de Insumo"
        constraints = [
            models.CheckConstraint(
                check=Q(saldo__gte=0),
                name="lote_saldo_nao_negativo",
            ),
            models.CheckConstraint(
                check=Q(saldo__lte=F("quantidade_base")),
                name="lote_saldo_menor_que_inicial",
            ),
        ]
        indexes = [
            models.Index(fields=["material_canonico", "saldo"]),
            models.Index(fields=["codigo_barras"]),
            models.Index(fields=["created_at"]),  # FIFO
        ]

    def save(self, *args: object, **kwargs: object) -> None:
        """Calcula valor_unitario_base e gera codigo_barras no primeiro save."""
        if self.quantidade_base and self.valor_total_nf:
            self.valor_unitario_base = (
                Decimal(str(self.valor_total_nf)) / Decimal(str(self.quantidade_base))
            )
        if not self.codigo_barras:
            super().save(*args, **kwargs)
            self.codigo_barras = f"L{self.pk.hex}"
            LoteInsumo.objects.filter(pk=self.pk).update(
                codigo_barras=self.codigo_barras
            )
        else:
            super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"[{self.codigo_barras}] {self.material_canonico} saldo={self.saldo}"


class ConsumoInsumo(PaddockBaseModel):
    """
    Registro de baixa de insumo em uma OS. FIFO por criado_em.
    P8: valor_unitario_na_baixa é snapshot — não muda se lote for atualizado.
    """

    lote = models.ForeignKey(
        LoteInsumo, on_delete=models.PROTECT, related_name="consumos"
    )
    ordem_servico = models.ForeignKey(
        "service_orders.ServiceOrder",
        on_delete=models.PROTECT,
        related_name="consumos_insumo",
    )
    quantidade_base = models.DecimalField(max_digits=10, decimal_places=3)
    # P8: snapshot imutável do custo no momento da baixa
    valor_unitario_na_baixa = models.DecimalField(max_digits=12, decimal_places=4)
    criado_por = models.ForeignKey(
        "authentication.GlobalUser",
        null=True, on_delete=models.SET_NULL,
    )

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_consumo_insumo"
        verbose_name = "Consumo de Insumo"
        verbose_name_plural = "Consumos de Insumo"
        indexes = [
            models.Index(fields=["ordem_servico", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"Consumo {self.quantidade_base} de {self.lote} — OS {self.ordem_servico_id}"
