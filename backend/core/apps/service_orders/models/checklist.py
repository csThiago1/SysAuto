"""
Service Orders — Checklist de entrada 3D.

EntryChecklist (cabeçalho por OS e tipo), EntryChecklistVersion (histórico de
reaberturas), ChecklistDamage (danos numerados), CustomerBelonging (pertences),
BudgetPanelRule (texto de orçamento → peças) e FamilyBodyType (carroceria do modelo).
Sem hard delete: desativar com soft_delete().
"""

from __future__ import annotations

from django.db import models

from apps.authentication.models import PaddockBaseModel

from ..checklist_constants import (
    PANEL_CHOICES,
    BodyType,
    BudgetMatch,
    DamageRelation,
    DamageSeverity,
    DamageType,
    SignatureStatus,
)
from .service_order import ServiceOrder, ServiceOrderPhoto

ENTRY = "entrada"


def _client_uuid_field() -> models.CharField:
    return models.CharField(
        max_length=36,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        help_text="UUID gerado no cliente — idempotência do sync offline",
    )


class EntryChecklist(PaddockBaseModel):
    """Checklist de entrada de uma OS. Travado quando finalizado."""

    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.CASCADE, related_name="entry_checklists"
    )
    checklist_type = models.CharField(max_length=20, default=ENTRY)
    stops_done = models.JSONField(
        default=dict, blank=True, help_text='{stop_key: "done" | "sem_dano"}'
    )
    body_type = models.CharField(max_length=10, choices=BodyType.choices, blank=True, default="")
    finalized_at = models.DateTimeField(null=True, blank=True)
    finalized_by = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    version = models.PositiveIntegerField(default=1)
    pdf = models.ForeignKey(
        "documents.DocumentGeneration",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    pdf_sha256 = models.CharField(max_length=64, blank=True, default="")
    signature_status = models.CharField(
        max_length=12, choices=SignatureStatus.choices, default=SignatureStatus.PENDENTE
    )
    signature = models.ForeignKey(
        "signatures.Signature",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    remote_token_hash = models.CharField(max_length=64, blank=True, default="", db_index=True)
    remote_expires_at = models.DateTimeField(null=True, blank=True)

    class Meta(PaddockBaseModel.Meta):
        verbose_name = "Checklist de Entrada"
        verbose_name_plural = "Checklists de Entrada"
        constraints = [
            models.UniqueConstraint(
                fields=["service_order", "checklist_type"],
                name="unique_entry_checklist_per_os_type",
            ),
        ]

    def __str__(self) -> str:
        return f"Checklist {self.checklist_type} · OS {self.service_order_id} · v{self.version}"

    @property
    def is_locked(self) -> bool:
        return self.finalized_at is not None


class EntryChecklistVersion(PaddockBaseModel):
    """Snapshot de uma versão finalizada, gravado ao reabrir o checklist."""

    checklist = models.ForeignKey(EntryChecklist, on_delete=models.CASCADE, related_name="versions")
    version = models.PositiveIntegerField()
    # ponytail: null porque o PDF é gerado async e a reabertura não pode falhar por isso
    pdf = models.ForeignKey(
        "documents.DocumentGeneration",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    pdf_sha256 = models.CharField(max_length=64, blank=True, default="")
    signature_status = models.CharField(
        max_length=12, choices=SignatureStatus.choices, default=SignatureStatus.PENDENTE
    )
    signature = models.ForeignKey(
        "signatures.Signature",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    reopened_reason = models.TextField()
    reopened_by = models.ForeignKey(
        "authentication.GlobalUser", on_delete=models.PROTECT, related_name="+"
    )

    class Meta(PaddockBaseModel.Meta):
        verbose_name = "Versão do Checklist de Entrada"
        verbose_name_plural = "Versões do Checklist de Entrada"

    def __str__(self) -> str:
        return f"Checklist {self.checklist_id} · v{self.version}"


class ChecklistDamage(PaddockBaseModel):
    """Dano numerado marcado numa peça do carro 3D."""

    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.CASCADE, related_name="checklist_damages"
    )
    checklist_type = models.CharField(max_length=20, default=ENTRY)
    number = models.PositiveIntegerField()
    panel_key = models.CharField(max_length=30, choices=PANEL_CHOICES)
    damage_type = models.CharField(max_length=10, choices=DamageType.choices)
    severity = models.CharField(max_length=10, choices=DamageSeverity.choices)
    relation = models.CharField(
        max_length=15, choices=DamageRelation.choices, default=DamageRelation.NAO_SEI
    )
    point = models.JSONField(null=True, blank=True, help_text="Ponto no modelo 3D")
    notes = models.TextField(blank=True, default="")
    photos = models.ManyToManyField(ServiceOrderPhoto, blank=True, related_name="checklist_damages")
    budget_match = models.CharField(
        max_length=20, choices=BudgetMatch.choices, default=BudgetMatch.SEM_ORCAMENTO
    )
    matched_budget_items = models.JSONField(default=list, blank=True)
    client_uuid = _client_uuid_field()

    class Meta(PaddockBaseModel.Meta):
        ordering = ["number"]
        verbose_name = "Dano do Checklist"
        verbose_name_plural = "Danos do Checklist"
        constraints = [
            models.UniqueConstraint(
                fields=["service_order", "checklist_type", "number"],
                name="unique_checklist_damage_number",
            ),
        ]

    def __str__(self) -> str:
        return f"Dano {self.number} · {self.panel_key}"


class CustomerBelonging(PaddockBaseModel):
    """Pertence do cliente deixado no veículo."""

    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.CASCADE, related_name="belongings"
    )
    description = models.CharField(max_length=200)
    photo = models.ForeignKey(
        ServiceOrderPhoto,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    returned_at = models.DateTimeField(null=True, blank=True)
    returned_by = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    client_uuid = _client_uuid_field()

    class Meta(PaddockBaseModel.Meta):
        verbose_name = "Pertence do Cliente"
        verbose_name_plural = "Pertences do Cliente"

    def __str__(self) -> str:
        return self.description


class BudgetPanelRule(PaddockBaseModel):
    """Regra: texto normalizado de item de orçamento → chaves de peça."""

    class Source(models.TextChoices):
        SEED = "seed", "Seed"
        MANUAL = "manual", "Manual"

    pattern = models.CharField(max_length=200, unique=True, help_text="Já normalizado")
    panel_keys = models.JSONField(default=list)
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.MANUAL)

    class Meta(PaddockBaseModel.Meta):
        verbose_name = "Regra Orçamento → Peça"
        verbose_name_plural = "Regras Orçamento → Peça"

    def __str__(self) -> str:
        return self.pattern


class FamilyBodyType(PaddockBaseModel):
    """Tipo de carroceria de um modelo do catálogo (escolhe o .glb)."""

    family = models.OneToOneField(
        "vehicle_catalog.VehicleFamily", on_delete=models.PROTECT, related_name="+"
    )
    body_type = models.CharField(max_length=10, choices=BodyType.choices)

    class Meta(PaddockBaseModel.Meta):
        verbose_name = "Carroceria do Modelo"
        verbose_name_plural = "Carrocerias dos Modelos"

    def __str__(self) -> str:
        return f"{self.family_id} · {self.body_type}"
