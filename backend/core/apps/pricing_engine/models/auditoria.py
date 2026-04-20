"""
Paddock Solutions — Pricing Engine — Auditoria do Motor
MO-9: Registro imutável de cada chamada ao motor de precificação.
"""
import uuid

from django.conf import settings
from django.db import models

from apps.authentication.models import PaddockBaseModel


class AuditoriaMotor(PaddockBaseModel):
    """
    Log imutável de auditoria de cada chamada ao MotorPrecificacaoService.
    Permite rastrear: quem pediu, qual contexto, qual resultado, em quanto tempo.
    Nunca atualizar registros desta tabela — apenas criar.
    """

    OPERACAO_CHOICES = [
        ("calcular_servico", "Calcular Serviço"),
        ("calcular_peca", "Calcular Peça"),
        ("simular", "Simular Composição"),
        ("benchmark_check", "Verificação Benchmark"),
    ]

    operacao = models.CharField(
        max_length=30,
        choices=OPERACAO_CHOICES,
        verbose_name="Operação",
    )
    chamado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="auditorias_motor",
        verbose_name="Chamado por",
    )
    empresa_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name="Empresa ID",
    )
    contexto_input = models.JSONField(
        verbose_name="Contexto de entrada",
        help_text="Parâmetros passados ao motor (servico_id, segmento, tamanho, etc.).",
    )
    resultado_output = models.JSONField(
        null=True,
        blank=True,
        verbose_name="Resultado de saída",
        help_text="DTO retornado pelo motor (preço, margens, custos).",
    )
    sucesso = models.BooleanField(default=True, verbose_name="Sucesso")
    erro_msg = models.TextField(blank=True, verbose_name="Mensagem de erro")
    tempo_ms = models.IntegerField(
        default=0,
        verbose_name="Tempo de resposta (ms)",
    )
    snapshot_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name="Snapshot ID",
        help_text="FK lógica para CalculoCustoSnapshot gerado nesta chamada.",
    )

    class Meta:
        verbose_name = "Auditoria do Motor"
        verbose_name_plural = "Auditorias do Motor"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["operacao", "-created_at"]),
            models.Index(fields=["empresa_id", "-created_at"]),
            models.Index(fields=["sucesso", "-created_at"]),
            models.Index(fields=["snapshot_id"]),
        ]

    def __str__(self) -> str:
        status = "OK" if self.sucesso else "ERRO"
        return f"[{status}] {self.operacao} {self.tempo_ms}ms @ {self.created_at}"
