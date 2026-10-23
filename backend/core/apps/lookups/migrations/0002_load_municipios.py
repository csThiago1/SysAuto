# Data migration — carrega data/municipios.json para todo ambiente ter a tabela sem rede no boot.
from django.db import migrations

from apps.lookups.municipios import read_data_file, upsert


def load_municipios(apps, schema_editor):
    upsert(apps.get_model("lookups", "Municipio"), read_data_file())


class Migration(migrations.Migration):
    dependencies = [
        ("lookups", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(load_municipios, migrations.RunPython.noop),
    ]
