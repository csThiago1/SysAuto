"""
Paddock Solutions — Vehicle Catalog App
Catálogo FIPE de veículos — schema público.
"""

import re

from django.core.exceptions import ValidationError
from django.db import models

from apps.vehicle_catalog.normalize import Combustivel, TipoVeiculo


class VehicleMake(models.Model):
    """Marca de veículo conforme tabela FIPE — ex: Honda, Ford. Única por (tipo, nome)."""

    tipo = models.CharField(max_length=10, choices=TipoVeiculo.choices, default=TipoVeiculo.CARRO)
    fipe_id = models.CharField(max_length=10, null=True, blank=True, db_index=True)
    nome = models.CharField(max_length=80, db_index=True)
    nome_normalizado = models.CharField(
        max_length=80,
        db_index=True,
        help_text="Nome FIPE normalizado (normalize_name) — chave natural com o tipo.",
    )
    display_name = models.CharField(max_length=80, verbose_name="Nome de exibição")
    logo_url = models.CharField(max_length=500, blank=True, default="", verbose_name="URL do logo")
    is_active = models.BooleanField(default=True)
    fonte_ref = models.CharField(max_length=7, blank=True, help_text='Mês da fonte, ex: "2026-10".')

    class Meta:
        app_label = "vehicle_catalog"
        ordering = ["nome"]
        verbose_name = "Marca (FIPE)"
        verbose_name_plural = "Marcas (FIPE)"
        constraints = [
            models.UniqueConstraint(
                fields=["tipo", "nome_normalizado"], name="uniq_vehiclemake_tipo_nome"
            )
        ]

    def __str__(self) -> str:
        return self.nome


class VehicleFamily(models.Model):
    """Família — o "Modelo" que o usuário vê (ex: Onix, Montana). Agrupa versões FIPE."""

    make = models.ForeignKey(VehicleMake, on_delete=models.PROTECT, related_name="familias")
    nome = models.CharField(max_length=80)
    nome_normalizado = models.CharField(max_length=80, db_index=True)
    is_active = models.BooleanField(default=True)
    fonte_ref = models.CharField(max_length=7, blank=True, help_text='Mês da fonte, ex: "2026-10".')

    class Meta:
        app_label = "vehicle_catalog"
        ordering = ["nome"]
        verbose_name = "Família (modelo)"
        verbose_name_plural = "Famílias (modelos)"
        constraints = [
            models.UniqueConstraint(
                fields=["make", "nome_normalizado"], name="uniq_vehiclefamily_make_nome"
            )
        ]

    def __str__(self) -> str:
        return f"{self.make.nome} — {self.nome}"


class VehicleFamilyRule(models.Model):
    """Exceção à derivação de família: regex sobre o nome FIPE normalizado da versão."""

    marca_nome_normalizado = models.CharField(
        max_length=80, help_text="Nome FIPE da marca normalizado, ex: GM - CHEVROLET."
    )
    tipo = models.CharField(max_length=10, choices=TipoVeiculo.choices, default=TipoVeiculo.CARRO)
    padrao = models.CharField(
        max_length=200, help_text="Regex aplicada com re.match ao nome FIPE normalizado."
    )
    familia = models.CharField(max_length=80, help_text=r"Nome da família; aceita \1 do padrão.")
    is_active = models.BooleanField(default=True)

    class Meta:
        app_label = "vehicle_catalog"
        ordering = ["marca_nome_normalizado", "pk"]
        verbose_name = "Regra de família"
        verbose_name_plural = "Regras de família"

    def __str__(self) -> str:
        return f"{self.marca_nome_normalizado}: {self.padrao} → {self.familia}"

    def clean(self) -> None:
        try:
            re.compile(self.padrao)
        except re.error as exc:
            raise ValidationError({"padrao": f"Regex inválida: {exc}"}) from exc


class VehicleModel(models.Model):
    """Versão FIPE (ex: "ONIX HATCH LT 1.0 12V Flex 5p Mec."). Única por (tipo, codigo_fipe)."""

    marca = models.ForeignKey(
        VehicleMake,
        on_delete=models.PROTECT,
        related_name="modelos",
    )
    familia = models.ForeignKey(
        VehicleFamily,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="versoes_fipe",
    )
    tipo = models.CharField(max_length=10, choices=TipoVeiculo.choices, default=TipoVeiculo.CARRO)
    codigo_fipe = models.CharField(max_length=10)
    fipe_id = models.CharField(max_length=10, null=True, blank=True, db_index=True)
    nome = models.CharField(max_length=120, db_index=True)
    nome_normalizado = models.CharField(max_length=120, db_index=True)
    is_active = models.BooleanField(default=True)
    fonte_ref = models.CharField(max_length=7, blank=True, help_text='Mês da fonte, ex: "2026-10".')

    class Meta:
        app_label = "vehicle_catalog"
        ordering = ["nome"]
        verbose_name = "Modelo (FIPE)"
        verbose_name_plural = "Modelos (FIPE)"
        constraints = [
            models.UniqueConstraint(
                fields=["tipo", "codigo_fipe"], name="uniq_vehiclemodel_tipo_codigo"
            )
        ]

    def __str__(self) -> str:
        return f"{self.marca.nome} — {self.nome}"


