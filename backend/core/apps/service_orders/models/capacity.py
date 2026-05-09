"""
Service Orders — Capacity models (ApontamentoHoras, CapacidadeTecnico, BloqueioCapacidade).
"""
from __future__ import annotations

from django.db import models

from apps.authentication.models import PaddockBaseModel

from .service_order import ServiceOrder
from .pricing import OSIntervencao


class ApontamentoHoras(PaddockBaseModel):
    """Apontamento de horas de um técnico em uma intervenção da OS.

    Rastreia o tempo real gasto vs. o estimado pelo motor (horas_mao_obra).
    Usado para KPIs de produtividade e rateio de custo de mão-de-obra.
    """

    _STATUS_CHOICES = [
        ("iniciado",  "Iniciado"),
        ("encerrado", "Encerrado"),
        ("validado",  "Validado"),
    ]

    service_order = models.ForeignKey(
        ServiceOrder,
        on_delete=models.CASCADE,
        related_name="apontamentos",
        verbose_name="OS",
    )
    os_intervencao = models.ForeignKey(
        OSIntervencao,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="apontamentos",
        verbose_name="Intervenção",
    )
    tecnico = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.PROTECT,
        related_name="apontamentos",
        verbose_name="Técnico",
    )

    iniciado_em   = models.DateTimeField(verbose_name="Iniciado em")
    encerrado_em  = models.DateTimeField(null=True, blank=True, verbose_name="Encerrado em")
    horas_apontadas = models.DecimalField(
        max_digits=6, decimal_places=2, default=0,
        help_text="Calculado: (encerrado_em - iniciado_em) em horas.",
        verbose_name="Horas apontadas",
    )
    observacao = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=_STATUS_CHOICES,
        default="iniciado",
        verbose_name="Status",
    )

    class Meta:
        verbose_name = "Apontamento de Horas"
        verbose_name_plural = "Apontamentos de Horas"
        ordering = ["-iniciado_em"]
        indexes = [
            models.Index(fields=["service_order", "status"]),
            models.Index(fields=["tecnico", "-iniciado_em"]),
        ]

    def __str__(self) -> str:
        return (
            f"{self.tecnico_id} → OS #{self.service_order.number} "
            f"({self.horas_apontadas}h)"
        )


# ── MO-9: Capacidade Técnica ──────────────────────────────────────────────────

def _dias_semana_default() -> list[int]:
    return [1, 2, 3, 4, 5]  # seg=1 … dom=7 (ISO weekday)


class CapacidadeTecnico(PaddockBaseModel):
    """
    Capacidade produtiva de um técnico por categoria de mão de obra.
    Define quantas horas/dia e em quais dias da semana o técnico está disponível,
    para uma determinada categoria (funilaria, pintura, mecânica…).
    """

    tecnico = models.ForeignKey(
        "hr.Employee",
        on_delete=models.CASCADE,
        related_name="capacidades",
        verbose_name="Técnico",
    )
    categoria_mao_obra = models.ForeignKey(
        "pricing_catalog.CategoriaMaoObra",
        on_delete=models.PROTECT,
        related_name="capacidades",
        verbose_name="Categoria de Mão de Obra",
    )
    horas_dia_util = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=8,
        verbose_name="Horas por dia útil",
    )
    dias_semana = models.JSONField(
        default=_dias_semana_default,
        help_text="Lista ISO weekdays (1=seg, 7=dom) em que o técnico trabalha.",
        verbose_name="Dias de trabalho",
    )
    vigente_desde = models.DateField(verbose_name="Vigente desde")
    vigente_ate = models.DateField(null=True, blank=True, verbose_name="Vigente até")

    class Meta:
        verbose_name = "Capacidade de Técnico"
        verbose_name_plural = "Capacidades de Técnicos"
        unique_together = [("tecnico", "categoria_mao_obra", "vigente_desde")]
        indexes = [
            models.Index(fields=["tecnico", "vigente_ate"]),
            models.Index(fields=["categoria_mao_obra"]),
        ]

    def __str__(self) -> str:
        return (
            f"{self.tecnico_id} — {self.categoria_mao_obra_id} "
            f"({self.horas_dia_util}h/dia desde {self.vigente_desde})"
        )


class BloqueioCapacidade(PaddockBaseModel):
    """
    Bloqueio pontual de capacidade de um técnico (férias, feriado, licença…).
    O CapacidadeService desconta dias bloqueados ao calcular horas disponíveis.
    """

    tecnico = models.ForeignKey(
        "hr.Employee",
        on_delete=models.CASCADE,
        related_name="bloqueios",
        verbose_name="Técnico",
    )
    data_inicio = models.DateField(verbose_name="Data início")
    data_fim = models.DateField(verbose_name="Data fim")
    motivo = models.CharField(max_length=100, verbose_name="Motivo")
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Bloqueio de Capacidade"
        verbose_name_plural = "Bloqueios de Capacidade"
        indexes = [
            models.Index(fields=["tecnico", "data_inicio", "data_fim"]),
        ]

    def __str__(self) -> str:
        return (
            f"{self.tecnico_id}: {self.data_inicio}→{self.data_fim} ({self.motivo})"
        )
