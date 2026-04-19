"""
Paddock Solutions — Pricing Engine — Modelos do Motor de Precificação
Motor de Orçamentos (MO) — Sprint MO-6: Motor de Precificação + Snapshots

Contém:
- MargemOperacao: margem base por segmento × tipo de operação, com vigência.
- MarkupPeca: override fino de margem por peça específica OU faixa de custo.
- CalculoCustoSnapshot: snapshot IMUTÁVEL com decomposição completa do preço.

ARMADILHA A4: CalculoCustoSnapshot é imutável. Para corrigir um preço,
crie novo snapshot e atualize a FK na linha de orçamento/OS.
"""
import logging
from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q

from apps.authentication.models import PaddockBaseModel

logger = logging.getLogger(__name__)


class MargemOperacao(PaddockBaseModel):
    """Margem base por segmento veicular × tipo de operação.

    Ajustada no cálculo final pelo fator_responsabilidade do segmento.
    Suporta vigência temporal para rastreabilidade histórica.
    """

    TIPO_OPERACAO = [
        ("servico_mao_obra", "Serviço / Mão de obra"),
        ("peca_revenda", "Peça (revenda)"),
        ("insumo_comp", "Insumo complementar"),
    ]

    empresa = models.ForeignKey(
        "pricing_profile.Empresa",
        on_delete=models.CASCADE,
        related_name="margens",
        verbose_name="Empresa",
    )
    segmento = models.ForeignKey(
        "pricing_profile.SegmentoVeicular",
        on_delete=models.PROTECT,
        related_name="margens",
        verbose_name="Segmento veicular",
    )
    tipo_operacao = models.CharField(
        max_length=30,
        choices=TIPO_OPERACAO,
        verbose_name="Tipo de operação",
    )
    margem_percentual = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        validators=[
            MinValueValidator(Decimal("0")),
            MaxValueValidator(Decimal("5")),
        ],
        verbose_name="Margem percentual",
        help_text="Margem base, ex: 0.4000 = 40%. Multiplicada por "
        "(1 + fator_responsabilidade) no cálculo final.",
    )
    vigente_desde = models.DateField(verbose_name="Vigente desde")
    vigente_ate = models.DateField(
        null=True, blank=True, verbose_name="Vigente até"
    )

    class Meta:
        verbose_name = "Margem de Operação"
        verbose_name_plural = "Margens de Operação"
        unique_together = [("empresa", "segmento", "tipo_operacao", "vigente_desde")]
        indexes = [
            models.Index(
                fields=["empresa", "segmento", "tipo_operacao", "vigente_desde"]
            )
        ]

    def __str__(self) -> str:
        return (
            f"{self.get_tipo_operacao_display()} / {self.segmento}"
            f" — {self.margem_percentual:.2%}"
        )


class MarkupPeca(PaddockBaseModel):
    """Override fino de margem por peça específica ou faixa de custo.

    Hierarquia de resolução:
      1. Peça específica (peca_canonica IS NOT NULL).
      2. Faixa de custo (faixa_custo_min IS NOT NULL).
      3. Default por segmento (MargemOperacao tipo peca_revenda).

    Constraint XOR: ou é peça específica, ou é faixa — nunca os dois.
    """

    empresa = models.ForeignKey(
        "pricing_profile.Empresa",
        on_delete=models.CASCADE,
        related_name="markups_peca",
        verbose_name="Empresa",
    )
    peca_canonica = models.ForeignKey(
        "pricing_catalog.PecaCanonica",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        db_constraint=False,  # regras de markup sobrevivem a reindexações do catálogo
        related_name="markups",
        verbose_name="Peça canônica",
    )
    faixa_custo_min = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Faixa custo mín (R$)",
    )
    faixa_custo_max = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Faixa custo máx (R$)",
    )
    margem_percentual = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        validators=[
            MinValueValidator(Decimal("0")),
            MaxValueValidator(Decimal("5")),
        ],
        verbose_name="Margem percentual",
    )
    vigente_desde = models.DateField(verbose_name="Vigente desde")
    vigente_ate = models.DateField(
        null=True, blank=True, verbose_name="Vigente até"
    )
    observacao = models.CharField(
        max_length=200, blank=True, verbose_name="Observação"
    )

    class Meta:
        verbose_name = "Markup de Peça"
        verbose_name_plural = "Markups de Peças"
        constraints = [
            models.CheckConstraint(
                check=(
                    Q(peca_canonica__isnull=False, faixa_custo_min__isnull=True)
                    | Q(peca_canonica__isnull=True, faixa_custo_min__isnull=False)
                ),
                name="markup_peca_ou_faixa",
            )
        ]
        indexes = [
            models.Index(fields=["empresa", "vigente_desde"]),
        ]

    def __str__(self) -> str:
        if self.peca_canonica_id:
            return f"Markup peça {self.peca_canonica} — {self.margem_percentual:.2%}"
        return (
            f"Markup faixa R${self.faixa_custo_min}–{self.faixa_custo_max}"
            f" — {self.margem_percentual:.2%}"
        )


