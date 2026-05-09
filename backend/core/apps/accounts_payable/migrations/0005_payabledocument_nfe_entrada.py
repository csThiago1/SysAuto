from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accounts_payable", "0004_payabledocument_expense_account"),
        ("fiscal", "0010_nfeentrada_auto_import_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="payabledocument",
            name="nfe_entrada",
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="payable_documents",
                to="fiscal.nfeentrada",
                help_text="NF-e de entrada que originou este título.",
            ),
        ),
    ]
