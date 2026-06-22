"""Expand: adiciona PayableDocument.person FK (nullable) e popula via legacy_supplier_id."""
from django.db import migrations, models


def backfill_person_from_legacy(apps, schema_editor):
    PayableDocument = apps.get_model("accounts_payable", "PayableDocument")
    SupplierProfile = apps.get_model("persons", "SupplierProfile")

    sup_to_person = {
        sp.legacy_supplier_id: sp.person_id
        for sp in SupplierProfile.objects.exclude(
            legacy_supplier_id__isnull=True
        ).exclude(legacy_supplier_id="")
    }

    for payable in PayableDocument.objects.all():
        legacy_id = str(payable.supplier_id)
        person_id = sup_to_person.get(legacy_id)
        if person_id is None:
            raise ValueError(
                f"PayableDocument #{payable.id} → Supplier #{payable.supplier_id} "
                f"não tem Person mapeada (rode persons.0013 antes)"
            )
        payable.person_id = person_id
        payable.save(update_fields=["person"])


def reverse_backfill(apps, schema_editor):
    """Reverso: noop — campo person é dropado em 0008."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts_payable", "0006_suppliercontact"),
        ("persons", "0013_backfill_persons_from_legacy"),
    ]

    operations = [
        migrations.AddField(
            model_name="payabledocument",
            name="person",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=models.deletion.PROTECT,
                related_name="payables_new",
                to="persons.person",
            ),
        ),
        migrations.RunPython(backfill_person_from_legacy, reverse_backfill),
    ]
