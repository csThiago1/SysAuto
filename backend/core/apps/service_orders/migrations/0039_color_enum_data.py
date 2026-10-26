# Data migration — cor em texto livre vira código do enum CorVeiculo.
from django.apps.registry import Apps
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor

from apps.vehicle_catalog.normalize import match_color


def map_colors(apps: Apps, schema_editor: BaseDatabaseSchemaEditor | None) -> None:
    Model = apps.get_model("service_orders", "ServiceOrder")
    for text in Model.objects.values_list("color", flat=True).distinct():
        Model.objects.filter(color=text).update(color=match_color(text) or "NAO_INFORMADA")


class Migration(migrations.Migration):

    dependencies = [("service_orders", "0038_catalog_vehicle")]

    operations = [migrations.RunPython(map_colors, migrations.RunPython.noop)]
