"""
Paddock Solutions — Pricing Profile Models
Motor de Orçamentos (MO) — Sprint 01: Perfil Veicular
"""
import logging
from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.authentication.models import PaddockBaseModel

logger = logging.getLogger(__name__)


class Empresa(PaddockBaseModel):
    """
    Representa um CNPJ operante dentro do tenant.

    O tenant DS Car hoje contém 2 Empresas que compartilham
    a mesma ficha técnica e estrutura de precificação.
    """

    cnpj = models.CharField(
        max_length=14,
        unique=True,
        db_index=True,
        verbose_name="CNPJ",
        help_text="CNPJ sem pontuação (14 dígitos).",
    )
    nome_fantasia = models.CharField(max_length=120, verbose_name="Nome fantasia")
    razao_social = models.CharField(max_length=200, verbose_name="Razão social")
    inscricao_estadual = models.CharField(
        max_length=20,
        blank=True,
        verbose_name="Inscrição estadual",
    )
    # is_active herdado de PaddockBaseModel

    class Meta:
        verbose_name = "Empresa"
        verbose_name_plural = "Empresas"
        ordering = ["nome_fantasia"]

    def __str__(self) -> str:
        return f"{self.nome_fantasia} ({self.cnpj})"


class SegmentoVeicular(PaddockBaseModel):
    """
    Segmento de mercado do veículo.

    Exemplos: Popular, Médio, Premium, Luxo, Exótico.
    O fator_responsabilidade multiplica o custo base de
    responsabilidade civil no orçamento.
    """

    codigo = models.SlugField(
        unique=True,
        verbose_name="Código",
        help_text='Slug único, ex: "popular", "premium".',
    )
    nome = models.CharField(max_length=60, verbose_name="Nome")
    ordem = models.PositiveSmallIntegerField(
        verbose_name="Ordem de exibição",
        help_text="Menor valor aparece primeiro.",
    )
    fator_responsabilidade = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.5")),
            MaxValueValidator(Decimal("5.0")),
        ],
        verbose_name="Fator responsabilidade",
        help_text="Multiplicador do custo base de responsabilidade civil (0.5–5.0).",
    )
    descricao = models.TextField(blank=True, verbose_name="Descrição")

    class Meta:
        verbose_name = "Segmento Veicular"
        verbose_name_plural = "Segmentos Veiculares"
        ordering = ["ordem"]

    def __str__(self) -> str:
        return self.nome


class CategoriaTamanho(PaddockBaseModel):
    """
    Categoria de tamanho do veículo.

    Exemplos: Compacto, Médio, SUV/Grande, Extra grande.
    Os multiplicadores afetam consumo de insumos e horas de mão de obra.
    """

    codigo = models.SlugField(
        unique=True,
        verbose_name="Código",
        help_text='Slug único, ex: "compacto", "suv-grande".',
    )
    nome = models.CharField(max_length=60, verbose_name="Nome")
    ordem = models.PositiveSmallIntegerField(
        verbose_name="Ordem de exibição",
        help_text="Menor valor aparece primeiro.",
    )
    multiplicador_insumos = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.1")),
            MaxValueValidator(Decimal("5.0")),
        ],
        verbose_name="Multiplicador de insumos",
        help_text="Fator aplicado ao custo de insumos (tintas, produtos). Intervalo: 0.1–5.0.",
    )
    multiplicador_horas = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.1")),
            MaxValueValidator(Decimal("5.0")),
        ],
        verbose_name="Multiplicador de horas",
        help_text="Fator aplicado às horas de mão de obra. Intervalo: 0.1–5.0.",
    )

    class Meta:
        verbose_name = "Categoria de Tamanho"
        verbose_name_plural = "Categorias de Tamanho"
        ordering = ["ordem"]

    def __str__(self) -> str:
        return self.nome


class TipoPintura(PaddockBaseModel):
    """
    Tipo de pintura do veículo.

    Exemplos: Sólida (1), Metálica (2), Perolizada (3), Tricoat (4).
    A complexidade influencia o custo de mão de obra e insumos de pintura.
    """

    codigo = models.SlugField(
        unique=True,
        verbose_name="Código",
        help_text='Slug único, ex: "solida", "metalica", "perolizada", "tricoat".',
    )
    nome = models.CharField(max_length=60, verbose_name="Nome")
    complexidade = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        verbose_name="Complexidade",
        help_text="Nível de complexidade da pintura: 1 (Sólida) a 4 (Tricoat).",
    )

    class Meta:
        verbose_name = "Tipo de Pintura"
        verbose_name_plural = "Tipos de Pintura"
        ordering = ["complexidade"]

    def __str__(self) -> str:
        return f"{self.nome} (complexidade {self.complexidade})"