class CalculoCustoSnapshot(PaddockBaseModel):
    """IMUTÁVEL. Decomposição completa do preço no instante do cálculo.

    ARMADILHA A4: não edite campos de decomposição após criação. Para
    corrigir, crie novo snapshot e aponte a FK da linha de orçamento/OS
    para o novo. O antigo permanece como histórico de auditoria.

    Um snapshot cobre 1 serviço OU 1 peça/insumo (linha única de orçamento).
    """

    ORIGEM = [
        ("orcamento_linha", "Linha de orçamento"),
        ("os_linha", "Linha de OS"),
        ("simulacao", "Simulação avulsa"),
    ]

    empresa = models.ForeignKey(
        "pricing_profile.Empresa",
        on_delete=models.PROTECT,
        related_name="snapshots_custo",
        verbose_name="Empresa",
    )
    servico_canonico = models.ForeignKey(
        "pricing_catalog.ServicoCanonico",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        db_constraint=False,  # snapshot imutável — não bloquear deleção do catálogo
        related_name="snapshots_custo",
        verbose_name="Serviço canônico",
    )
    peca_canonica = models.ForeignKey(
        "pricing_catalog.PecaCanonica",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        db_constraint=False,  # snapshot imutável — não bloquear deleção do catálogo
        related_name="snapshots_custo",
        verbose_name="Peça canônica",
    )

    origem = models.CharField(
        max_length=30, choices=ORIGEM, verbose_name="Origem"
    )

    # Contexto usado no cálculo — gravado em JSON para auditoria completa.
    # Deve conter todos os inputs necessários para re-calcular (P6).
    contexto = models.JSONField(verbose_name="Contexto de cálculo")

    # Decomposição — TUDO em Decimal(18,2) para valores monetários.
    custo_mo = models.DecimalField(
        max_digits=18, decimal_places=2, default=0, verbose_name="Custo mão de obra"
    )
    custo_insumos = models.DecimalField(
        max_digits=18, decimal_places=2, default=0, verbose_name="Custo insumos"
    )
    rateio = models.DecimalField(
        max_digits=18, decimal_places=2, default=0, verbose_name="Rateio despesas"
    )
    custo_peca_base = models.DecimalField(
        max_digits=18, decimal_places=2, default=0, verbose_name="Custo peça base"
    )

    custo_total_base = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        verbose_name="Custo total base",
        help_text="= custo_mo + custo_insumos + rateio + custo_peca_base",
    )

    fator_responsabilidade = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        verbose_name="Fator de responsabilidade",
    )
    margem_base = models.DecimalField(
        max_digits=5, decimal_places=4, verbose_name="Margem base"
    )
    margem_ajustada = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        verbose_name="Margem ajustada",
        help_text="= margem_base × (1 + fator_responsabilidade)",
    )

    preco_calculado = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        verbose_name="Preço calculado",
        help_text="= custo_total_base × (1 + margem_ajustada)",
    )

    preco_teto_benchmark = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Preço teto benchmark",
        help_text="p90 do benchmark por segmento+serviço (MO-8). NULL se indisponível.",
    )
    preco_final = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        verbose_name="Preço final",
        help_text="= min(preco_calculado, preco_teto_benchmark) se teto disponível",
    )

    # Decomposição detalhada — JSON com todas as linhas de custo para auditoria.
    decomposicao = models.JSONField(verbose_name="Decomposição detalhada")

    calculado_em = models.DateTimeField(
        auto_now_add=True, verbose_name="Calculado em"
    )
    calculado_por = models.ForeignKey(
        "authentication.GlobalUser",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="snapshots_calculados",
        verbose_name="Calculado por",
    )

    class Meta:
        verbose_name = "Snapshot de Custo"
        verbose_name_plural = "Snapshots de Custo"
        indexes = [
            models.Index(fields=["empresa", "servico_canonico", "calculado_em"]),
            models.Index(fields=["empresa", "peca_canonica", "calculado_em"]),
            models.Index(fields=["origem", "calculado_em"]),
        ]

    def save(self, *args: object, **kwargs: object) -> None:
        """Garante imutabilidade dos campos de decomposição (Armadilha A4).

        Permite save apenas na criação inicial. Qualquer tentativa de
        modificar preco_final, custo_total_base ou decomposicao levanta
        ValueError — deve-se criar novo snapshot.
        """
        if self.pk and not self._state.adding:
            original = CalculoCustoSnapshot.objects.only(
                "preco_final", "custo_total_base", "decomposicao"
            ).get(pk=self.pk)
            if (
                original.preco_final != self.preco_final
                or original.custo_total_base != self.custo_total_base
                or original.decomposicao != self.decomposicao
            ):
                raise ValueError(
                    "CalculoCustoSnapshot é imutável — crie novo snapshot em vez de editar."
                )
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        item = self.servico_canonico or self.peca_canonica or "?"
        return f"Snapshot {item} R${self.preco_final} em {self.calculado_em:%d/%m/%Y %H:%M}"
