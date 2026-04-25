"""ImportAttempt — audit trail completo de cada tentativa de importação."""
from django.db import models
from django.utils import timezone


class ImportAttempt(models.Model):
    """Registro imutável de cada chamada a API/upload de arquivo.

    Sempre criado — mesmo em falhas. Chave de deduplicação: raw_hash (SHA-256 do payload).
    """

    SOURCE_CHOICES = [
        ("cilia", "Cilia API"),
        ("hdi", "HDI HTML"),
        ("xml_porto", "XML Porto"),
        ("xml_azul", "XML Azul"),
        ("xml_itau", "XML Itaú"),
    ]

    TRIGGER_CHOICES = [
        ("polling", "Polling Automático"),
        ("upload_manual", "Upload Manual"),
        ("user_requested", "Solicitado pelo Usuário"),
    ]

    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, db_index=True)
    trigger = models.CharField(max_length=30, choices=TRIGGER_CHOICES)

    # Identificação do orçamento
    casualty_number = models.CharField(max_length=40, blank=True, default="", db_index=True)
    budget_number = models.CharField(max_length=40, blank=True, default="")
    version_number = models.IntegerField(null=True, blank=True)

    # Resultado do processamento
    http_status = models.IntegerField(null=True, blank=True)
    parsed_ok = models.BooleanField(default=False)
    error_message = models.TextField(blank=True, default="")
    error_type = models.CharField(max_length=60, blank=True, default="")

    # Payload bruto + hash de deduplicação
    raw_payload = models.JSONField(null=True, blank=True)
    raw_hash = models.CharField(max_length=64, blank=True, default="", db_index=True)

    # Vínculos com objetos criados
    service_order = models.ForeignKey(
        "service_orders.ServiceOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="imports_attempts",
    )
    version_created = models.ForeignKey(
        "service_orders.ServiceOrderVersion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="imports_version_attempts",
    )
    duplicate_of = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="imports_duplicates",
    )

    # Auditoria
    created_at = models.DateTimeField(default=timezone.now, db_index=True, editable=False)
    created_by = models.CharField(max_length=120, blank=True, default="Sistema")
    duration_ms = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["source", "-created_at"], name="imp_source_created_idx"),
            models.Index(
                fields=["casualty_number", "budget_number", "-created_at"],
                name="imp_casualty_budget_idx",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"{self.source} {self.casualty_number}/{self.budget_number}"
            f" v{self.version_number or '?'} @ {self.created_at:%Y-%m-%d %H:%M}"
        )
