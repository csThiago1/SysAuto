"""
Items app — migration 0001_initial

Creates:
- items_itemoperationtype
- items_laborcategory
- items_itemoperation

item_so_id em ItemOperation:
- Django ORM state: BigIntegerField (ServiceOrderVersionItem nao existe ainda)
- DB real: coluna item_so_id como FK sem constraint (db_constraint=False)
  via SeparateDatabaseAndState

Quando service_orders/0021 criar ServiceOrderVersionItem, uma migration
items/0003 pode promover o campo para ForeignKey real.
"""
from __future__ import annotations

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("service_orders", "0020_capacity_models"),
    ]

    operations = [
        migrations.CreateModel(
            name="ItemOperationType",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("code", models.CharField(max_length=40, unique=True, verbose_name="Codigo")),
                ("label", models.CharField(max_length=100, verbose_name="Label")),
                ("description", models.TextField(blank=True, verbose_name="Descricao")),
                ("is_active", models.BooleanField(default=True, verbose_name="Ativo")),
                ("sort_order", models.IntegerField(default=0, verbose_name="Ordem")),
            ],
            options={
                "verbose_name": "Tipo de Operacao",
                "verbose_name_plural": "Tipos de Operacao",
                "ordering": ["sort_order", "code"],
            },
        ),
        migrations.CreateModel(
            name="LaborCategory",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("code", models.CharField(max_length=40, unique=True, verbose_name="Codigo")),
                ("label", models.CharField(max_length=100, verbose_name="Label")),
                ("description", models.TextField(blank=True, verbose_name="Descricao")),
                ("is_active", models.BooleanField(default=True, verbose_name="Ativo")),
                ("sort_order", models.IntegerField(default=0, verbose_name="Ordem")),
            ],
            options={
                "verbose_name": "Categoria de Mao de Obra",
                "verbose_name_plural": "Categorias de Mao de Obra",
                "ordering": ["sort_order", "code"],
            },
        ),
        # ItemOperation usa SeparateDatabaseAndState:
        # - Estado Django: BigIntegerField (sem FK — ServiceOrderVersionItem nao existe)
        # - Banco real: coluna como BIGINT com FK sem constraint (ON DELETE CASCADE)
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name="ItemOperation",
                    fields=[
                        (
                            "id",
                            models.BigAutoField(
                                auto_created=True,
                                primary_key=True,
                                serialize=False,
                                verbose_name="ID",
                            ),
                        ),
                        (
                            "item_so_id",
                            models.BigIntegerField(
                                db_index=True,
                                verbose_name="ID do Item de OS",
                                help_text="ID de service_orders.ServiceOrderVersionItem (sem FK constraint).",
                            ),
                        ),
                        (
                            "operation_type",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.PROTECT,
                                related_name="item_operations",
                                to="items.itemoperationtype",
                                verbose_name="Tipo de Operacao",
                            ),
                        ),
                        (
                            "labor_category",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.PROTECT,
                                related_name="item_operations",
                                to="items.laborcategory",
                                verbose_name="Categoria de Mao de Obra",
                            ),
                        ),
                        ("hours", models.DecimalField(decimal_places=2, max_digits=6, verbose_name="Horas")),
                        (
                            "hourly_rate",
                            models.DecimalField(decimal_places=2, max_digits=10, verbose_name="Valor Hora"),
                        ),
                        (
                            "labor_cost",
                            models.DecimalField(
                                decimal_places=2,
                                help_text="hours * hourly_rate",
                                max_digits=14,
                                verbose_name="Custo Mao de Obra",
                            ),
                        ),
                    ],
                    options={
                        "verbose_name": "Operacao de Item",
                        "verbose_name_plural": "Operacoes de Item",
                        "ordering": ["id"],
                    },
                ),
            ],
            database_operations=[
                migrations.RunSQL(
                    sql="""
                        CREATE TABLE IF NOT EXISTS "items_itemoperation" (
                            "id" bigserial NOT NULL PRIMARY KEY,
                            "item_so_id" bigint NOT NULL,
                            "operation_type_id" integer NOT NULL
                                REFERENCES "items_itemoperationtype" ("id") DEFERRABLE INITIALLY DEFERRED,
                            "labor_category_id" integer NOT NULL
                                REFERENCES "items_laborcategory" ("id") DEFERRABLE INITIALLY DEFERRED,
                            "hours" numeric(6, 2) NOT NULL,
                            "hourly_rate" numeric(10, 2) NOT NULL,
                            "labor_cost" numeric(14, 2) NOT NULL
                        );
                        CREATE INDEX IF NOT EXISTS "items_itemoperation_item_so_id_idx"
                            ON "items_itemoperation" ("item_so_id");
                    """,
                    reverse_sql='DROP TABLE IF EXISTS "items_itemoperation";',
                ),
            ],
        ),
    ]
