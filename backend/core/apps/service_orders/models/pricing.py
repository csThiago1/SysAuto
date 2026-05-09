"""
Service Orders — Pricing engine execution models (OSAreaImpacto, OSIntervencao, OSItemAdicional).
"""
from __future__ import annotations

from django.db import models

from apps.authentication.models import PaddockBaseModel

from .service_order import ServiceOrder


# ─── Motor de Orçamentos — entidades de execução na OS (MO-7) ─────────────────
# OSAreaImpacto, OSIntervencao, OSItemAdicional e ApontamentoHoras espelham
# o orçamento aprovado e rastreiam a execução real na oficina.


class OSAreaImpacto(PaddockBaseModel):
    """Área de impacto aprovada — espelho da AreaImpacto do Orçamento.

    Criada em OrcamentoService.aprovar() quando a área não está negada.
    Representa a área negociada com a seguradora que foi autorizada.
    """

    _STATUS_CHOICES = [
        ("aberta",           "Aberta"),
        ("aprovada",         "Aprovada"),
        ("negada_pre_exist", "Negada — pré-existência"),
        ("parcial",          "Parcial"),
        ("cancelada",        "Cancelada"),
    ]

    service_order = models.ForeignKey(
        ServiceOrder,
        on_delete=models.CASCADE,
        related_name="areas_motor",
        verbose_name="OS",
    )
    area_impacto_origem = models.ForeignKey(
        "quotes.AreaImpacto",
        on_delete=models.PROTECT,
        related_name="os_areas",
        verbose_name="Área de impacto origem",
    )
    titulo  = models.CharField(max_length=120, verbose_name="Título")
    ordem   = models.PositiveIntegerField(default=0)
    status  = models.CharField(
        max_length=20,
        choices=_STATUS_CHOICES,
        default="aprovada",
        verbose_name="Status",
    )
    observacao_regulador = models.TextField(
        blank=True, verbose_name="Observação do regulador"
    )

    class Meta:
        verbose_name = "Área de Impacto (OS)"
        verbose_name_plural = "Áreas de Impacto (OS)"
        ordering = ["ordem"]

    def __str__(self) -> str:
        return f"{self.titulo} (OS #{self.service_order.number})"


