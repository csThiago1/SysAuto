"""
Migration 0012 — Sprint M4
Adiciona modelo ChecklistItem para o checklist textual de vistoria.
"""
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("service_orders", "0011_add_slot_checklist_type_to_photo"),
    ]

    operations = [
        migrations.CreateModel(
            name="ChecklistItem",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Criado em")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Atualizado em")),
                (
                    "checklist_type",
                    models.CharField(
                        choices=[
                            ("entrada", "Entrada"),
                            ("acompanhamento", "Acompanhamento"),
                            ("saida", "Saída"),
                        ],
                        default="entrada",
                        max_length=20,
                        verbose_name="Tipo de Checklist",
                    ),
                ),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("bodywork", "Lataria / Pintura"),
                            ("glass", "Vidros"),
                            ("lighting", "Iluminação"),
                            ("tires", "Pneus"),
                            ("interior", "Interior"),
                            ("accessories", "Acessórios"),
                            ("mechanical", "Mecânico Visual"),
                        ],
                        max_length=30,
                        verbose_name="Categoria",
                    ),
                ),
                (
                    "item_key",
                    models.CharField(
                        max_length=60,
                        verbose_name="Chave do Item",
                        help_text="Identificador único do item dentro da categoria",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("ok", "OK"),
                            ("attention", "Atenção"),
                            ("critical", "Crítico"),
                            ("pending", "Pendente"),
                        ],
                        default="pending",
                        max_length=10,
                        verbose_name="Status",
                    ),
                ),
                (
                    "notes",
                    models.TextField(blank=True, default="", verbose_name="Observações"),
                ),
                (
                    "service_order",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="checklist_items",
                        to="service_orders.serviceorder",
                        verbose_name="Ordem de Serviço",
                    ),
                ),
            ],
            options={
                "verbose_name": "Item de Checklist",
                "verbose_name_plural": "Itens de Checklist",
                "db_table": "service_orders_checklist_item",
                "ordering": ["category", "item_key"],
            },
        ),
        migrations.AddConstraint(
            model_name="checklistitem",
            constraint=models.UniqueConstraint(
                fields=["service_order", "checklist_type", "category", "item_key"],
                name="unique_checklist_item_per_os",
            ),
        ),
    ]
