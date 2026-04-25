"""
Orçamentos particulares — pré-OS para clientes não-seguradora.

Budget: documento cabeçalho (número, cliente, veículo).
BudgetVersion: snapshot versionado imutável após 'sent'.
BudgetVersionItem: linha de item herdando todos os campos canônicos de ItemFieldsMixin.
"""
from __future__ import annotations

from decimal import Decimal

from django.db import models

from apps.items.mixins import ItemFieldsMixin
from apps.persons.models import Person


class Budget(models.Model):
    """Orçamento particular pré-OS. Nunca usado para seguradora."""

    number = models.CharField(max_length=20, unique=True, db_index=True)
    customer = models.ForeignKey(
        Person, on_delete=models.PROTECT, related_name="budgets",
    )
    vehicle_plate       = models.CharField(max_length=10, db_index=True)
    vehicle_description = models.CharField(max_length=200)
    vehicle_chassis     = models.CharField(max_length=17,  blank=True, default="")
    vehicle_version     = models.CharField(max_length=80,  blank=True, default="", help_text="Versão/trim ex: LT1, EXL")
    vehicle_engine      = models.CharField(max_length=20,  blank=True, default="", help_text="Motorização ex: 1.0T, 2.0")
    vehicle_color       = models.CharField(max_length=40,  blank=True, default="", help_text="Cor do veículo")
    vehicle_year        = models.IntegerField(null=True, blank=True, help_text="Ano modelo do veículo")
    cloned_from = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="clones",
    )
    service_order = models.ForeignKey(
        "service_orders.ServiceOrder",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="source_budgets",
    )
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.number} — {self.vehicle_plate}"

    @property
    def active_version(self) -> "BudgetVersion | None":
        """Última versão (maior version_number).

        N+1 WARNING: em listas usar Subquery/annotate, não iterar chamando esta property.
        """
        return self.versions.order_by("-version_number").first()


class BudgetVersion(models.Model):
    """Snapshot imutável após 'sent'. Draft é mutável."""

    STATUS_CHOICES = [
        ("draft",      "Rascunho"),
        ("sent",       "Enviado ao cliente"),
        ("approved",   "Aprovado"),
        ("rejected",   "Rejeitado"),
        ("expired",    "Expirado"),
        ("revision",   "Em revisão"),
        ("superseded", "Superado"),
    ]

    budget = models.ForeignKey(
        Budget, on_delete=models.CASCADE, related_name="versions",
    )
    version_number = models.IntegerField()
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="draft", db_index=True,
    )
    valid_until = models.DateTimeField(null=True, blank=True)

    subtotal = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0"),
    )
    discount_total = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0"),
    )
    net_total = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0"),
    )
    labor_total = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0"),
    )
    parts_total = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0"),
    )

    content_hash = models.CharField(max_length=64, blank=True, default="")
    pdf_s3_key = models.CharField(max_length=500, blank=True, default="")

    created_by = models.CharField(max_length=120, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.CharField(max_length=120, blank=True, default="")
    approval_evidence_s3_key = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        unique_together = [("budget", "version_number")]
        ordering = ["-version_number"]
        indexes = [
            models.Index(
                fields=["status", "valid_until"], name="bv_status_valid_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.budget.number} v{self.version_number} — {self.get_status_display()}"

    def is_frozen(self) -> bool:
        """True for any status other than draft (immutable)."""
        return self.status != "draft"


class BudgetVersionItem(ItemFieldsMixin):
    """Item da versão do Budget. Imutável após version.status != 'draft'."""

    version = models.ForeignKey(
        BudgetVersion, on_delete=models.CASCADE, related_name="items",
    )

    class Meta:
        ordering = ["sort_order", "id"]
