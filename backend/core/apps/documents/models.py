from __future__ import annotations

import uuid

from django.db import models

from apps.authentication.models import PaddockBaseModel


class DocumentType(models.TextChoices):
    OS_REPORT = "os_report", "Ordem de Serviço"
    WARRANTY = "warranty", "Termo de Garantia"
    SETTLEMENT = "settlement", "Termo de Quitação"
    RECEIPT = "receipt", "Recibo de Pagamento"


class DocumentGeneration(PaddockBaseModel):
    """Registro imutável de cada PDF gerado — auditoria com snapshot JSON."""

    document_type = models.CharField(max_length=20, choices=DocumentType.choices)
    version = models.PositiveIntegerField(default=1)

    service_order = models.ForeignKey(
        "service_orders.ServiceOrder",
        on_delete=models.CASCADE,
        related_name="generated_documents",
    )
    receivable = models.ForeignKey(
        "accounts_receivable.ReceivableDocument",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Apenas para recibos",
    )

    data_snapshot = models.JSONField(
        help_text="Dados completos no momento da geração. Permite regerar PDF idêntico."
    )

    s3_key = models.CharField(max_length=500)
    file_size_bytes = models.PositiveIntegerField(null=True, blank=True)

    generated_by = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.PROTECT,
        related_name="documents_generated",
    )

    class Meta:
        db_table = "documents_generation"
        ordering = ["-created_at"]
        verbose_name = "Documento Gerado"
        verbose_name_plural = "Documentos Gerados"
        indexes = [
            models.Index(
                fields=["service_order", "document_type", "-version"],
                name="idx_doc_so_type_ver",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["service_order", "document_type", "version"],
                name="unique_doc_version",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"{self.get_document_type_display()} v{self.version}"
            f" — OS #{self.service_order.number}"
        )
