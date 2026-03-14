"""
Paddock Solutions — Service Orders App
OS, Kanban e checklist de vistoria
"""
import uuid

from django.db import models

from apps.authentication.models import PaddockBaseModel


class ServiceOrderStatus(models.TextChoices):
    RECEPTION = "reception", "Recepção"
    INITIAL_SURVEY = "initial_survey", "Vistoria Inicial"
    BUDGET = "budget", "Orçamento"
    WAITING_PARTS = "waiting_parts", "Aguardando Peças"
    REPAIR = "repair", "Reparo"
    MECHANIC = "mechanic", "Mecânica"
    BODYWORK = "bodywork", "Funilaria"
    PAINTING = "painting", "Pintura"
    ASSEMBLY = "assembly", "Montagem"
    POLISHING = "polishing", "Polimento"
    WASHING = "washing", "Lavagem"
    FINAL_SURVEY = "final_survey", "Vistoria Final"
    READY = "ready", "Pronto"
    DELIVERED = "delivered", "Entregue"
    CANCELLED = "cancelled", "Cancelado"


# Transições válidas do Kanban DS Car
VALID_TRANSITIONS: dict[str, list[str]] = {
    ServiceOrderStatus.RECEPTION: [
        ServiceOrderStatus.INITIAL_SURVEY,
        ServiceOrderStatus.CANCELLED,
    ],
    ServiceOrderStatus.INITIAL_SURVEY: [ServiceOrderStatus.BUDGET],
    ServiceOrderStatus.BUDGET: [
        ServiceOrderStatus.WAITING_PARTS,
        ServiceOrderStatus.REPAIR,
    ],
    ServiceOrderStatus.WAITING_PARTS: [ServiceOrderStatus.REPAIR],
    ServiceOrderStatus.REPAIR: [
        ServiceOrderStatus.MECHANIC,
        ServiceOrderStatus.BODYWORK,
        ServiceOrderStatus.POLISHING,
    ],
    ServiceOrderStatus.MECHANIC: [
        ServiceOrderStatus.BODYWORK,
        ServiceOrderStatus.POLISHING,
    ],
    ServiceOrderStatus.BODYWORK: [ServiceOrderStatus.PAINTING],
    ServiceOrderStatus.PAINTING: [ServiceOrderStatus.ASSEMBLY],
    ServiceOrderStatus.ASSEMBLY: [ServiceOrderStatus.POLISHING],
    ServiceOrderStatus.POLISHING: [ServiceOrderStatus.WASHING],
    ServiceOrderStatus.WASHING: [ServiceOrderStatus.FINAL_SURVEY],
    ServiceOrderStatus.FINAL_SURVEY: [ServiceOrderStatus.READY],
    ServiceOrderStatus.READY: [ServiceOrderStatus.DELIVERED],
}


class ServiceOrder(PaddockBaseModel):
    """
    Ordem de Serviço — entidade central do ERP DS Car.
    Reside no schema do tenant.

    Fotos são imutáveis — evidência de sinistro para seguradoras.
    OS de cliente particular exige NF-e/NFS-e ao fechar.
    """

    number = models.PositiveIntegerField(db_index=True, verbose_name="Número da OS")

    # Cliente (referência ao schema public via UUID — sem FK cross-schema)
    customer_id = models.UUIDField(db_index=True, verbose_name="ID do Cliente")
    customer_name = models.CharField(max_length=200, verbose_name="Nome do cliente")  # desnormalizado

    # Veículo
    plate = models.CharField(max_length=10, db_index=True, verbose_name="Placa")
    make = models.CharField(max_length=100, default="", verbose_name="Marca")
    model = models.CharField(max_length=100, default="", verbose_name="Modelo")
    year = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name="Ano")
    color = models.CharField(max_length=50, default="", verbose_name="Cor")
    mileage_in = models.PositiveIntegerField(null=True, blank=True, verbose_name="KM entrada")
    mileage_out = models.PositiveIntegerField(null=True, blank=True, verbose_name="KM saída")

    # Status Kanban
    status = models.CharField(
        max_length=30,
        choices=ServiceOrderStatus.choices,
        default=ServiceOrderStatus.RECEPTION,
        db_index=True,
        verbose_name="Status",
    )

    # Datas
    opened_at = models.DateTimeField(auto_now_add=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    estimated_delivery = models.DateTimeField(null=True, blank=True)

    # Valores
    parts_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    services_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    @property
    def total(self) -> float:
        """Total da OS = peças + serviços - descontos."""
        return float(self.parts_total + self.services_total - self.discount_total)

    # NF-e
    nfe_key = models.CharField(max_length=44, blank=True, default="", verbose_name="Chave NF-e")
    nfse_number = models.CharField(max_length=20, blank=True, default="", verbose_name="Número NFS-e")

    # IA
    ai_recommendations = models.JSONField(default=list, blank=True)

    class Meta(PaddockBaseModel.Meta):
        db_table = "service_orders_order"
        unique_together = [("number",)]
        verbose_name = "Ordem de Serviço"
        verbose_name_plural = "Ordens de Serviço"

    def __str__(self) -> str:
        return f"OS #{self.number} — {self.plate} ({self.status})"

    def can_transition_to(self, new_status: str) -> bool:
        """Verifica se a transição de status é válida."""
        allowed = VALID_TRANSITIONS.get(self.status, [])
        return new_status in allowed


class ServiceOrderPhoto(models.Model):
    """
    Foto de OS — imutável após upload.
    Soft delete apenas (is_active=False) — S3 key NUNCA é apagado.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.CASCADE, related_name="photos"
    )
    stage = models.CharField(max_length=30, choices=ServiceOrderStatus.choices)
    s3_key = models.CharField(max_length=500, verbose_name="S3 Key")  # imutável
    uploaded_by_id = models.UUIDField()
    uploaded_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)  # soft delete apenas

    class Meta:
        db_table = "service_orders_photo"
        verbose_name = "Foto de OS"
        verbose_name_plural = "Fotos de OS"

    def __str__(self) -> str:
        return f"Foto OS #{self.service_order.number} — {self.stage}"
