# backend/core/apps/items/migrations/0004_number_sequence_and_item_budget.py
"""
Items 0004 — NumberSequence model + ItemOperation item_budget FK + XOR constraint.

Depends on budgets/0001_initial so the FK to budgets.BudgetVersionItem resolves.
"""
from __future__ import annotations

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("items", "0003_fix_fk_column_types"),
        ("budgets", "0001_initial"),
    ]

    operations = [
        # 1. NumberSequence model
        migrations.CreateModel(
            name="NumberSequence",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("sequence_type", models.CharField(
                    choices=[("BUDGET", "Orçamento Particular"), ("SERVICE_ORDER", "Ordem de Serviço")],
                    max_length=20, unique=True, verbose_name="Tipo de Sequência",
                )),
                ("prefix", models.CharField(max_length=10, verbose_name="Prefixo")),
                ("padding", models.IntegerField(default=6, verbose_name="Padding")),
                ("next_number", models.IntegerField(default=1, verbose_name="Próximo Número")),
            ],
            options={
                "verbose_name": "Sequência de Numeração",
                "verbose_name_plural": "Sequências de Numeração",
            },
        ),
        # 2. Seed BUDGET sequence
        migrations.RunSQL(
            sql=(
                "INSERT INTO items_numbersequence "
                "(sequence_type, prefix, padding, next_number) "
                "VALUES ('BUDGET', 'ORC-2026-', 6, 1) "
                "ON CONFLICT (sequence_type) DO NOTHING;"
            ),
            reverse_sql="DELETE FROM items_numbersequence WHERE sequence_type = 'BUDGET';",
        ),
        # 3. Make item_so_id nullable (budget items have item_so_id=NULL)
        migrations.AlterField(
            model_name="itemoperation",
            name="item_so_id",
            field=models.BigIntegerField(
                blank=True, db_index=True, null=True,
                help_text="ID de service_orders.ServiceOrderVersionItem (sem FK constraint).",
                verbose_name="ID do Item de OS",
            ),
        ),
        # 4. Add item_budget FK
        migrations.AddField(
            model_name="itemoperation",
            name="item_budget",
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="operations",
                to="budgets.budgetversionitem",
                verbose_name="Item de Orçamento",
            ),
        ),
        # 5. XOR constraint: exactly one of item_budget or item_so_id must be non-null
        migrations.AddConstraint(
            model_name="itemoperation",
            constraint=models.CheckConstraint(
                check=(
                    models.Q(item_budget__isnull=False, item_so_id__isnull=True)
                    | models.Q(item_budget__isnull=True, item_so_id__isnull=False)
                ),
                name="itemop_xor_parent",
            ),
        ),
    ]
