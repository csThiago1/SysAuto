"""Gatilho pre_existing_damage + regra-semente "Oferecer orçamento particular".

Nasce ATIVA: é tarefa interna para o consultor (canal task), não mensagem ao
cliente — diferente das regras da 0002. Idempotente por `name`.
"""

from django.db import migrations, models

RULE_NAME = "Oferecer orçamento particular"


def forwards(apps, schema_editor):
    FollowUpRule = apps.get_model("followups", "FollowUpRule")
    FollowUpRule.objects.get_or_create(
        name=RULE_NAME,
        defaults={
            "trigger_event": "pre_existing_damage",
            "delay_hours": 0,
            "channel": "task",
            "message_template": "Oferecer orçamento particular · {placa} · OS {os}",
            "link": "",
            "os_types": [],
        },
    )


def backwards(apps, schema_editor):
    FollowUpRule = apps.get_model("followups", "FollowUpRule")
    # FollowUp.rule é PROTECT: com retornos criados, o rollback falha em vez de perdê-los.
    FollowUpRule.objects.filter(name=RULE_NAME, trigger_event="pre_existing_damage").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("followups", "0002_seed_default_rules"),
    ]

    operations = [
        migrations.AlterField(
            model_name="followuprule",
            name="trigger_event",
            field=models.CharField(
                choices=[
                    ("delivered", "OS entregue"),
                    ("pre_existing_damage", "Dano fora do orçamento"),
                ],
                default="delivered",
                max_length=20,
                verbose_name="Gatilho",
            ),
        ),
        migrations.RunPython(forwards, backwards),
    ]
