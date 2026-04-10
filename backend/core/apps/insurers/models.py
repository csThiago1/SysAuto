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
