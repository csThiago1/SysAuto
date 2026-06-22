"""Backfill: accounts_payable.Supplier + experts.Expert → persons.Person + Profiles."""
from django.db import migrations


def forwards(apps, schema_editor):
    from apps.persons.migrations._backfill_helpers import (
        backfill_suppliers_to_persons,
        backfill_experts_to_persons,
    )
    backfill_suppliers_to_persons(apps)
    backfill_experts_to_persons(apps)


def reverse(apps, schema_editor):
    """Reverso: deleta Persons criadas pelo backfill (identificadas por legacy_*_id)."""
    SupplierProfile = apps.get_model("persons", "SupplierProfile")
    ExpertProfile = apps.get_model("persons", "ExpertProfile")
    Person = apps.get_model("persons", "Person")

    person_ids = list(
        SupplierProfile.objects.exclude(legacy_supplier_id__isnull=True)
        .exclude(legacy_supplier_id="")
        .values_list("person_id", flat=True)
    )
    person_ids += list(
        ExpertProfile.objects.exclude(legacy_expert_id__isnull=True)
        .exclude(legacy_expert_id="")
        .values_list("person_id", flat=True)
    )
    Person.objects.filter(pk__in=person_ids).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("persons", "0012_supplier_expert_profiles"),
        ("accounts_payable", "0006_suppliercontact"),
        ("experts", "0002_alter_expert_created_by_alter_expert_is_active"),
    ]

    operations = [
        migrations.RunPython(forwards, reverse),
    ]
