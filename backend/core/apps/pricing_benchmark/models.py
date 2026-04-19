"""
Paddock Solutions — Pricing Benchmark — Benchmark de Mercado + IA
Motor de Orçamentos (MO) — Sprint MO-8

Modelos para ingestão de relatórios de seguradoras, amostras de mercado
e sugestões de composição via IA (Claude Sonnet 4.6).

Armadilhas:
- A7: benchmark é TETO, nunca alvo — preço final = min(calculado, p90).
- A10: IA nunca sugere preço — validação em 3 camadas.
- P11: BenchmarkFonte.confiabilidade influencia ponderação futura (MO-9).
"""
import logging
from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.authentication.models import PaddockBaseModel

logger = logging.getLogger(__name__)


class BenchmarkFonte(PaddockBaseModel):
    """Origem das amostras — seguradora, marketplace, consultoria."""

    TIPOS = [
        ("seguradora_pdf", "Relatório PDF de seguradora"),
        ("seguradora_json", "API JSON de seguradora"),
        ("cotacao_externa", "Cotação manual / marketplace"),
        ("concorrente", "Auditoria de concorrente"),
    ]

    empresa = models.ForeignKey(
        "pricing_profile.Empresa", on_delete=models.CASCADE, related_name="benchmark_fontes",
    )
    nome = models.CharField(max_length=100)
    tipo = models.CharField(max_length=30, choices=TIPOS)
    fornecedor = models.ForeignKey(
        "persons.Person",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        help_text="Seguradora ou parceiro que forneceu o dado.",
    )
    confiabilidade = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("1"))],
        default=Decimal("0.8"),
        help_text="Peso da fonte no cálculo de p90 (0-1).",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Fonte de Benchmark"
        verbose_name_plural = "Fontes de Benchmark"

    def __str__(self) -> str:
        return f"{self.nome} ({self.get_tipo_display()})"


class BenchmarkIngestao(PaddockBaseModel):
    """Registro de cada ingestão de arquivo/fonte."""

    STATUS = [
        ("recebido", "Recebido"),
        ("processando", "Processando"),
        ("concluido", "Concluído"),
        ("erro", "Erro"),
    ]

    fonte = models.ForeignKey(
        BenchmarkFonte, on_delete=models.PROTECT, related_name="ingestoes",
    )
    arquivo = models.FileField(upload_to="benchmark/ingestoes/", null=True, blank=True)
    metadados = models.JSONField(default=dict)

    status = models.CharField(max_length=20, choices=STATUS, default="recebido")
    iniciado_em = models.DateTimeField(null=True, blank=True)
    concluido_em = models.DateTimeField(null=True, blank=True)
    amostras_importadas = models.PositiveIntegerField(default=0)
    amostras_descartadas = models.PositiveIntegerField(default=0)
    log_erro = models.TextField(blank=True)

    criado_por = models.ForeignKey(
        "authentication.GlobalUser", null=True, on_delete=models.SET_NULL,
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Ingestão de Benchmark"
        verbose_name_plural = "Ingestões de Benchmark"
        ordering = ["-criado_em"]

    def __str__(self) -> str:
        return f"Ingestão {self.fonte.nome} — {self.get_status_display()}"


class BenchmarkAmostra(PaddockBaseModel):
    """Uma linha de cotação/sinistro externa — unidade atômica do benchmark."""

    ingestao = models.ForeignKey(
        BenchmarkIngestao, on_delete=models.CASCADE, related_name="amostras",
    )
    fonte = models.ForeignKey(BenchmarkFonte, on_delete=models.PROTECT)

    tipo_item = models.CharField(
        max_length=10,
        choices=[("servico", "Serviço"), ("peca", "Peça")],
    )
    servico_canonico = models.ForeignKey(
        "pricing_catalog.ServicoCanonico",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    peca_canonica = models.ForeignKey(
        "pricing_catalog.PecaCanonica",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    descricao_bruta = models.TextField()
    alias_match_confianca = models.DecimalField(
        max_digits=3, decimal_places=2, null=True, blank=True,
    )

    segmento = models.ForeignKey(
        "pricing_profile.SegmentoVeicular",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    tamanho = models.ForeignKey(
        "pricing_profile.CategoriaTamanho",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    veiculo_marca = models.CharField(max_length=60, blank=True)
    veiculo_modelo = models.CharField(max_length=100, blank=True)
    veiculo_ano = models.PositiveIntegerField(null=True, blank=True)

    valor_praticado = models.DecimalField(max_digits=12, decimal_places=2)
    moeda = models.CharField(max_length=3, default="BRL")
    data_referencia = models.DateField()

    metadados = models.JSONField(default=dict)

    revisado = models.BooleanField(default=False)
    revisado_por = models.ForeignKey(
        "authentication.GlobalUser",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="amostras_revisadas",
    )
    descartada = models.BooleanField(default=False)
    motivo_descarte = models.CharField(max_length=200, blank=True)

    class Meta:
        verbose_name = "Amostra de Benchmark"
        verbose_name_plural = "Amostras de Benchmark"
        indexes = [
            models.Index(
                fields=["servico_canonico", "segmento", "tamanho", "data_referencia"],
            ),
            models.Index(fields=["peca_canonica", "data_referencia"]),
            models.Index(fields=["ingestao", "descartada"]),
        ]

    def __str__(self) -> str:
        return f"{self.descricao_bruta[:60]} — R${self.valor_praticado}"


class SugestaoIA(PaddockBaseModel):
    """Registro de sugestão de composição via Claude — dataset para aprendizado."""

    orcamento = models.ForeignKey(
        "quotes.Orcamento", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="sugestoes_ia",
    )
    briefing = models.TextField()
    veiculo_info = models.JSONField()
    resposta_raw = models.JSONField()
    servicos_aceitos = models.ManyToManyField(
        "pricing_catalog.ServicoCanonico", blank=True, related_name="sugestoes_aceitas",
    )
    pecas_aceitas = models.ManyToManyField(
        "pricing_catalog.PecaCanonica", blank=True, related_name="sugestoes_aceitas",
    )
    avaliacao = models.CharField(
        max_length=20,
        choices=[("util", "Útil"), ("parcial", "Parcial"), ("ruim", "Ruim")],
        blank=True,
    )
    modelo_usado = models.CharField(max_length=50, default="claude-sonnet-4-6")
    tempo_resposta_ms = models.PositiveIntegerField(null=True, blank=True)
    criado_por = models.ForeignKey(
        "authentication.GlobalUser", null=True, on_delete=models.SET_NULL,
        related_name="sugestoes_ia",
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Sugestão IA"
        verbose_name_plural = "Sugestões IA"
        ordering = ["-criado_em"]

    def __str__(self) -> str:
        return f"Sugestão IA — {self.criado_em.date()} ({self.avaliacao or 'não avaliada'})"
