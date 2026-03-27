import logging

from django.db import models

logger = logging.getLogger(__name__)


class VehicleBrand(models.Model):
    """Marca do catálogo FIPE (schema public — compartilhado entre tenants)."""

    fipe_brand_id = models.IntegerField(unique=True, db_index=True)
    name = models.CharField(max_length=100, db_index=True)
    vehicle_type = models.CharField(
        max_length=20,
        choices=[("car", "Carro"), ("motorcycle", "Moto"), ("truck", "Caminhão")],
        default="car",
        db_index=True,
    )

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class VehicleModel(models.Model):
    """Modelo vinculado a uma marca FIPE."""

    brand = models.ForeignKey(VehicleBrand, on_delete=models.CASCADE, related_name="models")
    fipe_model_id = models.IntegerField(db_index=True)
    name = models.CharField(max_length=200, db_index=True)

    class Meta:
        ordering = ["name"]
        unique_together = [("brand", "fipe_model_id")]

    def __str__(self) -> str:
        return f"{self.brand.name} {self.name}"


class VehicleVersion(models.Model):
    """Versão/ano de um modelo — contém fipe_code único."""

    model = models.ForeignKey(VehicleModel, on_delete=models.CASCADE, related_name="versions")
    fipe_code = models.CharField(max_length=20, unique=True, db_index=True)
    year_model = models.IntegerField(db_index=True)
    fuel = models.CharField(max_length=20, blank=True, default="")
    # Nome completo: Marca + Modelo + Versão + Ano — usado na OS e no RAG
    full_name = models.CharField(max_length=500, db_index=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self) -> str:
        return self.full_name


class Vehicle(models.Model):
    """Veículo vinculado a uma OS. Placa é a chave de busca principal."""

    plate = models.CharField(max_length=10, db_index=True)
    # Versão FIPE — null enquanto não houver lookup confirmado
    version = models.ForeignKey(
        VehicleVersion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="vehicles",
    )
    # Texto livre para casos sem FIPE confirmado
    description = models.CharField(max_length=200, blank=True, default="")
    color = models.CharField(max_length=50, blank=True, default="")
    year_manufacture = models.IntegerField(null=True, blank=True)
    chassis = models.CharField(max_length=50, blank=True, default="")
    renavam = models.CharField(max_length=20, blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        label = self.version.full_name if self.version else self.description
        return f"{self.plate} — {label}"

    @property
    def display_name(self) -> str:
        return self.version.full_name if self.version else self.description
