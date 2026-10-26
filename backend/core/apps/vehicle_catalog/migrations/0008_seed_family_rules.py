# Data migration — regras de família para nomes FIPE compostos que o 1º termo erra.
from django.db import migrations

# (marca_nome_normalizado, padrao, familia) — todas do tipo carro.
SEED = [
    ("GM - CHEVROLET", r"^ONIX SED", "Onix Plus"),
    ("FIAT", r"^GRAND SIENA", "Grand Siena"),
    ("SUZUKI", r"^GRAND VITARA", "Grand Vitara"),
    ("JEEP", r"^GRAND CHEROKEE", "Grand Cherokee"),
    ("CITROEN", r"^GRAND C4", "Grand C4"),
    ("CHRYSLER", r"^GRAND CARAVAN", "Grand Caravan"),
    ("DODGE", r"^GRAND CARAVAN", "Grand Caravan"),
    ("TOYOTA", r"^COROLLA CROSS", "Corolla Cross"),
    ("TOYOTA", r"^YARIS CROSS", "Yaris Cross"),
    ("MITSUBISHI", r"^PAJERO SPORT", "Pajero Sport"),
    ("MITSUBISHI", r"^ECLIPSE CROSS", "Eclipse Cross"),
    ("MITSUBISHI", r"^OUTLANDER (SPORT|SP)\b", "Outlander Sport"),
    ("LAND ROVER", r"^(NEW )?RANGE.*EVOQUE", "Range Rover Evoque"),
    ("LAND ROVER", r"^(NEW )?RANGE.*VELAR", "Range Rover Velar"),
    ("LAND ROVER", r"^(NEW )?RANGE.*SPORT", "Range Rover Sport"),
    ("LAND ROVER", r"^(NEW )?RANGE", "Range Rover"),
    ("LAND ROVER", r"^DISC.*SPORT", "Discovery Sport"),
    ("LAND ROVER", r"^DISC", "Discovery"),
    ("LAND ROVER", r"^DEF", "Defender"),
    ("LAND ROVER", r"^FREELANDER", "Freelander"),
    ("BMW", r"^(\d)\d\d", r"Série \1"),
    ("MERCEDES-BENZ", r"^CLASSE (\w+)", r"Classe \1"),
    (
        "MERCEDES-BENZ",
        r"^(A|B|C|E|S|G|CLA|CLS|CLK|CL|GLA|GLB|GLC|GLE|GLS|GLK|GL|ML|SLK|SLC|SL)-?\d",
        r"Classe \1",
    ),
]


def seed_family_rules(apps, schema_editor):
    VehicleFamilyRule = apps.get_model("vehicle_catalog", "VehicleFamilyRule")
    for marca, padrao, familia in SEED:
        VehicleFamilyRule.objects.get_or_create(
            marca_nome_normalizado=marca,
            tipo="carro",
            padrao=padrao,
            defaults={"familia": familia, "is_active": True},
        )


class Migration(migrations.Migration):
    dependencies = [
        ("vehicle_catalog", "0007_catalogo_familia"),
    ]

    operations = [
        migrations.RunPython(seed_family_rules, migrations.RunPython.noop),
    ]
