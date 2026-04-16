"""
Paddock Solutions — Vehicle Catalog App
Catálogo de cores de veículos e dados FIPE — schema público.
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


class VehicleMake(models.Model):
    """Marca de veículo conforme tabela FIPE — ex: Honda, Ford."""

    fipe_id = models.CharField(max_length=10, unique=True, db_index=True)
    nome = models.CharField(max_length=80, unique=True, db_index=True)
    nome_normalizado = models.CharField(
        max_length=80,
        db_index=True,
        help_text="Nome em lowercase sem acentos — usado para fuzzy match e aliases.",
    )

    class Meta:
        app_label = "vehicle_catalog"
        ordering = ["nome"]
        verbose_name = "Marca (FIPE)"
        verbose_name_plural = "Marcas (FIPE)"

    def __str__(self) -> str:
        return self.nome


class VehicleModel(models.Model):
    """Modelo de veículo dentro de uma marca FIPE."""

    marca = models.ForeignKey(
        VehicleMake,
        on_delete=models.CASCADE,
        related_name="modelos",
    )
    fipe_id = models.CharField(max_length=10, db_index=True)
    nome = models.CharField(max_length=120, db_index=True)
    nome_normalizado = models.CharField(max_length=120, db_index=True)

    class Meta:
        app_label = "vehicle_catalog"
        unique_together = [("marca", "fipe_id")]
        ordering = ["nome"]
        verbose_name = "Modelo (FIPE)"
        verbose_name_plural = "Modelos (FIPE)"

    def __str__(self) -> str:
        return f"{self.marca.nome} — {self.nome}"


class VehicleYearVersion(models.Model):
    """Ano + combustível + versão FIPE — ex: '2022 Gasolina EX CVT'."""

    modelo = models.ForeignKey(
        VehicleModel,
        on_delete=models.CASCADE,
        related_name="versoes",
    )
    fipe_id = models.CharField(max_length=20, db_index=True)
    ano = models.IntegerField(db_index=True)
    combustivel = models.CharField(
        max_length=20,
        help_text="gasolina | flex | diesel | eletrico",
    )
    descricao = models.CharField(max_length=200)
    codigo_fipe = models.CharField(max_length=20, blank=True, db_index=True)
    valor_referencia = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "vehicle_catalog"
        unique_together = [("modelo", "fipe_id")]
        ordering = ["ano"]
        verbose_name = "Versão/Ano (FIPE)"
        verbose_name_plural = "Versões/Anos (FIPE)"

    def __str__(self) -> str:
        return f"{self.modelo} ({self.ano}) — {self.combustivel}"
