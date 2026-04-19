"""
Paddock Solutions — Quotes Models
Motor de Orçamentos (MO) — Sprint MO-7: Orçamento + OS

Modelos do app quotes: Orcamento, AreaImpacto, OrcamentoIntervencao,
OrcamentoItemAdicional.

ADR-001: modelo (Peça × Ação) + Áreas de Impacto (vocabulário Cilia).
"""
from apps.authentication.models import PaddockBaseModel
from apps.quotes.constants import (
    Acao,
    Fornecimento,
    QualificadorPeca,
    StatusArea,
    StatusItem,
)
from django.db import models


class Orcamento(PaddockBaseModel):
    """Documento comercial pré-OS — versionado, aprovado pelo cliente/seguradora.

    Itens são adicionados via OrcamentoService (nunca direto), para garantir
    que cada intervenção gera um CalculoCustoSnapshot.

    Aprovação converte para ServiceOrder com itens espelhados.
    """

    STATUS = [
        ("rascunho",      "Rascunho"),
        ("enviado",       "Enviado ao cliente"),
        ("aprovado",      "Aprovado"),
        ("aprovado_parc", "Aprovação parcial"),
        ("recusado",      "Recusado"),
        ("expirado",      "Expirado"),
        ("convertido_os", "Convertido em OS"),
    ]

    empresa = models.ForeignKey(
        "pricing_profile.Empresa",
        on_delete=models.PROTECT,
        related_name="orcamentos",
        verbose_name="Empresa",
    )
    numero = models.CharField(max_length=20, verbose_name="Número")
    versao = models.PositiveIntegerField(default=1, verbose_name="Versão")

    customer = models.ForeignKey(
        "customers.UnifiedCustomer",
        on_delete=models.PROTECT,
        related_name="orcamentos",
        verbose_name="Cliente",
    )
    insurer = models.ForeignKey(
        "insurers.Insurer",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="orcamentos",
        verbose_name="Seguradora",
    )
    tipo_responsabilidade = models.CharField(
        max_length=20,
        choices=[
            ("cliente",    "Cliente"),
            ("seguradora", "Seguradora"),
            ("rcf",        "RCF — responsabilidade de terceiros"),
        ],
        default="cliente",
        verbose_name="Tipo de responsabilidade",
    )
    sinistro_numero = models.CharField(
        max_length=40, blank=True, verbose_name="Número do sinistro"
    )

    # Dados veiculares desnormalizados — imutáveis após criação
    veiculo_marca   = models.CharField(max_length=60, verbose_name="Marca")
    veiculo_modelo  = models.CharField(max_length=100, verbose_name="Modelo")
    veiculo_ano     = models.PositiveIntegerField(verbose_name="Ano")
    veiculo_versao  = models.CharField(max_length=60, blank=True, verbose_name="Versão")
    veiculo_placa   = models.CharField(max_length=10, blank=True, verbose_name="Placa")

    # Perfil veicular congelado na criação (ADR-001 P2 — reprodutibilidade)
    enquadramento_snapshot = models.JSONField(
        verbose_name="Enquadramento snapshot",
        help_text="{segmento_codigo, tamanho_codigo, fator_resp, tipo_pintura_codigo}",
    )

    status    = models.CharField(max_length=20, choices=STATUS, default="rascunho")
    validade  = models.DateField(verbose_name="Válido até")
    enviado_em  = models.DateTimeField(null=True, blank=True, verbose_name="Enviado em")
    aprovado_em = models.DateTimeField(null=True, blank=True, verbose_name="Aprovado em")

    service_order = models.ForeignKey(
        "service_orders.ServiceOrder",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="orcamentos",
        verbose_name="OS gerada",
    )

    subtotal    = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    desconto    = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    total       = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    observacoes = models.TextField(blank=True, verbose_name="Observações")

    class Meta:
        verbose_name = "Orçamento"
        verbose_name_plural = "Orçamentos"
        unique_together = [("empresa", "numero", "versao")]
        indexes = [
            models.Index(fields=["empresa", "status", "-created_at"]),
            models.Index(fields=["customer", "-created_at"]),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.numero} v{self.versao} — {self.customer} [{self.status}]"


class AreaImpacto(PaddockBaseModel):
    """Região do veículo negociada em bloco com a seguradora.

    Todo orçamento nasce com 1 área "Geral". Em sinistros o consultor
    renomeia e cria áreas adicionais (Lateral Esquerda, Traseira…).
    Serviços adicionais NÃO pertencem a área.
    """

    orcamento = models.ForeignKey(
        Orcamento,
        on_delete=models.CASCADE,
        related_name="areas",
        verbose_name="Orçamento",
    )
    titulo  = models.CharField(max_length=120, verbose_name="Título")
    ordem   = models.PositiveIntegerField(default=0)
    status  = models.CharField(
        max_length=20,
        choices=StatusArea.choices,
        default=StatusArea.ABERTA,
    )
    observacao_regulador = models.TextField(
        blank=True, verbose_name="Observação do regulador"
    )

    class Meta:
        verbose_name = "Área de Impacto"
        verbose_name_plural = "Áreas de Impacto"
        ordering = ["ordem"]
        unique_together = [("orcamento", "titulo")]

    def __str__(self) -> str:
        return f"{self.titulo} ({self.orcamento.numero})"


