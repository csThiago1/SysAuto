"""
Paddock Solutions — Insurers App
Seguradoras — schema público, compartilhado entre todos os tenants.
"""
import logging
import uuid

from django.db import models

logger = logging.getLogger(__name__)


class Insurer(models.Model):
    """
    Seguradora — dados compartilhados entre todas as unidades.

    Fica no schema público pois as seguradoras são as mesmas
    independente do tenant.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, unique=True, verbose_name="Razão social")
    trade_name = models.CharField(
        max_length=200, blank=True, default="", verbose_name="Nome fantasia"
    )
    code = models.CharField(
        max_length=40,
        unique=True,
        null=True,
        blank=True,
        default=None,
        db_index=True,
        verbose_name="Código interno",
    )
    cnpj = models.CharField(max_length=18, unique=True, verbose_name="CNPJ")
    brand_color = models.CharField(
        max_length=7,
        default="#000000",
        help_text="Cor hex da marca para exibição na UI (ex: #003DA5)",
        verbose_name="Cor da marca",
    )
    abbreviation = models.CharField(
        max_length=4,
        blank=True,
        default="",
        help_text="Abreviação para avatar/logo (ex: BR, PS, AZ)",
        verbose_name="Abreviação",
    )
    logo_url = models.CharField(
        max_length=500, blank=True, default="", verbose_name="URL do logo"
    )
    uses_cilia = models.BooleanField(
        default=False, 
        verbose_name="Utiliza Cilia?", 
        help_text="Marque se a seguradora envia orçamentos pelo sistema Cilia"
    )
    is_active = models.BooleanField(default=True, verbose_name="Ativo")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Seguradora"
        verbose_name_plural = "Seguradoras"

    def __str__(self) -> str:
        return self.trade_name or self.name


class InsurerTenantProfile(models.Model):
    """
    Perfil operacional da seguradora por empresa do grupo (tenant-level).

    Complementa o registro público Insurer com dados operacionais locais:
    contatos, SLA, portal de acionamento, observações internas.

    Cada empresa (Company) pode ter seu próprio perfil para cada seguradora.
    Isolamento garantido pelo par (insurer, company) — unique_together.
    """

    insurer = models.ForeignKey(
        Insurer,
        on_delete=models.PROTECT,
        related_name="tenant_profiles",
        verbose_name="Seguradora",
    )
    company = models.ForeignKey(
        "tenants.Company",
        on_delete=models.CASCADE,
        related_name="insurer_profiles",
        verbose_name="Empresa",
        null=True,
        blank=True,
    )

    # Contato de sinistros
    contact_sinistro_nome = models.CharField(
        max_length=200, blank=True, default="", verbose_name="Sinistros — Nome"
    )
    contact_sinistro_phone = models.CharField(
        max_length=20, blank=True, default="", verbose_name="Sinistros — Telefone"
    )
    contact_sinistro_email = models.CharField(
        max_length=200, blank=True, default="", verbose_name="Sinistros — E-mail"
    )

    # Contato financeiro
    contact_financeiro_nome = models.CharField(
        max_length=200, blank=True, default="", verbose_name="Financeiro — Nome"
    )
    contact_financeiro_phone = models.CharField(
        max_length=20, blank=True, default="", verbose_name="Financeiro — Telefone"
    )
    contact_financeiro_email = models.CharField(
        max_length=200, blank=True, default="", verbose_name="Financeiro — E-mail"
    )

    # Contato comercial
    contact_comercial_nome = models.CharField(
        max_length=200, blank=True, default="", verbose_name="Comercial — Nome"
    )
    contact_comercial_phone = models.CharField(
        max_length=20, blank=True, default="", verbose_name="Comercial — Telefone"
    )
    contact_comercial_email = models.CharField(
        max_length=200, blank=True, default="", verbose_name="Comercial — E-mail"
    )

    portal_url = models.URLField(
        blank=True, default="", verbose_name="Portal de acionamento (URL)"
    )
    sla_dias_uteis = models.PositiveSmallIntegerField(
        null=True, blank=True, verbose_name="SLA de resposta (dias úteis)"
    )
    observacoes_operacionais = models.TextField(
        blank=True, default="", verbose_name="Observações operacionais"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Perfil Operacional da Seguradora"
        verbose_name_plural = "Perfis Operacionais de Seguradoras"
        unique_together = [("insurer", "company")]

    def __str__(self) -> str:
        company_name = self.company.name if self.company_id else "—"
        return f"Perfil {company_name} — {self.insurer.name}"
