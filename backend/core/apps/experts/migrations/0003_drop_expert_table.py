"""Drop experts.Expert — consolidado em persons.Person + ExpertProfile.

App `experts/` permanece registrado neste PR; será removido de INSTALLED_APPS
em commit pós-deploy estável (Task 21 do plan).
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("experts", "0002_alter_expert_created_by_alter_expert_is_active"),
        ("service_orders", "0033_swap_expert_fk"),
        ("persons", "0013_backfill_persons_from_legacy"),
    ]

    operations = [
        migrations.DeleteModel(name="Expert"),
    ]
