"""
Paddock Solutions — Pricing Engine — Modelos de Parâmetros
Motor de Orçamentos (MO) — Sprint 03: Adapters de Custo

Parâmetros de configuração para cálculo de custo hora e rateio
de despesas recorrentes por empresa dentro do tenant.
"""
import logging
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.authentication.models import PaddockBaseModel

logger = logging.getLogger(__name__)


class ParametroRateio(PaddockBaseModel):
    """
    Horas produtivas e método de rateio para DespesaRecorrente.

    Define como as despesas fixas da oficina são distribuídas entre
    as OSs/horas de cada mês. Suporta vigência temporal para que
    mudanças históricas sejam rastreadas sem perda de dados.
    """

    empresa = models.ForeignKey(
        "pricing_profile.Empresa",
        on_delete=models.PROTECT,
        related_name="parametros_rateio",
        verbose_name="Empresa",
    )
    vigente_desde = models.DateField(verbose_name="Vigente desde")
    vigente_ate = models.DateField(
        null=True, blank=True, verbose_name="Vigente até"
    )
    horas_produtivas_mes = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("1.0"))],
        verbose_name="Horas produtivas/mês",
        help_text="Horas produtivas totais da oficina no mês. Default conservador: 168h.",
    )
    metodo = models.CharField(
        max_length=20,
        choices=[
            ("por_hora", "Por hora produtiva"),
            ("por_os", "Por OS concluída"),
        ],
        default="por_hora",
        verbose_name="Método de rateio",
    )
    observacoes = models.TextField(blank=True, verbose_name="Observações")

    class Meta:
        verbose_name = "Parâmetro de Rateio"
        verbose_name_plural = "Parâmetros de Rateio"
        indexes = [models.Index(fields=["empresa", "vigente_desde"])]

    def __str__(self) -> str:
        return (
            f"Rateio {self.empresa} desde {self.vigente_desde}"
            f" ({self.horas_produtivas_mes}h/mês)"
        )


class ParametroCustoHora(PaddockBaseModel):
    """
    Complementos ao salário bruto para compor custo real da hora.

    Armazena os percentuais e valores fixos que são somados ao salário
    bruto do colaborador para obter o custo total por hora trabalhada.
    Todos os encargos devem ser expressos como fração do bruto (decimal).
    """

    empresa = models.ForeignKey(
        "pricing_profile.Empresa",
        on_delete=models.PROTECT,
        related_name="parametros_custo_hora",
        verbose_name="Empresa",
    )
    vigente_desde = models.DateField(verbose_name="Vigente desde")
    vigente_ate = models.DateField(
        null=True, blank=True, verbose_name="Vigente até"
    )
    provisao_13_ferias = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=Decimal("0.1389"),
        verbose_name="Provisão 13º + férias",
        help_text=(
            "Provisão de 13º + férias como fração do bruto. "
            "Padrão: 0.1389 (13.89%)"
        ),
    )
    multa_fgts_rescisao = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=Decimal("0.0320"),
        verbose_name="Multa FGTS rescisão",
        help_text=(
            "Multa FGTS rescisão como fração. Padrão: 0.0320 (3.20%)"
        ),
    )
    beneficios_por_funcionario = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Benefícios por funcionário (R$)",
        help_text="VT + VA + plano de saúde etc por funcionário/mês em R$.",
    )
    horas_produtivas_mes = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal("168.00"),
        verbose_name="Horas produtivas individuais/mês",
        help_text=(
            "Horas produtivas individuais por mês. Padrão: 168h (8h × 21 dias)."
        ),
    )
    observacoes = models.TextField(blank=True, verbose_name="Observações")

    class Meta:
        verbose_name = "Parâmetro de Custo Hora"
        verbose_name_plural = "Parâmetros de Custo Hora"
        indexes = [models.Index(fields=["empresa", "vigente_desde"])]

    def __str__(self) -> str:
        return f"CustoHora {self.empresa} desde {self.vigente_desde}"


class CustoHoraFallback(PaddockBaseModel):
    """
    Valor direto de custo/hora enquanto RH não tem dados completos.

    Permite configurar um valor de referência por categoria de mão de obra
    sem depender dos registros de Employee no módulo HR. Útil durante
    migração de dados ou quando a oficina não utiliza o módulo de RH.
    """

    empresa = models.ForeignKey(
        "pricing_profile.Empresa",
        on_delete=models.PROTECT,
        related_name="custos_hora_fallback",
        verbose_name="Empresa",
    )
    categoria = models.ForeignKey(
        "pricing_catalog.CategoriaMaoObra",
        on_delete=models.CASCADE,
        related_name="fallbacks_custo_hora",
        verbose_name="Categoria de mão de obra",
    )
    vigente_desde = models.DateField(verbose_name="Vigente desde")
    vigente_ate = models.DateField(
        null=True, blank=True, verbose_name="Vigente até"
    )
    valor_hora = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("1.0"))],
        verbose_name="Valor por hora (R$)",
    )
    motivo = models.CharField(
        max_length=200,
        blank=True,
        verbose_name="Motivo",
        help_text="Razão para uso do fallback (ex: 'aguardando integração RH').",
    )

    class Meta:
        verbose_name = "Custo Hora Fallback"
        verbose_name_plural = "Custos Hora Fallback"
        indexes = [
            models.Index(fields=["empresa", "categoria", "vigente_desde"])
        ]

    def __str__(self) -> str:
        return (
            f"Fallback {self.categoria} R${self.valor_hora}/h"
            f" desde {self.vigente_desde}"
        )
