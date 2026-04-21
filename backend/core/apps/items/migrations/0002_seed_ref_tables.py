from django.db import migrations


OPERATION_TYPES = [
    ("TROCA", "Troca", "Peça substituída por nova.", 10),
    ("RECUPERACAO", "Recuperação", "Peça reparada/recuperada, não substituída.", 20),
    ("OVERLAP", "Overlap", "Peça sob influência; apenas tempo de desmontagem/montagem.", 30),
    ("R_I", "Remoção & Instalação", "Remove e reinstala sem substituir.", 40),
    ("PINTURA", "Pintura", "Somente pintura aplicada à peça.", 50),
    ("MONTAGEM_DESMONTAGEM", "Montagem/Desmontagem", "Operação auxiliar de montagem ou desmontagem.", 60),
    ("DNC", "Dano Não Coberto", "Item identificado como não coberto pelo sinistro.", 70),
]


LABOR_CATEGORIES = [
    ("FUNILARIA", "Funilaria", "", 10),
    ("PINTURA", "Pintura", "", 20),
    ("MECANICA", "Mecânica", "", 30),
    ("ELETRICA", "Elétrica", "", 40),
    ("TAPECARIA", "Tapeçaria", "", 50),
    ("ACABAMENTO", "Acabamento", "", 60),
    ("VIDRACARIA", "Vidraçaria", "", 70),
    ("REPARACAO", "Reparação", "MO de reparação (valor/hora diferenciado no Cilia).", 80),
    ("SERVICOS", "Serviços", "Agrupamento Cilia para serviços avulsos.", 90),
]


def seed_operation_types(apps, schema_editor):
    ItemOperationType = apps.get_model("items", "ItemOperationType")
    for code, label, desc, order in OPERATION_TYPES:
        ItemOperationType.objects.get_or_create(
            code=code,
            defaults={"label": label, "description": desc, "sort_order": order},
        )


def seed_labor_categories(apps, schema_editor):
    LaborCategory = apps.get_model("items", "LaborCategory")
    for code, label, desc, order in LABOR_CATEGORIES:
        LaborCategory.objects.get_or_create(
            code=code,
            defaults={"label": label, "description": desc, "sort_order": order},
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("items", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_operation_types, noop_reverse),
        migrations.RunPython(seed_labor_categories, noop_reverse),
    ]
