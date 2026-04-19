"""
Paddock Solutions — Pricing Benchmark — Migration 0001_initial
MO-8: BenchmarkFonte, BenchmarkIngestao, BenchmarkAmostra, SugestaoIA
"""
import uuid
from decimal import Decimal

import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("authentication", "0003_globaluser_push_token"),
        ("pricing_catalog", "0001_initial"),
        ("pricing_profile", "0001_initial"),
        ("persons", "0001_initial"),
        ("quotes", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="BenchmarkFonte",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("nome", models.CharField(max_length=100)),
                (
                    "tipo",
                    models.CharField(
                        choices=[
                            ("seguradora_pdf", "Relatório PDF de seguradora"),
                            ("seguradora_json", "API JSON de seguradora"),
                            ("cotacao_externa", "Cotação manual / marketplace"),
                            ("concorrente", "Auditoria de concorrente"),
                        ],
                        max_length=30,
                    ),
                ),
                (
                    "confiabilidade",
                    models.DecimalField(
                        decimal_places=2,
                        default=Decimal("0.8"),
                        max_digits=3,
                        validators=[
                            django.core.validators.MinValueValidator(Decimal("0")),
                            django.core.validators.MaxValueValidator(Decimal("1")),
                        ],
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                (
                    "empresa",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="benchmark_fontes",
                        to="pricing_profile.empresa",
                    ),
                ),
                (
                    "fornecedor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="persons.person",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Fonte de Benchmark",
                "verbose_name_plural": "Fontes de Benchmark",
            },
        ),
        migrations.CreateModel(
            name="BenchmarkIngestao",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("arquivo", models.FileField(blank=True, null=True, upload_to="benchmark/ingestoes/")),
                ("metadados", models.JSONField(default=dict)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("recebido", "Recebido"),
                            ("processando", "Processando"),
                            ("concluido", "Concluído"),
                            ("erro", "Erro"),
                        ],
                        default="recebido",
                        max_length=20,
                    ),
                ),
                ("iniciado_em", models.DateTimeField(blank=True, null=True)),
                ("concluido_em", models.DateTimeField(blank=True, null=True)),
                ("amostras_importadas", models.PositiveIntegerField(default=0)),
                ("amostras_descartadas", models.PositiveIntegerField(default=0)),
                ("log_erro", models.TextField(blank=True)),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                (
                    "criado_por",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="authentication.globaluser",
                    ),
                ),
                (
                    "fonte",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="ingestoes",
                        to="pricing_benchmark.benchmarkfonte",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Ingestão de Benchmark",
                "verbose_name_plural": "Ingestões de Benchmark",
                "ordering": ["-criado_em"],
            },
        ),
        migrations.CreateModel(
            name="BenchmarkAmostra",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "tipo_item",
                    models.CharField(
                        choices=[("servico", "Serviço"), ("peca", "Peça")],
                        max_length=10,
                    ),
                ),
                ("descricao_bruta", models.TextField()),
                (
                    "alias_match_confianca",
                    models.DecimalField(
                        blank=True, decimal_places=2, max_digits=3, null=True,
                    ),
                ),
                ("veiculo_marca", models.CharField(blank=True, max_length=60)),
                ("veiculo_modelo", models.CharField(blank=True, max_length=100)),
                ("veiculo_ano", models.PositiveIntegerField(blank=True, null=True)),
                ("valor_praticado", models.DecimalField(decimal_places=2, max_digits=12)),
                ("moeda", models.CharField(default="BRL", max_length=3)),
                ("data_referencia", models.DateField()),
                ("metadados", models.JSONField(default=dict)),
                ("revisado", models.BooleanField(default=False)),
                ("descartada", models.BooleanField(default=False)),
                ("motivo_descarte", models.CharField(blank=True, max_length=200)),
                (
                    "fonte",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        to="pricing_benchmark.benchmarkfonte",
                    ),
                ),
                (
                    "ingestao",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="amostras",
                        to="pricing_benchmark.benchmarkingestao",
                    ),
                ),
                (
                    "peca_canonica",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="pricing_catalog.pecacanonica",
                    ),
                ),
                (
                    "revisado_por",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="amostras_revisadas",
                        to="authentication.globaluser",
                    ),
                ),
                (
                    "segmento",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="pricing_profile.segmentoveicular",
                    ),
                ),
                (
                    "servico_canonico",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="pricing_catalog.servicocanonico",
                    ),
                ),
                (
                    "tamanho",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="pricing_profile.categoriatamanho",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Amostra de Benchmark",
                "verbose_name_plural": "Amostras de Benchmark",
            },
        ),
        migrations.AddIndex(
            model_name="benchmarkamostra",
            index=models.Index(
                fields=["servico_canonico", "segmento", "tamanho", "data_referencia"],
                name="bm_amostra_servico_seg_tam_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="benchmarkamostra",
            index=models.Index(
                fields=["peca_canonica", "data_referencia"],
                name="bm_amostra_peca_data_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="benchmarkamostra",
            index=models.Index(
                fields=["ingestao", "descartada"],
                name="bm_amostra_ingestao_desc_idx",
            ),
        ),
        migrations.CreateModel(
            name="SugestaoIA",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("briefing", models.TextField()),
                ("veiculo_info", models.JSONField()),
                ("resposta_raw", models.JSONField()),
                (
                    "avaliacao",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("util", "Útil"),
                            ("parcial", "Parcial"),
                            ("ruim", "Ruim"),
                        ],
                        max_length=20,
                    ),
                ),
                ("modelo_usado", models.CharField(default="claude-sonnet-4-6", max_length=50)),
                ("tempo_resposta_ms", models.PositiveIntegerField(blank=True, null=True)),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                (
                    "criado_por",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="sugestoes_ia",
                        to="authentication.globaluser",
                    ),
                ),
                (
                    "orcamento",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="sugestoes_ia",
                        to="quotes.orcamento",
                    ),
                ),
                (
                    "pecas_aceitas",
                    models.ManyToManyField(
                        blank=True,
                        related_name="sugestoes_aceitas",
                        to="pricing_catalog.pecacanonica",
                    ),
                ),
                (
                    "servicos_aceitos",
                    models.ManyToManyField(
                        blank=True,
                        related_name="sugestoes_aceitas",
                        to="pricing_catalog.servicocanonico",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Sugestão IA",
                "verbose_name_plural": "Sugestões IA",
                "ordering": ["-criado_em"],
            },
        ),
    ]
