"""Swap DespesaRecorrente.supplier: accounts_payable.Supplier → persons.Person."""
from django.db import migrations, models


def backfill(apps, schema_editor):
    DespesaRecorrente = apps.get_model("accounting", "DespesaRecorrente")
    SupplierProfile = apps.get_model("persons", "SupplierProfile")

    sup_to_person = {
        sp.legacy_supplier_id: sp.person_id
        for sp in SupplierProfile.objects.exclude(
            legacy_supplier_id__isnull=True
        ).exclude(legacy_supplier_id="")
    }

    for dr in DespesaRecorrente.objects.exclude(supplier__isnull=True):
        legacy_id = str(dr.supplier_id)
        dr.person_id = sup_to_person.get(legacy_id)
        dr.save(update_fields=["person"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0004_despesarecorrente_supplier_dia"),
        ("accounts_payable", "0008_swap_payable_supplier_fk"),
    ]

    operations = [
        migrations.AddField(
            model_name="despesarecorrente",
            name="person",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=models.deletion.SET_NULL,
                related_name="despesas_recorrentes_new",
                to="persons.person",
            ),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
        migrations.RemoveField(model_name="despesarecorrente", name="supplier"),
        migrations.RenameField(
            model_name="despesarecorrente",
            old_name="person",
            new_name="supplier",
        ),
        migrations.AlterField(
            model_name="despesarecorrente",
            name="supplier",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=models.deletion.SET_NULL,
                related_name="despesas_recorrentes",
                to="persons.person",
                limit_choices_to={"roles__role": "SUPPLIER"},
            ),
        ),
    ]
