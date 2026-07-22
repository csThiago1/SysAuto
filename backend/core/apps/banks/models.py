"""
Paddock Solutions — Banks App
Catálogo de bancos (FEBRABAN) — schema público, compartilhado entre tenants.
Usado como referência p/ dados bancários de fornecedores (persons.SupplierProfile).
"""
from django.db import models


class Bank(models.Model):
    """Banco cadastrado na FEBRABAN — código de 3 dígitos + nome."""

    code = models.CharField(
        max_length=3, unique=True, db_index=True, verbose_name="Código FEBRABAN"
    )
    name = models.CharField(max_length=150, verbose_name="Nome")
    logo_url = models.CharField(
        max_length=500, blank=True, default="", verbose_name="URL do logo"
    )
    is_active = models.BooleanField(default=True, verbose_name="Ativo")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code"]
        verbose_name = "Banco"
        verbose_name_plural = "Bancos"

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"
