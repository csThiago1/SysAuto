"""Expand: adiciona 4 FKs Person nullable em ItemOrdemCompra/CotacaoLog/RespostaCotacao."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("purchasing", "0004_itemordemcompra_data_prevista_and_more"),
        ("persons", "0013_backfill_persons_from_legacy"),
    ]

    operations = [
        migrations.AddField(
            model_name="itemordemcompra",
            name="person_fornecedor",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=models.deletion.SET_NULL,
                related_name="itens_oc_new",
                to="persons.person",
            ),
        ),
        migrations.AddField(
            model_name="cotacaolog",
            name="person_supplier",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=models.deletion.CASCADE,
                related_name="cotacoes_recebidas_new",
                to="persons.person",
            ),
        ),
        migrations.AddField(
            model_name="cotacaolog",
            name="person_supplier_contact",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=models.deletion.SET_NULL,
                related_name="cotacoes_new",
                to="persons.personcontact",
            ),
        ),
        migrations.AddField(
            model_name="respostacotacao",
            name="person_supplier",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=models.deletion.CASCADE,
                related_name="respostas_cotacao_new",
                to="persons.person",
            ),
        ),
    ]
