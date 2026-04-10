"""
Migration Sprint 05: adiciona notes à OS, e cria ServiceOrderPart e ServiceOrderLabor.
"""
import uuid
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("service_orders", "0005_serviceorderactivitylog"),
        ("inventory", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # notes na OS
        migrations.AddField(
            model_name="serviceorder",
            name="notes",
            field=models.TextField(blank=True, default="", verbose_name="Observações gerais"),
        ),
        # ServiceOrderPart
        migrations.CreateModel(
            name="ServiceOrderPart",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("description", models.CharField(max_length=300, verbose_name="Descrição")),
                ("part_number", models.CharField(blank=True, default="", max_length=100, verbose_name="Código da peça")),
                ("quantity", models.DecimalField(decimal_places=2, default=1, max_digits=10, verbose_name="Quantidade")),
                ("unit_price", models.DecimalField(decimal_places=2, max_digits=12, verbose_name="Preço unitário")),
                ("discount", models.DecimalField(decimal_places=2, default=0, max_digits=12, verbose_name="Desconto")),
                ("created_by", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="serviceorderpart_created",
                    to=settings.AUTH_USER_MODEL,
                )),
                ("product", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="os_parts",
                    to="inventory.product",
                    verbose_name="Produto do catálogo",
                )),
                ("service_order", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="parts",
                    to="service_orders.serviceorder",
                    verbose_name="OS",
                )),
            ],
            options={"db_table": "service_orders_part", "ordering": ["created_at"], "verbose_name": "Peça da OS", "verbose_name_plural": "Peças da OS"},
        ),
        # ServiceOrderLabor
        migrations.CreateModel(
            name="ServiceOrderLabor",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("description", models.CharField(max_length=300, verbose_name="Descrição do serviço")),
                ("quantity", models.DecimalField(decimal_places=2, default=1, max_digits=10, verbose_name="Quantidade / Horas")),
                ("unit_price", models.DecimalField(decimal_places=2, max_digits=12, verbose_name="Valor unitário / Hora")),
                ("discount", models.DecimalField(decimal_places=2, default=0, max_digits=12, verbose_name="Desconto")),
                ("created_by", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="serviceorderlabor_created",
                    to=settings.AUTH_USER_MODEL,
                )),
                ("service_order", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="labor_items",
                    to="service_orders.serviceorder",
                    verbose_name="OS",
                )),
            ],
            options={"db_table": "service_orders_labor", "ordering": ["created_at"], "verbose_name": "Serviço da OS", "verbose_name_plural": "Serviços da OS"},
        ),
    ]
