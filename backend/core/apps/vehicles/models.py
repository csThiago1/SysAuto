"""Veículos físicos vinculados a OS e placa.

FK version aponta para vehicle_catalog.VehicleYearVersion (catálogo FIPE compartilhado).
Nullable porque a API externa pode não encontrar a versão FIPE exata para a placa.
"""
import logging

from django.db import models

logger = logging.getLogger(__name__)


class Vehicle(models.Model):
    """Instância física de veículo identificada por placa."""

    # Placa normalizada: ABC1D23 (sem hífen, maiúsculo)
    plate = models.CharField(max_length=10, db_index=True)

    # FK para catálogo FIPE compartilhado (nullable — pode não existir)
    version = models.ForeignKey(
        "vehicle_catalog.VehicleYearVersion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tenant_vehicles",
    )

    # Fallback quando versão FIPE não encontrada
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
        """Nome para exibição: catálogo FIPE ou descrição livre."""
        return self.version.full_name if self.version else self.description
