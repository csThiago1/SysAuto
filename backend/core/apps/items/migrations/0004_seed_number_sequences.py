from django.db import migrations


def seed_sequences(apps, schema_editor) -> None:
    NumberSequence = apps.get_model("items", "NumberSequence")
    NumberSequence.objects.get_or_create(
        sequence_type="BUDGET",
        defaults={"prefix": "OR-", "padding": 6, "next_number": 1},
    )
    NumberSequence.objects.get_or_create(
        sequence_type="SERVICE_ORDER",
        defaults={"prefix": "OS-", "padding": 6, "next_number": 1},
    )


class Migration(migrations.Migration):

    dependencies = [
        ("items", "0003_add_number_sequence"),
    ]

    operations = [
        migrations.RunPython(seed_sequences, migrations.RunPython.noop),
    ]