class OSIntervencao(PaddockBaseModel):
    """Intervenção (Peça x Ação) aprovada e espelhada na OS.

    Criada em OrcamentoService.aprovar() — herda todos os valores calculados
    pelo motor de precificação (snapshot imutável).
    Rastreia execução: unidade_reservada é preenchida após picking.
    """

    _ACAO_CHOICES = [
        ("trocar",             "Trocar"),
        ("reparar",            "Reparar"),
        ("pintar",             "Pintar"),
        ("remocao_instalacao", "Remoção e instalação"),
    ]
    _STATUS_CHOICES = [
        ("orcado",        "Orçado"),
        ("aprovado",      "Aprovado"),
        ("sem_cobertura", "Sem cobertura"),
        ("sob_analise",   "Sob análise"),
        ("executado",     "Executado"),
        ("cancelado",     "Cancelado"),
    ]
    _FORNECIMENTO_CHOICES = [
        ("oficina",    "Oficina"),
        ("seguradora", "Seguradora"),
        ("cliente",    "Cliente"),
    ]

    service_order = models.ForeignKey(
        ServiceOrder,
        on_delete=models.CASCADE,
        related_name="intervencoes_motor",
        verbose_name="OS",
    )
    area = models.ForeignKey(
        OSAreaImpacto,
        on_delete=models.PROTECT,
        related_name="intervencoes",
        verbose_name="Área de impacto",
    )
    orcamento_intervencao = models.ForeignKey(
        "quotes.OrcamentoIntervencao",
        on_delete=models.PROTECT,
        related_name="os_intervencoes",
        verbose_name="Intervenção do orçamento",
    )

    # Dados canônicos (db_constraint=False — audit trail mesmo se catálogo mudar)
    peca_canonica = models.ForeignKey(
        "pricing_catalog.PecaCanonica",
        on_delete=models.PROTECT,
        db_constraint=False,
        verbose_name="Peça canônica",
    )
    acao = models.CharField(
        max_length=20,
        choices=_ACAO_CHOICES,
        verbose_name="Ação",
    )
    servico_canonico = models.ForeignKey(
        "pricing_catalog.ServicoCanonico",
        on_delete=models.PROTECT,
        db_constraint=False,
        verbose_name="Serviço canônico",
    )
    ficha_tecnica = models.ForeignKey(
        "pricing_tech.FichaTecnicaServico",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        db_constraint=False,
        verbose_name="Ficha técnica",
    )

    # Qualificadores Cilia
    qualificador_peca = models.CharField(
        max_length=10, blank=True, verbose_name="Qualificador de peça"
    )
    fornecimento = models.CharField(
        max_length=20,
        choices=_FORNECIMENTO_CHOICES,
        default="oficina",
        verbose_name="Fornecimento",
    )
    codigo_peca = models.CharField(
        max_length=60, blank=True, verbose_name="Código da peça"
    )

    # Valores decompostos
    quantidade     = models.PositiveIntegerField(default=1)
    horas_mao_obra = models.DecimalField(max_digits=6,  decimal_places=2, default=0)
    valor_peca     = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    valor_mao_obra = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    valor_insumos  = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    preco_total    = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    snapshot = models.ForeignKey(
        "pricing_engine.CalculoCustoSnapshot",
        on_delete=models.PROTECT,
        related_name="os_intervencoes",
        verbose_name="Snapshot de custo",
    )

    status = models.CharField(
        max_length=20,
        choices=_STATUS_CHOICES,
        default="aprovado",
        verbose_name="Status Cilia",
    )

    # Flags Cilia
    abaixo_padrao  = models.BooleanField(default=False)
    acima_padrao   = models.BooleanField(default=False)
    codigo_diferente = models.BooleanField(default=False)

    ordem             = models.PositiveIntegerField(default=0)
    descricao_visivel = models.CharField(max_length=300, blank=True)
    observacao        = models.TextField(blank=True)

    # Picking — preenchido após bipar a unidade física
    unidade_reservada = models.ForeignKey(
        "inventory.UnidadeFisica",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        db_constraint=False,
        related_name="os_intervencoes",
        verbose_name="Unidade reservada",
    )

    class Meta:
        verbose_name = "Intervenção (OS)"
        verbose_name_plural = "Intervenções (OS)"
        ordering = ["area__ordem", "ordem"]
        indexes = [
            models.Index(fields=["service_order", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.peca_canonica_id} × {self.acao} (OS #{self.service_order.number})"


class OSItemAdicional(PaddockBaseModel):
    """Serviço adicional aprovado — espelhado do OrcamentoItemAdicional."""

    _STATUS_CHOICES = [
        ("orcado",        "Orçado"),
        ("aprovado",      "Aprovado"),
        ("sem_cobertura", "Sem cobertura"),
        ("sob_analise",   "Sob análise"),
        ("executado",     "Executado"),
        ("cancelado",     "Cancelado"),
    ]
    _FORNECIMENTO_CHOICES = [
        ("oficina",    "Oficina"),
        ("seguradora", "Seguradora"),
        ("cliente",    "Cliente"),
    ]

    service_order = models.ForeignKey(
        ServiceOrder,
        on_delete=models.CASCADE,
        related_name="itens_adicionais_motor",
        verbose_name="OS",
    )
    orcamento_item_adicional = models.ForeignKey(
        "quotes.OrcamentoItemAdicional",
        on_delete=models.PROTECT,
        related_name="os_itens",
        verbose_name="Item adicional do orçamento",
    )
    service_catalog = models.ForeignKey(
        "service_orders.ServiceCatalog",
        on_delete=models.PROTECT,
        related_name="os_itens",
        verbose_name="Serviço do catálogo",
    )

    quantidade     = models.PositiveIntegerField(default=1)
    preco_unitario = models.DecimalField(max_digits=18, decimal_places=2)
    preco_total    = models.DecimalField(max_digits=18, decimal_places=2)

    snapshot = models.ForeignKey(
        "pricing_engine.CalculoCustoSnapshot",
        on_delete=models.PROTECT,
        related_name="os_itens",
        verbose_name="Snapshot de custo",
    )

    status = models.CharField(
        max_length=20,
        choices=_STATUS_CHOICES,
        default="aprovado",
    )
    fornecimento = models.CharField(
        max_length=20,
        choices=_FORNECIMENTO_CHOICES,
        default="oficina",
    )

    inclusao_manual = models.BooleanField(default=False)
    abaixo_padrao   = models.BooleanField(default=False)
    acima_padrao    = models.BooleanField(default=False)

    ordem             = models.PositiveIntegerField(default=0)
    descricao_visivel = models.CharField(max_length=300, blank=True)
    observacao        = models.TextField(blank=True)

    class Meta:
        verbose_name = "Item Adicional (OS)"
        verbose_name_plural = "Itens Adicionais (OS)"
        ordering = ["ordem"]
        indexes = [models.Index(fields=["service_order", "status"])]

    def __str__(self) -> str:
        return f"{self.service_catalog_id} (OS #{self.service_order.number})"
