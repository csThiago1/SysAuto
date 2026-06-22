"""Swap CodigoFornecedorPeca.fornecedor: pricing_catalog.Fornecedor → persons.Person."""
from django.db import migrations, models


def backfill(apps, schema_editor):
    CodigoFornecedorPeca = apps.get_model("pricing_catalog", "CodigoFornecedorPeca")
    Fornecedor = apps.get_model("pricing_catalog", "Fornecedor")

    fornec_to_person = {
        f.id: f.pessoa_id for f in Fornecedor.objects.exclude(pessoa__isnull=True)
    }

    for cfp in CodigoFornecedorPeca.objects.all():
        cfp.person_fornecedor_id = fornec_to_person.get(cfp.fornecedor_id)
        cfp.save(update_fields=["person_fornecedor"])


class Migration(migrations.Migration):

    dependencies = [
        ("pricing_catalog", "0002_pecacanonica_ncm"),
        ("persons", "0013_backfill_persons_from_legacy"),
    ]

    operations = [
        migrations.AddField(
            model_name="codigofornecedorpeca",
            name="person_fornecedor",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=models.deletion.CASCADE,
                related_name="codigos_peca_new",
                to="persons.person",
            ),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
        migrations.RemoveField(model_name="codigofornecedorpeca", name="fornecedor"),
        migrations.RenameField(
            model_name="codigofornecedorpeca",
            old_name="person_fornecedor",
            new_name="fornecedor",
        ),
        migrations.AlterField(
            model_name="codigofornecedorpeca",
            name="fornecedor",
            field=models.ForeignKey(
                on_delete=models.deletion.CASCADE,
                related_name="codigos_peca",
                to="persons.person",
                limit_choices_to={"roles__role": "SUPPLIER"},
                verbose_name="Fornecedor",
            ),
        ),
    ]
