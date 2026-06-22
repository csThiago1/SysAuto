# Generated for issue #11 — guarda último orçamento Cilia na própria OS
# pra busca/UI sem JOIN com ServiceOrderVersion.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service_orders', '0031_add_external_invoice'),
    ]

    operations = [
        migrations.AddField(
            model_name='serviceorder',
            name='cilia_budget_number',
            field=models.CharField(
                blank=True,
                db_index=True,
                default='',
                help_text='Número do orçamento Cilia (último importado)',
                max_length=40,
                verbose_name='Orçamento Cilia',
            ),
        ),
        migrations.AddField(
            model_name='serviceorder',
            name='cilia_budget_version',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Versão do orçamento Cilia (último importado)',
                max_length=10,
                verbose_name='Versão Cilia',
            ),
        ),
    ]
