# Adiciona total_seguradora_oficial — valor oficial cobrado da seguradora
# conforme orçamento da fonte (Cilia/IFX/HDI). PREVALECE sobre soma de items
# pra cobrança.
#
# IDEMPOTENTE: usa SeparateDatabaseAndState com SQL ADD COLUMN IF NOT EXISTS
# pra permitir aplicar mesmo se a coluna já foi criada manualmente em algum
# ambiente (caso real em Railway prod 2026-06-25).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service_orders', '0033_swap_expert_fk'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        'ALTER TABLE "service_orders_order" '
                        'ADD COLUMN IF NOT EXISTS "total_seguradora_oficial" '
                        'numeric(12, 2) NULL;'
                    ),
                    reverse_sql=(
                        'ALTER TABLE "service_orders_order" '
                        'DROP COLUMN IF EXISTS "total_seguradora_oficial";'
                    ),
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='serviceorder',
                    name='total_seguradora_oficial',
                    field=models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        help_text='Total oficial da seguradora (Cilia/IFX/HDI) — verdade absoluta',
                        max_digits=12,
                        null=True,
                    ),
                ),
            ],
        ),
    ]
