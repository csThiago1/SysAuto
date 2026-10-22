# Data migration — corrige duas regras da 0008 para as grafias reais da FIPE.
# "ONIX SD. P. PR." também é Onix Plus; Mercedes aceita espaço ("C 180") além do hífen.
from django.db import migrations

MERCEDES_CLASSES = "A|B|C|E|S|G|CLA|CLS|CLK|CL|GLA|GLB|GLC|GLE|GLS|GLK|GL|ML|SLK|SLC|SL"

# (marca_nome_normalizado, padrao antigo, padrao novo)
UPDATES = [
    ("GM - CHEVROLET", r"^ONIX SED", r"^ONIX (SEDAN|SED|SD)\b"),
    ("MERCEDES-BENZ", rf"^({MERCEDES_CLASSES})-?\d", rf"^({MERCEDES_CLASSES})[- ]?\d"),
]


def update_rules(apps, schema_editor):
    VehicleFamilyRule = apps.get_model("vehicle_catalog", "VehicleFamilyRule")
    for marca, old, new in UPDATES:
        VehicleFamilyRule.objects.filter(
            marca_nome_normalizado=marca, tipo="carro", padrao=old
        ).update(padrao=new)


class Migration(migrations.Migration):
    dependencies = [
        ("vehicle_catalog", "0011_delete_platecache"),
    ]

    operations = [
        migrations.RunPython(update_rules, migrations.RunPython.noop),
    ]
