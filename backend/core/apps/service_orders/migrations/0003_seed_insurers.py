from django.db import migrations


INSURERS = [
    ("yelum", "Yelum Seguradora", "cilia_api"),
    ("porto", "Porto Seguro", "xml_upload"),
    ("azul", "Azul Seguros", "xml_upload"),
    ("itau", "Itaú Seguros", "xml_upload"),
    ("hdi", "HDI Seguros", "html_upload"),
    ("mapfre", "Mapfre", "cilia_api"),
    ("tokio", "Tokio Marine", "cilia_api"),
    ("bradesco", "Bradesco Seguros", "cilia_api"),
    ("allianz", "Allianz", "cilia_api"),
    ("suhai", "Suhai", "cilia_api"),
]


def seed(apps, schema_editor) -> None:
    Insurer = apps.get_model("service_orders", "Insurer")
    for code, name, src in INSURERS:
        Insurer.objects.get_or_create(code=code, defaults={"name": name, "import_source": src})


class Migration(migrations.Migration):

    dependencies = [
        ("service_orders", "0002_add_insurer"),
    ]

    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