class EnquadramentoVeiculo(PaddockBaseModel):
    """
    Mapa de marca/modelo/ano para perfil veicular.

    Permite que o Motor de Orçamentos classifique automaticamente
    um veículo em segmento, tamanho e tipo de pintura a partir da
    placa/FIPE.

    Regra de prioridade (menor = mais específico):
    - 10: marca + modelo + ano
    - 50: marca + modelo (sem ano)
    - 100: apenas marca (fallback genérico)
    """

    marca = models.CharField(max_length=60, db_index=True, verbose_name="Marca")
    modelo = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        verbose_name="Modelo",
        help_text="Deixar em branco para regra que cobre toda a marca.",
    )
    ano_inicio = models.IntegerField(
        null=True,
        blank=True,
        verbose_name="Ano início",
        help_text="Ano de fabricação inicial do intervalo (inclusive). Null = sem limite.",
    )
    ano_fim = models.IntegerField(
        null=True,
        blank=True,
        verbose_name="Ano fim",
        help_text="Ano de fabricação final do intervalo (inclusive). Null = sem limite.",
    )
    segmento = models.ForeignKey(
        SegmentoVeicular,
        on_delete=models.PROTECT,
        related_name="enquadramentos",
        verbose_name="Segmento",
    )
    tamanho = models.ForeignKey(
        CategoriaTamanho,
        on_delete=models.PROTECT,
        related_name="enquadramentos",
        verbose_name="Tamanho",
    )
    tipo_pintura_default = models.ForeignKey(
        TipoPintura,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="enquadramentos",
        verbose_name="Tipo de pintura padrão",
        help_text="Tipo de pintura mais comum para este enquadramento. Pode ser sobrescrito na OS.",
    )
    prioridade = models.PositiveSmallIntegerField(
        default=100,
        verbose_name="Prioridade",
        help_text=(
            "Quanto menor, mais específico. "
            "Match exato (marca+modelo+ano) = 10; "
            "só marca = 100."
        ),
    )

    class Meta:
        verbose_name = "Enquadramento de Veículo"
        verbose_name_plural = "Enquadramentos de Veículos"
        ordering = ["prioridade", "marca", "modelo"]
        indexes = [
            models.Index(fields=["marca", "modelo", "ano_inicio", "ano_fim"]),
        ]

    def clean(self) -> None:
        from django.core.exceptions import ValidationError

        if (
            self.ano_inicio is not None
            and self.ano_fim is not None
            and self.ano_inicio > self.ano_fim
        ):
            raise ValidationError(
                {"ano_fim": "ano_fim deve ser maior ou igual a ano_inicio."}
            )

    def __str__(self) -> str:
        partes = [self.marca]
        if self.modelo:
            partes.append(self.modelo)
        if self.ano_inicio or self.ano_fim:
            ano_str = f"{self.ano_inicio or '?'}–{self.ano_fim or '?'}"
            partes.append(f"({ano_str})")
        return " ".join(partes)


class EnquadramentoFaltante(models.Model):
    """Registro de combinações marca/modelo sem enquadramento definido.

    Alimenta o painel de curadoria para o gestor criar os enquadramentos faltantes.
    """

    marca = models.CharField(max_length=60, db_index=True, verbose_name="Marca")
    modelo = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        verbose_name="Modelo",
    )
    ocorrencias = models.PositiveIntegerField(default=1, verbose_name="Ocorrências")
    primeira_ocorrencia = models.DateTimeField(
        auto_now_add=True, verbose_name="Primeira ocorrência"
    )
    ultima_ocorrencia = models.DateTimeField(
        auto_now=True, verbose_name="Última ocorrência"
    )

    class Meta:
        unique_together = [("marca", "modelo")]
        ordering = ["-ocorrencias"]
        verbose_name = "Enquadramento Faltante"
        verbose_name_plural = "Enquadramentos Faltantes"

    def __str__(self) -> str:
        return f"{self.marca} {self.modelo} ({self.ocorrencias}x)"
