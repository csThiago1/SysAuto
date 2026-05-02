"""
Paddock Solutions — Inventory — Hierarquia de Localização Física
WMS: Armazem → Rua → Prateleira → Nivel

Nivel é o ponto terminal onde UnidadeFisica e LoteInsumo apontam via FK.
endereco_completo é computed (WMS-4: nunca stored, evita desync).
"""
from django.db import models

from apps.authentication.models import PaddockBaseModel


class Armazem(PaddockBaseModel):
    """Galpão ou pátio — container de nível mais alto."""

    class Tipo(models.TextChoices):
        GALPAO = "galpao", "Galpão"
        PATIO = "patio", "Pátio"

    nome = models.CharField(max_length=80)
    codigo = models.CharField(
        max_length=10,
        help_text="Código curto: G1, G2, PT1.",
    )
    tipo = models.CharField(
        max_length=10,
        choices=Tipo.choices,
        default=Tipo.GALPAO,
    )
    endereco = models.CharField(max_length=200, blank=True, default="")
    responsavel = models.ForeignKey(
        "authentication.GlobalUser",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="armazens_responsavel",
    )
    observacoes = models.TextField(blank=True, default="")

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_armazem"
        verbose_name = "Armazém"
        verbose_name_plural = "Armazéns"
        constraints = [
            models.UniqueConstraint(
                fields=["codigo"],
                condition=models.Q(is_active=True),
                name="unique_armazem_codigo_active",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.codigo} — {self.nome}"


class Rua(PaddockBaseModel):
    """Corredor dentro de um armazém."""

    armazem = models.ForeignKey(
        Armazem,
        on_delete=models.CASCADE,
        related_name="ruas",
    )
    codigo = models.CharField(max_length=10, help_text="R01, R02.")
    descricao = models.CharField(max_length=80, blank=True, default="")
    ordem = models.PositiveIntegerField(default=0)

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_rua"
        verbose_name = "Rua"
        verbose_name_plural = "Ruas"
        constraints = [
            models.UniqueConstraint(
                fields=["armazem", "codigo"],
                condition=models.Q(is_active=True),
                name="unique_rua_armazem_codigo_active",
            ),
        ]
        ordering = ["ordem", "codigo"]

    def __str__(self) -> str:
        return f"{self.armazem.codigo}-{self.codigo}"


class Prateleira(PaddockBaseModel):
    """Estante dentro de uma rua."""

    rua = models.ForeignKey(
        Rua,
        on_delete=models.CASCADE,
        related_name="prateleiras",
    )
    codigo = models.CharField(max_length=10, help_text="P01, P02.")
    descricao = models.CharField(max_length=80, blank=True, default="")
    capacidade_kg = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Peso máximo suportado (kg).",
    )
    ordem = models.PositiveIntegerField(default=0)

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_prateleira"
        verbose_name = "Prateleira"
        verbose_name_plural = "Prateleiras"
        constraints = [
            models.UniqueConstraint(
                fields=["rua", "codigo"],
                condition=models.Q(is_active=True),
                name="unique_prateleira_rua_codigo_active",
            ),
        ]
        ordering = ["ordem", "codigo"]

    def __str__(self) -> str:
        return f"{self.rua}-{self.codigo}"


class Nivel(PaddockBaseModel):
    """Posição individual dentro de uma prateleira. Ponto terminal do endereçamento."""

    prateleira = models.ForeignKey(
        Prateleira,
        on_delete=models.CASCADE,
        related_name="niveis",
    )
    codigo = models.CharField(max_length=10, help_text="N1, N2.")
    descricao = models.CharField(max_length=80, blank=True, default="")
    altura_cm = models.PositiveIntegerField(null=True, blank=True)
    largura_cm = models.PositiveIntegerField(null=True, blank=True)
    profundidade_cm = models.PositiveIntegerField(null=True, blank=True)
    ordem = models.PositiveIntegerField(default=0)

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_nivel"
        verbose_name = "Nível"
        verbose_name_plural = "Níveis"
        constraints = [
            models.UniqueConstraint(
                fields=["prateleira", "codigo"],
                condition=models.Q(is_active=True),
                name="unique_nivel_prateleira_codigo_active",
            ),
        ]
        ordering = ["ordem", "codigo"]
        indexes = [
            models.Index(fields=["prateleira", "ordem"]),
        ]

    @property
    def endereco_completo(self) -> str:
        """WMS-4: computed, nunca stored — evita desync."""
        rua = self.prateleira.rua
        armazem = rua.armazem
        return f"{armazem.codigo}-{rua.codigo}-{self.prateleira.codigo}-{self.codigo}"

    def __str__(self) -> str:
        return self.endereco_completo
