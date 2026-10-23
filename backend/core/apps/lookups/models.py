"""
Paddock Solutions — Lookups Models (schema public)
"""

from django.db import models


class Municipio(models.Model):
    """Município do IBGE (código de 7 dígitos), exigido pela NFS-e."""

    codigo_ibge = models.CharField(max_length=7, primary_key=True)
    nome = models.CharField(max_length=100)
    nome_normalizado = models.CharField(max_length=100, db_index=True)
    uf = models.CharField(max_length=2, db_index=True)

    class Meta:
        ordering = ["nome"]

    def __str__(self) -> str:
        return f"{self.nome}/{self.uf}"
