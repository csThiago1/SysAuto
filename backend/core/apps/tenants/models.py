"""
Paddock Solutions — Tenants App
Company (Tenant) + Domain
"""
import uuid

from django.db import models
from django_tenants.models import DomainMixin, TenantMixin


class Company(TenantMixin):
    """
    Empresa/Tenant do sistema Paddock Solutions.

    Cada Company possui seu próprio schema PostgreSQL isolado.
    Reside no schema public.

    Exemplos de slug: 'dscar', 'pecas', 'vidros', 'estetica'
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, verbose_name="Nome da empresa")
    slug = models.SlugField(unique=True, max_length=50, verbose_name="Slug")
    client_slug = models.CharField(
        max_length=50,
        verbose_name="Slug do grupo cliente",
        help_text="Ex: 'grupo-dscar'",
    )
    cnpj = models.CharField(max_length=14, blank=True, default="", verbose_name="CNPJ")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # django-tenants obrigatório
    auto_create_schema = True

    class Meta:
        db_table = "tenants_company"
        verbose_name = "Empresa"
        verbose_name_plural = "Empresas"

    def __str__(self) -> str:
        return f"{self.name} ({self.slug})"

    @property
    def tenant_schema(self) -> str:
        """Schema PostgreSQL do tenant."""
        return self.schema_name


class Domain(DomainMixin):
    """
    Domínio/subdomínio associado a uma Company.
    Ex: dscar.paddock.solutions → Company dscar
    """

    class Meta:
        db_table = "tenants_domain"
        verbose_name = "Domínio"
        verbose_name_plural = "Domínios"
