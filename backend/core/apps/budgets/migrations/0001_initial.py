# backend/core/apps/budgets/migrations/0001_initial.py
from __future__ import annotations

import decimal
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("persons", "0004_person_job_title_department_choices"),
        ("service_orders", "0021_versioning_and_events"),
    ]

    operations = [
        migrations.CreateModel(
            name="Budget",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("number", models.CharField(db_index=True, max_length=20, unique=True)),
                ("vehicle_plate", models.CharField(db_index=True, max_length=10)),
                ("vehicle_description", models.CharField(max_length=200)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("cloned_from", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="clones", to="budgets.budget",
                )),
                ("customer", models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="budgets", to="persons.person",
                )),
                ("service_order", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="source_budgets",
                    to="service_orders.serviceorder",
                )),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="BudgetVersion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("version_number", models.IntegerField()),
                ("status", models.CharField(
                    choices=[
                        ("draft", "Rascunho"), ("sent", "Enviado ao cliente"),
                        ("approved", "Aprovado"), ("rejected", "Rejeitado"),
                        ("expired", "Expirado"), ("revision", "Em revisão"),
                        ("superseded", "Superado"),
                    ],
                    db_index=True, default="draft", max_length=20,
                )),
                ("valid_until", models.DateTimeField(blank=True, null=True)),
                ("subtotal", models.DecimalField(decimal_places=2, default=decimal.Decimal("0"), max_digits=14)),
                ("discount_total", models.DecimalField(decimal_places=2, default=decimal.Decimal("0"), max_digits=14)),
                ("net_total", models.DecimalField(decimal_places=2, default=decimal.Decimal("0"), max_digits=14)),
                ("labor_total", models.DecimalField(decimal_places=2, default=decimal.Decimal("0"), max_digits=14)),
                ("parts_total", models.DecimalField(decimal_places=2, default=decimal.Decimal("0"), max_digits=14)),
                ("content_hash", models.CharField(blank=True, default="", max_length=64)),
                ("pdf_s3_key", models.CharField(blank=True, default="", max_length=500)),
                ("created_by", models.CharField(blank=True, default="", max_length=120)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                ("approved_by", models.CharField(blank=True, default="", max_length=120)),
                ("approval_evidence_s3_key", models.CharField(blank=True, default="", max_length=500)),
                ("budget", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="versions", to="budgets.budget",
                )),
            ],
            options={
                "ordering": ["-version_number"],
                "indexes": [
                    models.Index(fields=["status", "valid_until"], name="bv_status_valid_idx"),
                ],
            },
        ),
        migrations.AlterUniqueTogether(
            name="budgetversion",
            unique_together={("budget", "version_number")},
        ),
        migrations.CreateModel(
            name="BudgetVersionItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("bucket", models.CharField(
                    choices=[
                        ("IMPACTO", "Impacto"),
                        ("SEM_COBERTURA", "Sem Cobertura"),
                        ("SOB_ANALISE", "Sob Análise"),
                    ],
                    db_index=True, default="IMPACTO", max_length=20,
                )),
                ("payer_block", models.CharField(
                    choices=[
                        ("SEGURADORA", "Seguradora"),
                        ("COMPLEMENTO_PARTICULAR", "Complemento Particular"),
                        ("FRANQUIA", "Franquia"),
                        ("PARTICULAR", "Particular"),
                    ],
                    db_index=True, default="PARTICULAR", max_length=30,
                )),
                ("impact_area", models.IntegerField(blank=True, db_index=True, null=True)),
                ("item_type", models.CharField(
                    choices=[
                        ("PART", "Peça"), ("SERVICE", "Serviço"),
                        ("EXTERNAL_SERVICE", "Serviço Externo"),
                        ("FEE", "Taxa"), ("DISCOUNT", "Desconto"),
                    ],
                    default="PART", max_length=20,
                )),
                ("description", models.CharField(max_length=300)),
                ("external_code", models.CharField(blank=True, default="", max_length=60)),
                ("part_type", models.CharField(
                    blank=True,
                    choices=[
                        ("GENUINA", "Genuína"), ("ORIGINAL", "Original"),
                        ("OUTRAS_FONTES", "Outras Fontes"), ("VERDE", "Verde (Reciclada)"),
                    ],
                    default="", max_length=20,
                )),
                ("supplier", models.CharField(
                    choices=[("OFICINA", "Oficina"), ("SEGURADORA", "Seguradora")],
                    default="OFICINA", max_length=20,
                )),
                ("quantity", models.DecimalField(decimal_places=3, default=decimal.Decimal("1"), max_digits=10)),
                ("unit_price", models.DecimalField(decimal_places=2, default=decimal.Decimal("0"), max_digits=14)),
                ("unit_cost", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("discount_pct", models.DecimalField(decimal_places=2, default=decimal.Decimal("0"), max_digits=5)),
                ("net_price", models.DecimalField(decimal_places=2, default=decimal.Decimal("0"), max_digits=14)),
                ("flag_abaixo_padrao", models.BooleanField(default=False)),
                ("flag_acima_padrao", models.BooleanField(default=False)),
                ("flag_inclusao_manual", models.BooleanField(default=False)),
                ("flag_codigo_diferente", models.BooleanField(default=False)),
                ("flag_servico_manual", models.BooleanField(default=False)),
                ("flag_peca_da_conta", models.BooleanField(default=False)),
                ("sort_order", models.IntegerField(default=0)),
                ("version", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="items", to="budgets.budgetversion",
                )),
            ],
            options={"abstract": False, "ordering": ["sort_order", "id"]},
        ),
    ]
