# Generated manually — MO-6: Motor de Precificação
# Adiciona MargemOperacao, MarkupPeca, CalculoCustoSnapshot.

import django.core.validators
import django.db.models.deletion
import uuid
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pricing_engine", "0001_initial"),
        ("pricing_catalog", "0001_initial"),
        ("pricing_profile", "0002_enquadramento_faltante"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="MargemOperacao",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "tipo_operacao",
                    models.CharField(
                        choices=[
                            ("servico_mao_obra", "Serviço / Mão de obra"),
                            ("peca_revenda", "Peça (revenda)"),
                            ("insumo_comp", "Insumo complementar"),
                        ],
                        max_length=30,
                        verbose_name="Tipo de operação",
                    ),
                ),
                (
                    "margem_percentual",
                    models.DecimalField(
                        decimal_places=4,
                        max_digits=5,
                        validators=[
                            django.core.validators.MinValueValidator(Decimal("0")),
                            django.core.validators.MaxValueValidator(Decimal("5")),
                        ],
                        verbose_name="Margem percentual",
                        help_text="Margem base, ex: 0.4000 = 40%. Multiplicada por (1 + fator_responsabilidade) no cálculo final.",
                    ),
                ),
                ("vigente_desde", models.DateField(verbose_name="Vigente desde")),
                (
                    "vigente_ate",
                    models.DateField(
                        blank=True, null=True, verbose_name="Vigente até"
                    ),
                ),
                (
                    "empresa",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="margens",
                        to="pricing_profile.empresa",
                        verbose_name="Empresa",
                    ),
                ),
                (
                    "segmento",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="margens",
                        to="pricing_profile.segmentoveicular",
                        verbose_name="Segmento veicular",
                    ),
                ),
            ],
            options={
                "verbose_name": "Margem de Operação",
                "verbose_name_plural": "Margens de Operação",
            },
        ),
        migrations.CreateModel(
            name="MarkupPeca",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "faixa_custo_min",
                    models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        max_digits=12,
                        null=True,
                        verbose_name="Faixa custo mín (R$)",
                    ),
                ),
                (
                    "faixa_custo_max",
                    models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        max_digits=12,
                        null=True,
                        verbose_name="Faixa custo máx (R$)",
                    ),
                ),
                (
                    "margem_percentual",
                    models.DecimalField(
                        decimal_places=4,
                        max_digits=5,
                        validators=[
                            django.core.validators.MinValueValidator(Decimal("0")),
                            django.core.validators.MaxValueValidator(Decimal("5")),
                        ],
                        verbose_name="Margem percentual",
                    ),
                ),
                ("vigente_desde", models.DateField(verbose_name="Vigente desde")),
                (
                    "vigente_ate",
                    models.DateField(
                        blank=True, null=True, verbose_name="Vigente até"
                    ),
                ),
                (
                    "observacao",
                    models.CharField(
                        blank=True, max_length=200, verbose_name="Observação"
                    ),
                ),
                (
                    "empresa",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="markups_peca",
                        to="pricing_profile.empresa",
                        verbose_name="Empresa",
                    ),
                ),
                (
                    "peca_canonica",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="markups",
                        to="pricing_catalog.pecacanonica",
                        verbose_name="Peça canônica",
                    ),
                ),
            ],
            options={
                "verbose_name": "Markup de Peça",
                "verbose_name_plural": "Markups de Peças",
            },
        ),
        migrations.CreateModel(
            name="CalculoCustoSnapshot",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "origem",
                    models.CharField(
                        choices=[
                            ("orcamento_linha", "Linha de orçamento"),
                            ("os_linha", "Linha de OS"),
                            ("simulacao", "Simulação avulsa"),
                        ],
                        max_length=30,
                        verbose_name="Origem",
                    ),
                ),
                (
                    "contexto",
                    models.JSONField(verbose_name="Contexto de cálculo"),
                ),
                (
                    "custo_mo",
                    models.DecimalField(
                        decimal_places=2,
                        default=0,
                        max_digits=18,
                        verbose_name="Custo mão de obra",
                    ),
                ),
                (
                    "custo_insumos",
                    models.DecimalField(
                        decimal_places=2,
                        default=0,
                        max_digits=18,
                        verbose_name="Custo insumos",
                    ),
                ),
                (
                    "rateio",
                    models.DecimalField(
                        decimal_places=2,
                        default=0,
                        max_digits=18,
                        verbose_name="Rateio despesas",
                    ),
                ),
                (
                    "custo_peca_base",
                    models.DecimalField(
                        decimal_places=2,
                        default=0,
                        max_digits=18,
                        verbose_name="Custo peça base",
                    ),
                ),
                (
                    "custo_total_base",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=18,
                        verbose_name="Custo total base",
                        help_text="= custo_mo + custo_insumos + rateio + custo_peca_base",
                    ),
                ),
                (
                    "fator_responsabilidade",
                    models.DecimalField(
                        decimal_places=4,
                        max_digits=5,
                        verbose_name="Fator de responsabilidade",
                    ),
                ),
                (
                    "margem_base",
                    models.DecimalField(
                        decimal_places=4,
                        max_digits=5,
                        verbose_name="Margem base",
                    ),
                ),
                (
                    "margem_ajustada",
                    models.DecimalField(
                        decimal_places=4,
                        max_digits=5,
                        verbose_name="Margem ajustada",
                        help_text="= margem_base × (1 + fator_responsabilidade)",
                    ),
                ),
                (
                    "preco_calculado",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=18,
                        verbose_name="Preço calculado",
                        help_text="= custo_total_base × (1 + margem_ajustada)",
                    ),
                ),
                (
                    "preco_teto_benchmark",
                    models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        max_digits=18,
                        null=True,
                        verbose_name="Preço teto benchmark",
                        help_text="p90 do benchmark por segmento+serviço (MO-8). NULL se indisponível.",
                    ),
                ),
                (
                    "preco_final",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=18,
                        verbose_name="Preço final",
                        help_text="= min(preco_calculado, preco_teto_benchmark) se teto disponível",
                    ),
                ),
                (
                    "decomposicao",
                    models.JSONField(verbose_name="Decomposição detalhada"),
                ),
                (
                    "calculado_em",
                    models.DateTimeField(
                        auto_now_add=True, verbose_name="Calculado em"
                    ),
                ),
                (
                    "calculado_por",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="snapshots_calculados",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Calculado por",
                    ),
                ),
                (
                    "empresa",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="snapshots_custo",
                        to="pricing_profile.empresa",
                        verbose_name="Empresa",
                    ),
                ),
                (
                    "peca_canonica",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="snapshots_custo",
                        to="pricing_catalog.pecacanonica",
                        verbose_name="Peça canônica",
                    ),
                ),
                (
                    "servico_canonico",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="snapshots_custo",
                        to="pricing_catalog.servicocanonico",
                        verbose_name="Serviço canônico",
                    ),
                ),
            ],
            options={
                "verbose_name": "Snapshot de Custo",
                "verbose_name_plural": "Snapshots de Custo",
            },
        ),
        migrations.AddIndex(
            model_name="margemoperacao",
            index=models.Index(
                fields=["empresa", "segmento", "tipo_operacao", "vigente_desde"],
                name="pricing_eng_empresa_segmento_tipo_idx",
            ),
        ),
        migrations.AlterUniqueTogether(
            name="margemoperacao",
            unique_together={("empresa", "segmento", "tipo_operacao", "vigente_desde")},
        ),
        migrations.AddIndex(
            model_name="markuppeca",
            index=models.Index(
                fields=["empresa", "vigente_desde"],
                name="pricing_eng_markup_empresa_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="markuppeca",
            constraint=models.CheckConstraint(
                check=models.Q(
                    models.Q(
                        ("peca_canonica__isnull", False),
                        ("faixa_custo_min__isnull", True),
                    ),
                    models.Q(
                        ("peca_canonica__isnull", True),
                        ("faixa_custo_min__isnull", False),
                    ),
                    _connector="OR",
                ),
                name="markup_peca_ou_faixa",
            ),
        ),
        migrations.AddIndex(
            model_name="calculocustosnapshot",
            index=models.Index(
                fields=["empresa", "servico_canonico", "calculado_em"],
                name="pricing_eng_snap_servico_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="calculocustosnapshot",
            index=models.Index(
                fields=["empresa", "peca_canonica", "calculado_em"],
                name="pricing_eng_snap_peca_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="calculocustosnapshot",
            index=models.Index(
                fields=["origem", "calculado_em"],
                name="pricing_eng_snap_origem_idx",
            ),
        ),
    ]
