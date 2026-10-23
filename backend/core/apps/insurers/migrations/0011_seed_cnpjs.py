# Data migration — preenche Insurer.cnpjs com o principal (só dígitos) e os CNPJs que já
# aparecem nas fontes (Cilia e XML das seguradoras).
from django.apps.registry import Apps
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor

from apps.lookups.validators import only_digits

EXTRA_CNPJS = {
    "bradesco": ["33055146000193"],
    "yelum": ["61550141009129"],
    "hdi": ["29980158007593"],
}


def seed_cnpjs(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    Insurer = apps.get_model("insurers", "Insurer")
    for insurer in Insurer.objects.all():
        cnpjs = list(insurer.cnpjs)
        principal = only_digits(insurer.cnpj)
        for cnpj in [principal, *EXTRA_CNPJS.get(insurer.code, [])]:
            if cnpj and cnpj not in cnpjs:
                cnpjs.append(cnpj)
        if cnpjs != insurer.cnpjs:
            insurer.cnpjs = cnpjs
            insurer.save(update_fields=["cnpjs"])


class Migration(migrations.Migration):
    dependencies = [
        ("insurers", "0010_insurer_cnpjs_susep"),
    ]

    operations = [
        migrations.RunPython(seed_cnpjs, migrations.RunPython.noop),
    ]
