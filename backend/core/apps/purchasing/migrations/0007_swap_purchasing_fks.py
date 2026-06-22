"""Swap: drop FKs antigas, rename person_* → original names."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [("purchasing", "0006_backfill_person_fks")]

    operations = [
        # ItemOrdemCompra
        migrations.RemoveField(model_name="itemordemcompra", name="fornecedor"),
        migrations.RenameField(
            model_name="itemordemcompra",
            old_name="person_fornecedor",
            new_name="fornecedor",
        ),
        migrations.AlterField(
            model_name="itemordemcompra",
            name="fornecedor",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=models.deletion.SET_NULL,
                related_name="itens_oc",
                to="persons.person",
                limit_choices_to={"roles__role": "SUPPLIER"},
            ),
        ),
        # CotacaoLog.supplier
        migrations.RemoveField(model_name="cotacaolog", name="supplier"),
        migrations.RemoveField(model_name="cotacaolog", name="supplier_contact"),
        migrations.RenameField(
            model_name="cotacaolog",
            old_name="person_supplier",
            new_name="supplier",
        ),
        migrations.RenameField(
            model_name="cotacaolog",
            old_name="person_supplier_contact",
            new_name="supplier_contact",
        ),
        migrations.AlterField(
            model_name="cotacaolog",
            name="supplier",
            field=models.ForeignKey(
                on_delete=models.deletion.CASCADE,
                related_name="cotacoes_recebidas",
                to="persons.person",
                limit_choices_to={"roles__role": "SUPPLIER"},
            ),
        ),
        migrations.AlterField(
            model_name="cotacaolog",
            name="supplier_contact",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=models.deletion.SET_NULL,
                related_name="cotacoes",
                to="persons.personcontact",
            ),
        ),
        # RespostaCotacao.supplier
        migrations.RemoveField(model_name="respostacotacao", name="supplier"),
        migrations.RenameField(
            model_name="respostacotacao",
            old_name="person_supplier",
            new_name="supplier",
        ),
        migrations.AlterField(
            model_name="respostacotacao",
            name="supplier",
            field=models.ForeignKey(
                on_delete=models.deletion.CASCADE,
                related_name="respostas_cotacao",
                to="persons.person",
                limit_choices_to={"roles__role": "SUPPLIER"},
            ),
        ),
    ]
