"""Assinaturas digitais capturadas via canvas tablet, link remoto ou scan.

Cada assinatura representa um evento de consentimento — aprovação de orçamento,
recepção do veículo na entrada, entrega final, etc. Imutável após capturada:
signature_hash preserva integridade do PNG da assinatura + metadados.
"""
from __future__ import annotations

from django.db import models
from django.utils import timezone


class Signature(models.Model):
    """Registro imutável de uma assinatura capturada."""

    METHOD_CHOICES = [
        ("CANVAS_TABLET", "Canvas em Tablet"),
        ("REMOTE_LINK", "Link Remoto (WhatsApp/Email)"),
        ("SCAN_PDF", "Scan de PDF assinado"),
    ]

    DOC_TYPE_CHOICES = [
        ("BUDGET_APPROVAL", "Aprovação de Orçamento"),
        ("OS_OPEN", "Recepção do Veículo"),
        ("OS_DELIVERY", "Entrega do Veículo"),
        ("COMPLEMENT_APPROVAL", "Aprovação de Complemento"),
        ("INSURANCE_ACCEPTANCE", "Aceite da Seguradora"),
    ]

    # Vínculos — ao menos um deve estar preenchido (OS ou Budget)
    service_order = models.ForeignKey(
        "service_orders.ServiceOrder",
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name="signatures",
    )
    budget = models.ForeignKey(
        "budgets.Budget",
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name="signatures",
    )

    document_type = models.CharField(
        max_length=40, choices=DOC_TYPE_CHOICES, db_index=True,
    )
    method = models.CharField(
        max_length=20, choices=METHOD_CHOICES, db_index=True,
    )

    # Dados do signatário
    signer_name = models.CharField(max_length=200)
    signer_cpf = models.CharField(max_length=14, blank=True, default="")

    # Dados da assinatura
    signature_png_base64 = models.TextField(
        help_text="PNG da assinatura em base64 (canvas do tablet ou scan)",
    )
    signature_hash = models.CharField(
        max_length=64, db_index=True,
        help_text="SHA256 do PNG + metadados (integridade/anti-tampering)",
    )

    # Metadados de auditoria
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=400, blank=True, default="")
    signed_at = models.DateTimeField(default=timezone.now, editable=False, db_index=True)

    # Token do link remoto (quando REMOTE_LINK) — JWT curto opcional
    remote_token = models.CharField(max_length=500, blank=True, default="")

    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-signed_at"]
        indexes = [
            models.Index(fields=["service_order", "document_type", "-signed_at"],
                         name="sig_os_doctype_idx"),
            models.Index(fields=["budget", "document_type", "-signed_at"],
                         name="sig_budget_doctype_idx"),
        ]
        constraints = [
            # Pelo menos um de service_order ou budget deve estar preenchido
            models.CheckConstraint(
                condition=(
                    models.Q(service_order__isnull=False)
                    | models.Q(budget__isnull=False)
                ),
                name="sig_requires_owner",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.signer_name} · {self.get_document_type_display()} · {self.signed_at:%d/%m/%Y %H:%M}"
