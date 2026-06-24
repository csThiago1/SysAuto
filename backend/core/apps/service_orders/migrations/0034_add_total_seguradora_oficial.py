# Adiciona total_seguradora_oficial — valor oficial cobrado da seguradora
# conforme orçamento da fonte (Cilia/IFX/HDI). PREVALECE sobre soma de items
# pra cobrança.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service_orders', '0033_swap_expert_fk'),
    ]

    operations = [
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
    ]
