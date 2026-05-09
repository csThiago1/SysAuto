from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("fiscal", "0009_add_cce_email_substituicao_fields"),
        ("purchasing", "0001_initial"),
        ("accounts_payable", "0004_payabledocument_expense_account"),
    ]

    operations = [
        migrations.AddField(
            model_name="nfeentrada",
            name="auto_imported",
            field=models.BooleanField(default=False, help_text="True se importada automaticamente via webhook nfe_recebida."),
        ),
        migrations.AddField(
            model_name="nfeentrada",
            name="purchase_order",
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="nfe_entradas",
                to="purchasing.ordemcompra",
                help_text="Pedido de compra vinculado.",
            ),
        ),
        migrations.AddField(
            model_name="nfeentrada",
            name="payable_document",
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="nfe_entradas",
                to="accounts_payable.payabledocument",
                help_text="Conta a pagar gerada automaticamente.",
            ),
        ),
    ]
