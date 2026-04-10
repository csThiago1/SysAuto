"""
Sprint OS-001 — Adiciona campos da aba de abertura, novos status e StatusTransitionLog.
"""
import uuid as uuid_module

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("service_orders", "0002_customer_fk_to_person"),
        ("insurers", "0001_initial"),
        ("experts", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── Novos campos de abertura ─────────────────────────────────────────
        migrations.AddField(
            model_name="serviceorder",
            name="consultant",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="service_orders_as_consultant",
                to=settings.AUTH_USER_MODEL,
                verbose_name="Consultor",
            ),
        ),
        migrations.AddField(
            model_name="serviceorder",
            name="customer_type",
            field=models.CharField(
                blank=True,
                choices=[("insurer", "Seguradora"), ("private", "Particular")],
                max_length=10,
                null=True,
                verbose_name="Tipo de atendimento",
            ),
        ),
        migrations.AddField(
            model_name="serviceorder",
            name="os_type",
            field=models.CharField(
                blank=True,
                choices=[
                    ("bodywork", "Chapeação"),
                    ("warranty", "Garantia"),
                    ("rework", "Retrabalho"),
                    ("mechanical", "Mecânica"),
                    ("aesthetic", "Estética"),
                ],
                max_length=20,
                null=True,
                verbose_name="Tipo de OS",
            ),
        ),
        # ── Seguradora ───────────────────────────────────────────────────────
        migrations.AddField(
            model_name="serviceorder",
            name="insurer",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="service_orders",
                to="insurers.insurer",
                verbose_name="Seguradora",
            ),
        ),
        migrations.AddField(
            model_name="serviceorder",
            name="insured_type",
            field=models.CharField(
                blank=True,
                choices=[("insured", "Segurado"), ("third", "Terceiro")],
                help_text="Segurado ou Terceiro — só quando customer_type='insurer'",
                max_length=10,
                null=True,
                verbose_name="Tipo de segurado",
            ),
        ),
        migrations.AddField(
            model_name="serviceorder",
            name="casualty_number",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Número do sinistro",
                max_length=50,
                verbose_name="Número do sinistro",
            ),
        ),
        migrations.AddField(
            model_name="serviceorder",
            name="deductible_amount",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Valor da franquia — só quando insured_type='insured'",
                max_digits=10,
                null=True,
                verbose_name="Franquia",
            ),
        ),
        migrations.AddField(
            model_name="serviceorder",
            name="broker_name",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Nome do corretor (opcional)",
                max_length=200,
                verbose_name="Corretor",
            ),
        ),
        migrations.AddField(
            model_name="serviceorder",
            name="expert",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="service_orders",
                to="experts.expert",
                verbose_name="Perito",
            ),
        ),
        migrations.AddField(
            model_name="serviceorder",
            name="expert_date",
            field=models.DateField(
                blank=True,
                null=True,
                help_text="Data de visita do perito",
                verbose_name="Data do perito",
            ),
        ),
        migrations.AddField(
            model_name="serviceorder",
            name="survey_date",
            field=models.DateField(
                blank=True,
                null=True,
                help_text="Data da vistoria (seguradora)",
                verbose_name="Data da vistoria",
            ),
        ),
        migrations.AddField(
            model_name="serviceorder",
            name="authorization_date",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="Data/hora de autorização — ALTERA STATUS automaticamente",
                verbose_name="Data de autorização",
            ),
        ),
        # ── Particular ───────────────────────────────────────────────────────
        migrations.AddField(
            model_name="serviceorder",
            name="quotation_date",
            field=models.DateField(
                blank=True,
                null=True,
                help_text="Data de orçamentação (particular)",
                verbose_name="Data do orçamento",
            ),
        ),
        # ── Veículo extra ────────────────────────────────────────────────────
        migrations.AddField(
            model_name="serviceorder",
            name="chassis",
            field=models.CharField(
                blank=True, default="", max_length=17, verbose_name="Chassi"
            ),
        ),
        migrations.AddField(
            model_name="serviceorder",
            name="fuel_type",
            field=models.CharField(
                blank=True, default="", max_length=30, verbose_name="Combustível"
            ),
        ),
        migrations.AddField(
            model_name="serviceorder",
            name="fipe_value",
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=12, null=True, verbose_name="Valor FIPE"
            ),
        ),
        # ── Entrada do veículo ───────────────────────────────────────────────
        migrations.AddField(
            model_name="serviceorder",
            name="vehicle_location",
            field=models.CharField(
                choices=[("in_transit", "Em Trânsito"), ("workshop", "Na Oficina")],
                default="workshop",
                max_length=15,
                verbose_name="Local do veículo",
            ),
        ),
        migrations.AddField(
            model_name="serviceorder",
            name="entry_date",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="Data/hora de entrada do veículo na oficina",
                verbose_name="Data de entrada",
            ),
        ),
        migrations.AddField(
            model_name="serviceorder",
            name="service_authorization_date",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="Data/hora de autorização do serviço",
                verbose_name="Autorização do serviço",
            ),
        ),
        # ── Agendamento ──────────────────────────────────────────────────────
        migrations.AddField(
            model_name="serviceorder",
            name="scheduling_date",
            field=models.DateTimeField(
                blank=True, null=True, verbose_name="Data de agendamento"
            ),
        ),
        migrations.AddField(
            model_name="serviceorder",
            name="repair_days",
            field=models.PositiveSmallIntegerField(
                blank=True,
                null=True,
                help_text="Dias estimados de reparo",
                verbose_name="Dias de reparo",
            ),
        ),
        migrations.AddField(
            model_name="serviceorder",
            name="estimated_delivery_date",
            field=models.DateField(
                blank=True,
                null=True,
                help_text="Previsão de entrega (calculada: entry + repair_days)",
                verbose_name="Previsão de entrega",
            ),
        ),
        migrations.AddField(
            model_name="serviceorder",
            name="delivery_date",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="Data/hora real de entrega",
                verbose_name="Data de entrega",
            ),
        ),
        # ── Vistoria final ───────────────────────────────────────────────────
        migrations.AddField(
            model_name="serviceorder",
            name="final_survey_date",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="Data/hora da vistoria final — ALTERA STATUS automaticamente",
                verbose_name="Vistoria final",
            ),
        ),
        migrations.AddField(
            model_name="serviceorder",
            name="client_delivery_date",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="Data/hora de entrega ao cliente — ALTERA STATUS automaticamente",
                verbose_name="Entrega ao cliente",
            ),
        ),
        # ── Financeiro ───────────────────────────────────────────────────────
        migrations.AddField(
            model_name="serviceorder",
            name="invoice_issued",
            field=models.BooleanField(default=False, verbose_name="NF emitida"),
        ),
        # ── Atualizar status choices (novos: waiting_auth, authorized) ───────
        migrations.AlterField(
            model_name="serviceorder",
            name="status",
            field=models.CharField(
                choices=[
                    ("reception", "Recepção"),
                    ("initial_survey", "Vistoria Inicial"),
                    ("budget", "Orçamento"),
                    ("waiting_auth", "Aguardando Autorização"),
                    ("authorized", "Autorizada"),
                    ("waiting_parts", "Aguardando Peças"),
                    ("repair", "Reparo"),
                    ("mechanic", "Mecânica"),
                    ("bodywork", "Funilaria"),
                    ("painting", "Pintura"),
                    ("assembly", "Montagem"),
                    ("polishing", "Polimento"),
                    ("washing", "Lavagem"),
                    ("final_survey", "Vistoria Final"),
                    ("ready", "Pronto para Entrega"),
                    ("delivered", "Entregue"),
                    ("cancelled", "Cancelada"),
                ],
                db_index=True,
                default="reception",
                max_length=20,
                verbose_name="Status",
            ),
        ),
        # ── Índices ──────────────────────────────────────────────────────────
        migrations.AddIndex(
            model_name="serviceorder",
            index=models.Index(fields=["customer_type"], name="so_customer_type_idx"),
        ),
        migrations.AddIndex(
            model_name="serviceorder",
            index=models.Index(
                fields=["insurer", "casualty_number"], name="so_insurer_casualty_idx"
            ),
        ),
        # ── StatusTransitionLog ──────────────────────────────────────────────
        migrations.CreateModel(
            name="StatusTransitionLog",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid_module.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("from_status", models.CharField(max_length=20, verbose_name="Status anterior")),
                ("to_status", models.CharField(max_length=20, verbose_name="Novo status")),
                (
                    "triggered_by_field",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Campo que disparou a transição automática (vazio = manual)",
                        max_length=50,
                        verbose_name="Campo gatilho",
                    ),
                ),
                (
                    "changed_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Alterado por",
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
                (
                    "service_order",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="transition_logs",
                        to="service_orders.serviceorder",
                        verbose_name="OS",
                    ),
                ),
            ],
            options={
                "verbose_name": "Log de transição",
                "verbose_name_plural": "Logs de transição",
                "ordering": ["-created_at"],
                "abstract": False,
            },
        ),
    ]
