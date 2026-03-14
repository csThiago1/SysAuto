"""
Paddock Solutions — Fiscal App
NF-e, NFC-e e NFS-e: registro e status de emissões
"""
from django.db import models

from apps.authentication.models import PaddockBaseModel


class FiscalDocument(PaddockBaseModel):
    """
    Documento fiscal emitido — NF-e, NFC-e ou NFS-e.
    XMLs autorizados SEMPRE salvos no S3.
    Cancelamento: prazo máximo 24h após emissão.
    """

    class DocumentType(models.TextChoices):
        NFE = "nfe", "NF-e (produto B2B)"
        NFCE = "nfce", "NFC-e (consumidor)"
        NFSE = "nfse", "NFS-e (serviço)"

    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        AUTHORIZED = "authorized", "Autorizada"
        CANCELLED = "cancelled", "Cancelada"
        REJECTED = "rejected", "Rejeitada"

    document_type = models.CharField(max_length=10, choices=DocumentType.choices)
    status = models.CharField(
        max_length=15, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    # Referência da transação (OS ou venda)
    reference_id = models.UUIDField(db_index=True)
    reference_type = models.CharField(max_length=50)  # 'service_order', 'sale'
    # Dados do documento
    key = models.CharField(max_length=44, blank=True, default="", db_index=True)
    number = models.CharField(max_length=20, blank=True, default="")
    series = models.CharField(max_length=5, blank=True, default="")
    xml_s3_key = models.CharField(max_length=500, blank=True, default="")
    total_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # Ambiente SEFAZ
    environment = models.CharField(
        max_length=15, choices=[("homologation", "Homologação"), ("production", "Produção")]
    )
    authorized_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default="")

    class Meta(PaddockBaseModel.Meta):
        db_table = "fiscal_document"
        verbose_name = "Documento Fiscal"
        verbose_name_plural = "Documentos Fiscais"

    def __str__(self) -> str:
        return f"{self.document_type.upper()} #{self.number} — {self.status}"
