"""
Paddock Solutions — CRM App
WhatsApp via Evolution API (self-hosted)
"""
import uuid

from django.db import models

from apps.authentication.models import PaddockBaseModel


class WhatsAppMessage(PaddockBaseModel):
    """Log de mensagens WhatsApp enviadas via Evolution API."""

    class Direction(models.TextChoices):
        OUTBOUND = "outbound", "Enviada"
        INBOUND = "inbound", "Recebida"

    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        SENT = "sent", "Enviada"
        FAILED = "failed", "Falhou"

    customer_id = models.UUIDField(db_index=True, null=True, blank=True)
    phone = models.CharField(max_length=20)  # '5592999999999'
    direction = models.CharField(max_length=10, choices=Direction.choices)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    template_name = models.CharField(max_length=100, blank=True, default="")
    message = models.TextField()
    reference_id = models.UUIDField(null=True, blank=True)  # OS, venda, etc.
    reference_type = models.CharField(max_length=50, blank=True, default="")
    error_message = models.TextField(blank=True, default="")
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta(PaddockBaseModel.Meta):
        db_table = "crm_whatsapp_message"
        verbose_name = "Mensagem WhatsApp"
        verbose_name_plural = "Mensagens WhatsApp"
