"""
Paddock Solutions — Vehicle Catalog App
Catálogo de cores de veículos — schema público.
"""
from django.db import models


class VehicleColor(models.Model):
    """Cores de veículos com hex para preview no frontend."""

    name = models.CharField(max_length=50, unique=True, verbose_name="Nome")
    hex_code = models.CharField(
        max_length=7, help_text="Ex: #C0C0C0", verbose_name="Código hex"
    )

    class Meta:
        app_label = "vehicle_catalog"
        ordering = ["name"]
        verbose_name = "Cor de veículo"
        verbose_name_plural = "Cores de veículos"

    def __str__(self) -> str:
        return f"{self.name} ({self.hex_code})"
