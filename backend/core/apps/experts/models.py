"""
Paddock Solutions — Experts App
Peritos — profissionais que realizam vistorias para seguradoras.
Reside no schema do tenant (peritos podem variar por unidade).
"""
import logging

from django.db import models

from apps.authentication.models import PaddockBaseModel

logger = logging.getLogger(__name__)


class Expert(PaddockBaseModel):
    """
    Perito — profissional que realiza vistorias para seguradoras.

    Cadastro por tenant, pois peritos podem ser diferentes por unidade.
    """

    name = models.CharField(max_length=200, verbose_name="Nome")
    registration_number = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="CREA ou registro profissional",
        verbose_name="Número de registro",
    )
    phone = models.CharField(max_length=20, blank=True, default="", verbose_name="Telefone")
    email = models.EmailField(blank=True, default="", verbose_name="E-mail")
    insurers = models.ManyToManyField(
        "insurers.Insurer",
        blank=True,
        related_name="experts",
        help_text="Seguradoras para as quais este perito atua",
        verbose_name="Seguradoras",
    )
    is_active = models.BooleanField(default=True, verbose_name="Ativo")

    class Meta:
        ordering = ["name"]
        verbose_name = "Perito"
        verbose_name_plural = "Peritos"

    def __str__(self) -> str:
        return self.name
