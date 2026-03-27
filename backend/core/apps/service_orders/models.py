from django.db import models

from apps.persons.models import Person


class ServiceOrder(models.Model):
    STATUS_CHOICES = [
        ("reception", "Recepção"),
        ("initial_survey", "Vistoria Inicial"),
        ("budget", "Orçamento"),
        ("waiting_parts", "Aguardando Peças"),
        ("repair", "Reparo"),
        ("mechanic", "Mecânica"),
        ("bodywork", "Funilaria"),
        ("painting", "Pintura"),
        ("assembly", "Montagem"),
        ("polishing", "Polimento"),
        ("washing", "Lavagem"),
        ("final_survey", "Vistoria Final"),
        ("ready", "Pronto para Entrega"),
        ("delivered", "Entregue"),
        ("cancelled", "Cancelada"),
    ]

    os_number = models.CharField(max_length=30, unique=True, db_index=True)
    customer = models.ForeignKey(Person, on_delete=models.PROTECT, related_name="service_orders")
    vehicle_plate = models.CharField(max_length=10, db_index=True)
    vehicle_description = models.CharField(max_length=200)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="reception", db_index=True)
    total_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.os_number} - {self.vehicle_plate}"


class ServiceOrderStatusHistory(models.Model):
    service_order = models.ForeignKey(ServiceOrder, on_delete=models.CASCADE, related_name="status_history")
    from_status = models.CharField(max_length=30)
    to_status = models.CharField(max_length=30)
    changed_by = models.CharField(max_length=120, blank=True, default="Sistema")
    notes = models.TextField(blank=True, default="")
    changed_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-changed_at"]
