"""
Items app — migration 0002_seed_reference_tables

Seeds reference data for:
- ItemOperationType: TROCA, RECUPERACAO, OVERLAP, PINTURA, R_I,
                     MONTAGEM_DESMONTAGEM, DNC
- LaborCategory: FUNILARIA, PINTURA, MECANICA, ELETRICA, TAPECARIA,
                 ACABAMENTO, VIDRACARIA, REPARACAO, SERVICOS

Uses get_or_create for idempotency — safe to run multiple times.
"""
from __future__ import annotations

from django.db import migrations


OPERATION_TYPES = [
    {"code": "TROCA", "label": "Troca", "sort_order": 0},
    {"code": "RECUPERACAO", "label": "Recuperação", "sort_order": 1},
    {"code": "OVERLAP", "label": "Overlap", "sort_order": 2},
    {"code": "PINTURA", "label": "Pintura", "sort_order": 3},
    {"code": "R_I", "label": "Remoção e Instalação", "sort_order": 4},
    {"code": "MONTAGEM_DESMONTAGEM", "label": "Montagem/Desmontagem", "sort_order": 5},
    {"code": "DNC", "label": "DNC", "sort_order": 6},
]

LABOR_CATEGORIES = [
    {"code": "FUNILARIA", "label": "Funilaria", "sort_order": 0},
    {"code": "PINTURA", "label": "Pintura", "sort_order": 1},
    {"code": "MECANICA", "label": "Mecânica", "sort_order": 2},
    {"code": "ELETRICA", "label": "Elétrica", "sort_order": 3},
    {"code": "TAPECARIA", "label": "Tapeçaria", "sort_order": 4},
    {"code": "ACABAMENTO", "label": "Acabamento", "sort_order": 5},
    {"code": "VIDRACARIA", "label": "Vidraçaria", "sort_order": 6},
    {"code": "REPARACAO", "label": "Reparação", "sort_order": 7},
    {"code": "SERVICOS", "label": "Serviços", "sort_order": 8},
]


def seed_reference_tables(apps, schema_editor):
    """Populates ItemOperationType and LaborCategory with canonical reference data."""
    ItemOperationType = apps.get_model("items", "ItemOperationType")
    LaborCategory = apps.get_model("items", "LaborCategory")

    for data in OPERATION_TYPES:
        ItemOperationType.objects.get_or_create(
            code=data["code"],
            defaults={"label": data["label"], "sort_order": data["sort_order"]},
        )

    for data in LABOR_CATEGORIES:
        LaborCategory.objects.get_or_create(
            code=data["code"],
            defaults={"label": data["label"], "sort_order": data["sort_order"]},
        )


def reverse_seed(apps, schema_editor):
    """Removes seeded data. Safe no-op if records are already gone."""
    ItemOperationType = apps.get_model("items", "ItemOperationType")
    LaborCategory = apps.get_model("items", "LaborCategory")

    codes_op = [d["code"] for d in OPERATION_TYPES]
    codes_cat = [d["code"] for d in LABOR_CATEGORIES]

    ItemOperationType.objects.filter(code__in=codes_op).delete()
    LaborCategory.objects.filter(code__in=codes_cat).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("items", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_reference_tables, reverse_code=reverse_seed),
    ]
