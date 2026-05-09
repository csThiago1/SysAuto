"""
Service Orders — Versioning models (ServiceOrderVersion, VersionItem, Event).
"""
from __future__ import annotations

from decimal import Decimal

from django.db import models

from apps.items.mixins import ItemFieldsMixin

from .service_order import ServiceOrder


class ServiceOrderVersion(models.Model):
    """
    Snapshot imutável de uma versão da OS.
    v1 inicial, v2+ criadas por importações ou complementos.
    Seguradora: espelha external_version "821980.1", "821980.2".
    """

    STATUS_CHOICES = [
        ("pending",    "Pendente"),
        ("approved",   "Aprovada"),
        ("rejected",   "Rejeitada"),
        ("analisado",  "Analisado"),
        ("autorizado", "Autorizado"),
        ("correcao",   "Em Correção"),
        ("em_analise", "Em Análise"),
        ("negado",     "Negado"),
        ("superseded", "Superada"),
    ]

    SOURCE_CHOICES = [
        ("manual",           "Manual"),
        ("budget_approval",  "Da aprovação de Orçamento"),
        ("cilia",            "Cilia API"),
        ("hdi",              "HDI HTML"),
        ("xml_porto",        "XML Porto"),
        ("xml_azul",         "XML Azul"),
        ("xml_itau",         "XML Itaú"),
    ]

    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.CASCADE, related_name="versions",
    )
    version_number = models.IntegerField(verbose_name="Versão")
    external_version = models.CharField(max_length=40, blank=True, default="")
    external_numero_vistoria = models.CharField(max_length=60, blank=True, default="")
    external_integration_id = models.CharField(max_length=40, blank=True, default="")
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True)

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    discount_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    net_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    labor_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    parts_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    total_seguradora = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    total_complemento_particular = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    total_franquia = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    content_hash = models.CharField(max_length=64, blank=True, default="")
    raw_payload_s3_key = models.CharField(max_length=500, blank=True, default="")
    import_attempt = models.ForeignKey(
        "cilia.ImportAttempt", on_delete=models.SET_NULL, null=True, blank=True,
    )
    hourly_rates = models.JSONField(default=dict, blank=True)
    global_discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    created_by = models.CharField(max_length=120, blank=True, default="")
    approved_at = models.DateTimeField(null=True, blank=True)

    @property
    def is_active_version(self) -> bool:
        """True if this is the highest-numbered version for its OS.

        WARNING: Fires one DB query per access. Never call inside a loop or
        from a serializer that iterates over versions. Use queryset annotation
        instead: .annotate(is_active=...) or prefetch all versions and compare
        in Python.
        """
        return (
            self.__class__.objects.filter(service_order=self.service_order)
            .order_by("-version_number")
            .values_list("id", flat=True)
            .first()
            == self.pk
        )

    class Meta:
        unique_together = [("service_order", "version_number")]
        ordering = ["-version_number"]
        indexes = [
            models.Index(fields=["service_order", "status"], name="sov_os_status_idx"),
        ]
        verbose_name = "Versão de OS"
        verbose_name_plural = "Versões de OS"

    def __str__(self) -> str:
        if self.external_version:
            return f"{self.external_version} — {self.get_status_display()}"
        return f"v{self.version_number} — {self.get_status_display()}"


class ServiceOrderVersionItem(ItemFieldsMixin):
    """
    Item de uma versão de OS. Imutável após versão aprovada/autorizada.
    Herda todos os campos de ItemFieldsMixin (bucket, payer_block, flags, etc.).
    """

    version = models.ForeignKey(
        ServiceOrderVersion, on_delete=models.CASCADE, related_name="items",
    )

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "Item de Versão de OS"
        verbose_name_plural = "Itens de Versão de OS"


class ServiceOrderEvent(models.Model):
    """
    Timeline universal de mutações em uma OS.
    Parallel ao ServiceOrderActivityLog (não substitui ainda).
    Toda mutação via Service deve chamar OSEventLogger.log_event().
    """

    EVENT_TYPES = [
        ("STATUS_CHANGE",      "Mudança de status"),
        ("AUTO_TRANSITION",    "Transição automática"),
        ("VERSION_CREATED",    "Nova versão criada"),
        ("VERSION_APPROVED",   "Versão aprovada"),
        ("VERSION_REJECTED",   "Versão rejeitada"),
        ("ITEM_ADDED",         "Item adicionado"),
        ("ITEM_REMOVED",       "Item removido"),
        ("ITEM_EDITED",        "Item editado"),
        ("IMPORT_RECEIVED",    "Importação recebida"),
        ("PARECER_ADDED",      "Parecer adicionado"),
        ("PHOTO_UPLOADED",     "Foto anexada"),
        ("PHOTO_REMOVED",      "Foto removida (soft)"),
        ("PAYMENT_RECORDED",   "Pagamento registrado"),
        ("FISCAL_ISSUED",      "Nota fiscal emitida"),
        ("SIGNATURE_CAPTURED", "Assinatura capturada"),
        ("BUDGET_LINKED",      "Orçamento aprovado virou OS"),
        ("COMPLEMENT_ADDED",   "Complemento particular adicionado"),
        ("OVERRIDE_REQUESTED",   "Override solicitado"),
        ("OVERRIDE_APPROVED",    "Override aprovado"),
        ("OVERRIDE_REJECTED",    "Override rejeitado"),
    ]

    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.CASCADE, related_name="events",
    )
    event_type = models.CharField(max_length=30, choices=EVENT_TYPES, db_index=True)
    actor = models.CharField(max_length=120, blank=True, default="Sistema")
    payload = models.JSONField(default=dict, blank=True)
    from_state = models.CharField(max_length=30, blank=True, default="")
    to_state = models.CharField(max_length=30, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["service_order", "-created_at"], name="soe_os_date_idx"),
            models.Index(fields=["event_type", "-created_at"], name="soe_type_date_idx"),
        ]
        verbose_name = "Evento de OS"
        verbose_name_plural = "Eventos de OS"

    def __str__(self) -> str:
        return f"{self.event_type} · {self.service_order_id} · {self.actor}"