class PlateCache(models.Model):
    """
    Cache local de consultas de placa.
    Primeira consulta vai à API externa; subsequentes retornam daqui.
    """

    plate = models.CharField(max_length=8, unique=True, db_index=True, verbose_name="Placa")
    make = models.CharField(max_length=80, blank=True, default="")
    model = models.CharField(max_length=120, blank=True, default="")
    version = models.CharField(
        max_length=80, blank=True, default="", help_text="Versão/trim ex: LT1, EXL, Premier"
    )
    engine = models.CharField(
        max_length=20, blank=True, default="", help_text="Motorização ex: 1.0T, 2.0, 1.6"
    )
    year = models.IntegerField(null=True, blank=True)
    chassis = models.CharField(max_length=17, blank=True, default="")
    renavam = models.CharField(max_length=11, blank=True, default="")
    city = models.CharField(max_length=80, blank=True, default="")
    color = models.CharField(max_length=40, blank=True, default="")
    fuel_type = models.CharField(max_length=20, blank=True, default="")
    raw_response = models.JSONField(default=dict, help_text="Resposta bruta da API para auditoria.")
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "vehicle_catalog"
        verbose_name = "Cache de Placa"
        verbose_name_plural = "Cache de Placas"
        ordering = ["-fetched_at"]

    def __str__(self) -> str:
        return f"{self.plate} — {self.make} {self.model} {self.year or ''}"


class VehicleYearVersion(models.Model):
    """Ano + combustível de uma versão FIPE — ex: '2022 Gasolina'. Zero km grava ano=32000."""

    modelo = models.ForeignKey(
        VehicleModel,
        on_delete=models.PROTECT,
        related_name="versoes",
    )
    fipe_id = models.CharField(max_length=20, null=True, blank=True, db_index=True)
    ano = models.IntegerField(db_index=True, help_text="Ano-modelo; 32000 = zero km (FIPE).")
    zero_km = models.BooleanField(default=False)
    combustivel = models.CharField(max_length=20, choices=Combustivel.choices)
    descricao = models.CharField(max_length=200)
    codigo_fipe = models.CharField(max_length=20, blank=True, db_index=True)
    valor_referencia = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    is_active = models.BooleanField(default=True)
    fonte_ref = models.CharField(max_length=7, blank=True, help_text='Mês da fonte, ex: "2026-10".')
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "vehicle_catalog"
        ordering = ["ano"]
        verbose_name = "Versão/Ano (FIPE)"
        verbose_name_plural = "Versões/Anos (FIPE)"
        constraints = [
            models.UniqueConstraint(
                fields=["modelo", "ano", "combustivel"], name="uniq_yearversion_modelo_ano_comb"
            )
        ]

    def __str__(self) -> str:
        return f"{self.modelo} ({self.ano}) — {self.combustivel}"

    @property
    def label(self) -> str:
        """Rótulo do seletor: "Zero km Flex" ou "2025 Flex"."""
        ano = "Zero km" if self.zero_km else str(self.ano)
        return f"{ano} {self.get_combustivel_display()}"

    @property
    def full_name(self) -> str:
        """Nome completo para exibição de um veículo com versão FIPE."""
        return " ".join(
            part
            for part in (
                self.modelo.marca.nome,
                self.modelo.nome,
                self.descricao,
            )
            if part
        )


class VehicleAlias(models.Model):
    """Regra aprendida: texto de uma fonte → versão (ou família) confirmada pelo usuário."""

    class Source(models.TextChoices):
        CILIA = "cilia", "Cilia"
        XML_IFX = "xml_ifx", "XML IFX"
        HDI = "hdi", "HDI"
        PLACA = "placa", "Placa"
        ORCAMENTO = "orcamento", "Orçamento"
        QUOTES = "quotes", "Cotações"
        BOX = "box", "Box Empresa"

    source = models.CharField(max_length=20, choices=Source.choices)
    raw_key = models.CharField(max_length=300, help_text="alias_key(texto, ano).")
    version = models.ForeignKey(
        VehicleYearVersion, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    family = models.ForeignKey(
        VehicleFamily, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    confirmacoes = models.PositiveIntegerField(default=1)
    aprovado = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "vehicle_catalog"
        ordering = ["-updated_at"]
        verbose_name = "Regra aprendida"
        verbose_name_plural = "Regras aprendidas"
        constraints = [
            models.UniqueConstraint(
                fields=["source", "raw_key"], name="uniq_vehiclealias_source_key"
            )
        ]

    def __str__(self) -> str:
        return f"{self.source}: {self.raw_key}"

    @property
    def is_exact(self) -> bool:
        """Exata com aprovação do admin ou 2 confirmações iguais da mesma fonte."""
        return self.aprovado or self.confirmacoes >= 2
