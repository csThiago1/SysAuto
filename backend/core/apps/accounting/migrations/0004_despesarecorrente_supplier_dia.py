import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0003_fix_object_id_to_charfield"),
        ("accounts_payable", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="despesarecorrente",
            name="supplier",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="despesas_recorrentes",
                to="accounts_payable.supplier",
                verbose_name="Fornecedor",
            ),
        ),
        migrations.AddField(
            model_name="despesarecorrente",
            name="dia_vencimento",
            field=models.PositiveIntegerField(
                default=10,
                help_text="Dia do mês para vencimento do título gerado.",
                verbose_name="Dia de vencimento",
            ),
        ),
    ]
