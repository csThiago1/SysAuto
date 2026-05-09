"""
Service Orders — Parecer, ImpactAreaLabel, TransitionOverrideRequest.
"""
from __future__ import annotations

from django.db import models

from apps.authentication.models import PaddockBaseModel

from .service_order import ServiceOrder
from .versioning import ServiceOrderVersion


class ServiceOrderParecer(models.Model):
    """
    Timeline de workflow entre oficina e seguradora.
    Pode ser importado (Cilia/XML) ou criado internamente.
    """

    PARECER_TYPE_CHOICES = [
        ("CONCORDADO",         "Concordado"),
        ("AUTORIZADO",         "Autorizado"),
        ("CORRECAO",           "Correção"),
        ("NEGADO",             "Negado"),
        ("SEM_COBERTURA",      "Sem Cobertura"),
        ("COMENTARIO_INTERNO", "Comentário Interno"),
    ]

    SOURCE_CHOICES = [
        ("internal",  "Interno DSCar"),
        ("cilia",     "Cilia"),
        ("hdi",       "HDI"),
        ("xml_porto", "XML Porto"),
        ("xml_azul",  "XML Azul"),
        ("xml_itau",  "XML Itaú"),
    ]

    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.CASCADE, related_name="pareceres",
    )
    version = models.ForeignKey(
        ServiceOrderVersion, on_delete=models.CASCADE,
        null=True, blank=True, related_name="pareceres",
    )
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    flow_number = models.IntegerField(null=True, blank=True)
    author_external = models.CharField(max_length=120, blank=True, default="")
    author_org = models.CharField(max_length=120, blank=True, default="")
    author_internal = models.CharField(max_length=120, blank=True, default="")
    parecer_type = models.CharField(max_length=30, choices=PARECER_TYPE_CHOICES, blank=True, default="")
    body = models.TextField()
    created_at_external = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Parecer de OS"
        verbose_name_plural = "Pareceres de OS"

    def __str__(self) -> str:
        return f"Parecer {self.source} · {self.parecer_type or 'interno'}"


class ImpactAreaLabel(models.Model):
    """Label textual das áreas de impacto (1=Frontal, 2=Lateral direita, …)."""

    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.CASCADE, related_name="area_labels",
    )
    area_number = models.IntegerField()
    label_text = models.CharField(max_length=100)

    class Meta:
        unique_together = [("service_order", "area_number")]
        verbose_name = "Label de Área de Impacto"
        verbose_name_plural = "Labels de Áreas de Impacto"

    def __str__(self) -> str:
        return f"Área {self.area_number}: {self.label_text}"


# ── Override de Transição ─────────────────────────────────────────────────────


class TransitionOverrideRequest(PaddockBaseModel):
    """Solicitação de override para transição bloqueada por soft block.

    Criado quando um CONSULTANT tenta avançar mas tem soft blocks.
    Resolvido por um MANAGER+ (presencial ou assíncrono via notificação).
    Expira automaticamente após 24h se não resolvido.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        APPROVED = "approved", "Aprovado"
        REJECTED = "rejected", "Rejeitado"
        EXPIRED = "expired", "Expirado"

    service_order = models.ForeignKey(
        ServiceOrder,
        on_delete=models.CASCADE,
        related_name="override_requests",
        verbose_name="OS",
    )
    from_status = models.CharField(max_length=20, verbose_name="Status atual")
    to_status = models.CharField(max_length=20, verbose_name="Status desejado")
    requested_by = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.PROTECT,
        related_name="override_requests_made",
        verbose_name="Solicitado por",
    )
    approved_by = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="override_requests_resolved",
        verbose_name="Resolvido por",
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
        verbose_name="Status",
    )
    blocks_snapshot = models.JSONField(
        default=list,
        help_text="Soft blocks no momento da solicitação",
    )
    request_reason = models.TextField(verbose_name="Motivo da solicitação")
    justification = models.TextField(
        blank=True, default="", verbose_name="Justificativa do gerente"
    )
    resolved_at = models.DateTimeField(null=True, blank=True, verbose_name="Resolvido em")
    expires_at = models.DateTimeField(verbose_name="Expira em")

    class Meta:
        db_table = "service_orders_override_request"
        ordering = ["-created_at"]
        verbose_name = "Solicitação de Override"
        verbose_name_plural = "Solicitações de Override"
        indexes = [
            models.Index(fields=["service_order", "status"]),
            models.Index(fields=["status", "expires_at"]),
        ]

    def __str__(self) -> str:
        return (
            f"Override OS #{self.service_order.number}: "
            f"{self.from_status} → {self.to_status} ({self.status})"
        )
