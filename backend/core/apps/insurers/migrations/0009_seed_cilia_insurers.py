# Data migration — garantir cadastro das seguradoras suportadas via Cilia.
# Necessário pra que importação Cilia vincule a OS à seguradora correta.
from django.db import migrations


# (code, name, cnpj, trade_name, trade_names, brand_color, abbreviation, uses_cilia)
SEED = [
    ("bradesco", "Bradesco Auto/Re Companhia de Seguros", "92.682.038/0001-00",
     "Bradesco Seguros", ["Bradesco Seguros"], "#cc092f", "BR", True),
    ("porto", "Porto Seguro Companhia de Seguros Gerais", "61.198.164/0001-60",
     "Porto Seguro", ["Porto Seguro"], "#003da5", "PS", True),
    ("azul", "Azul Companhia de Seguros Gerais", "61.198.164/0011-42",
     "Azul Seguros", ["Azul Seguros"], "#0066cc", "AZ", True),
    ("itau", "Itaú Seguros S.A.", "61.557.039/0001-90",
     "Itaú Seguros", ["Itaú Seguros"], "#ec7000", "IT", True),
    ("tokio", "Tokio Marine Seguradora S.A.", "33.164.021/0001-00",
     "Tokio Marine", ["Tokio Marine"], "#003366", "TM", True),
    ("yelum", "Yelum Seguradora S.A.", "61.589.370/0001-86",
     "Yelum Seguradora", ["Yelum Seguradora"], "#7a3ff7", "YL", True),
    ("hdi", "HDI Seguros S.A.", "29.980.158/0001-57",
     "HDI Seguros", ["HDI Seguros"], "#178d3e", "HD", True),
    ("mapfre", "Mapfre Seguros Gerais S.A.", "61.074.175/0001-38",
     "Mapfre", ["Mapfre"], "#cb1818", "MP", True),
    ("allianz", "Allianz Seguros S.A.", "61.573.796/0001-66",
     "Allianz", ["Allianz"], "#003781", "AL", True),
    ("suhai", "Suhai Seguradora S.A.", "62.700.077/0001-37",
     "Suhai", ["Suhai"], "#00aaad", "SU", True),
]


def seed_cilia_insurers(apps, schema_editor):
    Insurer = apps.get_model("insurers", "Insurer")
    for code, name, cnpj, trade_name, trade_names, color, abbr, uses_cilia in SEED:
        defaults = {
            "name": name,
            "cnpj": cnpj,
            "trade_name": trade_name,
            "trade_names": trade_names,
            "brand_color": color,
            "abbreviation": abbr,
            "uses_cilia": uses_cilia,
            "is_active": True,
        }
        obj, created = Insurer.objects.get_or_create(code=code, defaults=defaults)
        if not created:
            # Garante que trade_names contém o termo esperado, sem reset agressivo.
            existing = set(obj.trade_names or [])
            needed = set(trade_names)
            if not existing.issuperset(needed):
                obj.trade_names = sorted(existing.union(needed))
                obj.save(update_fields=["trade_names"])


def reverse_noop(apps, schema_editor):
    # Não removemos cadastros — pode haver OS referenciando.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("insurers", "0008_add_trade_names_to_insurer"),
    ]

    operations = [
        migrations.RunPython(seed_cilia_insurers, reverse_noop),
    ]