class OrcamentoIntervencao(PaddockBaseModel):
    """Intervenção em peça = (Peça × Ação) + qualificadores Cilia.

    Unidade de negociação com seguradora. Uma mesma peça pode ter múltiplas
    intervenções (ex: porta = TROCAR + PINTAR) — cada uma com status e
    snapshot próprios.

    Constraint: mesma (orcamento, área, peça, ação) não se repete.
    """

    orcamento = models.ForeignKey(
        Orcamento,
        on_delete=models.CASCADE,
        related_name="intervencoes",
        verbose_name="Orçamento",
    )
    area_impacto = models.ForeignKey(
        AreaImpacto,
        on_delete=models.PROTECT,
        related_name="intervencoes",
        verbose_name="Área de impacto",
    )

    peca_canonica = models.ForeignKey(
        "pricing_catalog.PecaCanonica",
        on_delete=models.PROTECT,
        verbose_name="Peça canônica",
    )
    acao = models.CharField(max_length=20, choices=Acao.choices, verbose_name="Ação")

    servico_canonico = models.ForeignKey(
        "pricing_catalog.ServicoCanonico",
        on_delete=models.PROTECT,
        verbose_name="Serviço canônico",
        help_text="Resolvido via MAPEAMENTO_ACAO_SERVICO na criação.",
    )
    ficha_tecnica = models.ForeignKey(
        "pricing_tech.FichaTecnicaServico",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        verbose_name="Ficha técnica",
    )

    # Qualificadores Cilia
    qualificador_peca = models.CharField(
        max_length=10,
        choices=QualificadorPeca.choices,
        blank=True,
        verbose_name="Qualificador de peça",
    )
    fornecimento = models.CharField(
        max_length=20,
        choices=Fornecimento.choices,
        default=Fornecimento.OFICINA,
        verbose_name="Fornecimento",
    )
    codigo_peca = models.CharField(
        max_length=60, blank=True, verbose_name="Código da peça"
    )

    # Valores decompostos (estilo Cilia)
    horas_mao_obra = models.DecimalField(
        max_digits=6, decimal_places=2, default=0, verbose_name="Horas MO"
    )
    valor_peca     = models.DecimalField(
        max_digits=18, decimal_places=2, default=0, verbose_name="Valor da peça"
    )
    valor_mao_obra = models.DecimalField(
        max_digits=18, decimal_places=2, default=0, verbose_name="Valor MO"
    )
    valor_insumos  = models.DecimalField(
        max_digits=18, decimal_places=2, default=0, verbose_name="Valor insumos"
    )
    preco_total    = models.DecimalField(
        max_digits=18, decimal_places=2, default=0, verbose_name="Preço total"
    )

    snapshot = models.ForeignKey(
        "pricing_engine.CalculoCustoSnapshot",
        on_delete=models.PROTECT,
        related_name="intervencoes",
        verbose_name="Snapshot de custo",
    )

    status = models.CharField(
        max_length=20,
        choices=StatusItem.choices,
        default=StatusItem.ORCADO,
        verbose_name="Status Cilia",
    )

    # Flags Cilia
    abaixo_padrao   = models.BooleanField(default=False)
    acima_padrao    = models.BooleanField(default=False)
    inclusao_manual = models.BooleanField(default=False)
    codigo_diferente = models.BooleanField(default=False)

    quantidade        = models.PositiveIntegerField(default=1)
    ordem             = models.PositiveIntegerField(default=0)
    descricao_visivel = models.CharField(max_length=300, blank=True)
    observacao        = models.TextField(blank=True)

    class Meta:
        verbose_name = "Intervenção"
        verbose_name_plural = "Intervenções"
        ordering = ["area_impacto__ordem", "ordem"]
        indexes = [
            models.Index(fields=["orcamento", "status"]),
            models.Index(fields=["area_impacto", "status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["orcamento", "area_impacto", "peca_canonica", "acao"],
                name="orcamento_intervencao_unica_por_area",
            )
        ]

    def __str__(self) -> str:
        return f"{self.peca_canonica} × {self.get_acao_display()} ({self.orcamento.numero})"


class OrcamentoItemAdicional(PaddockBaseModel):
    """Serviço sem peça específica (alinhamento, polimento, lavagem técnica).

    Consome ServiceCatalog (catálogo simples da Sprint 16).
    NÃO pertence a área de impacto — lista plana na OS.
    """

    orcamento = models.ForeignKey(
        Orcamento,
        on_delete=models.CASCADE,
        related_name="itens_adicionais",
        verbose_name="Orçamento",
    )
    service_catalog = models.ForeignKey(
        "service_orders.ServiceCatalog",
        on_delete=models.PROTECT,
        verbose_name="Serviço do catálogo",
    )

    quantidade     = models.PositiveIntegerField(default=1)
    preco_unitario = models.DecimalField(
        max_digits=18, decimal_places=2, verbose_name="Preço unitário"
    )
    preco_total    = models.DecimalField(
        max_digits=18, decimal_places=2, verbose_name="Preço total"
    )

    snapshot = models.ForeignKey(
        "pricing_engine.CalculoCustoSnapshot",
        on_delete=models.PROTECT,
        related_name="itens_adicionais",
        verbose_name="Snapshot de custo",
    )

    status = models.CharField(
        max_length=20,
        choices=StatusItem.choices,
        default=StatusItem.ORCADO,
    )
    fornecimento = models.CharField(
        max_length=20,
        choices=Fornecimento.choices,
        default=Fornecimento.OFICINA,
    )

    inclusao_manual = models.BooleanField(default=False)
    abaixo_padrao   = models.BooleanField(default=False)
    acima_padrao    = models.BooleanField(default=False)

    ordem             = models.PositiveIntegerField(default=0)
    descricao_visivel = models.CharField(max_length=300, blank=True)
    observacao        = models.TextField(blank=True)

    class Meta:
        verbose_name = "Item adicional"
        verbose_name_plural = "Itens adicionais"
        ordering = ["ordem"]
        indexes = [models.Index(fields=["orcamento", "status"])]

    def __str__(self) -> str:
        return f"{self.service_catalog.name} ({self.orcamento.numero})"
