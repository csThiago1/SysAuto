# backend/core/apps/items/migrations/0003_fix_fk_column_types.py
"""
Items app — migration 0003_fix_fk_column_types

0001_initial criou operation_type_id e labor_category_id como `integer`
no RunSQL direto, mas os PKs de ItemOperationType e LaborCategory sao
BigAutoField (bigint no PostgreSQL).

Esta migration corrige o tipo das colunas FK para bigint, alinhando
a definicao do banco com o ORM Django.
"""
from __future__ import annotations

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("items", "0002_seed_reference_tables"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE "items_itemoperation"
                    ALTER COLUMN "operation_type_id" TYPE bigint,
                    ALTER COLUMN "labor_category_id" TYPE bigint;
            """,
            reverse_sql="""
                ALTER TABLE "items_itemoperation"
                    ALTER COLUMN "operation_type_id" TYPE integer,
                    ALTER COLUMN "labor_category_id" TYPE integer;
            """,
        ),
    ]
