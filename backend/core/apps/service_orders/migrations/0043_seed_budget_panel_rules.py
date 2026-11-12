# Data migration — seed do dicionário de peças do orçamento (BudgetPanelRule source="seed").
from django.apps.registry import Apps
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor

from apps.service_orders.services.budget_panels import seed_rules


def seed(apps: Apps, schema_editor: BaseDatabaseSchemaEditor | None) -> None:
    Rule = apps.get_model("service_orders", "BudgetPanelRule")
    for pattern, panel_keys in seed_rules():
        Rule.objects.update_or_create(
            pattern=pattern, defaults={"panel_keys": panel_keys, "source": "seed"}
        )


class Migration(migrations.Migration):

    dependencies = [("service_orders", "0042_entry_checklist")]

    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
