"""Swap ServiceOrder.expert: experts.Expert → persons.Person."""
from django.db import migrations, models


def backfill(apps, schema_editor):
    ServiceOrder = apps.get_model("service_orders", "ServiceOrder")
    ExpertProfile = apps.get_model("persons", "ExpertProfile")

    exp_to_person = {
        ep.legacy_expert_id: ep.person_id
        for ep in ExpertProfile.objects.exclude(
            legacy_expert_id__isnull=True
        ).exclude(legacy_expert_id="")
    }

    for os in ServiceOrder.objects.exclude(expert__isnull=True):
        os.person_expert_id = exp_to_person.get(str(os.expert_id))
        os.save(update_fields=["person_expert"])


class Migration(migrations.Migration):

    dependencies = [
        ("service_orders", "0032_add_cilia_budget_fields"),
        ("persons", "0013_backfill_persons_from_legacy"),
    ]

    operations = [
        migrations.AddField(
            model_name="serviceorder",
            name="person_expert",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=models.deletion.SET_NULL,
                related_name="service_orders_as_expert_new",
                to="persons.person",
            ),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
        migrations.RemoveField(model_name="serviceorder", name="expert"),
        migrations.RenameField(
            model_name="serviceorder",
            old_name="person_expert",
            new_name="expert",
        ),
        migrations.AlterField(
            model_name="serviceorder",
            name="expert",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=models.deletion.SET_NULL,
                related_name="service_orders_as_expert",
                to="persons.person",
                limit_choices_to={"roles__role": "EXPERT"},
            ),
        ),
    ]
