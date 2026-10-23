"""Seed das duas regras de retorno pedidas pelo cliente.

Nascem INATIVAS de propósito: ninguém dispara retorno para cliente real sem
alguém ligar a chave conscientemente. Idempotente por `name`.
"""

from django.db import migrations

RULES = [
    {
        "name": "Pesquisa de satisfação",
        "delay_hours": 48,
        "message_template": (
            "Olá {cliente}! Aqui é da DS Car. Há dois dias entregamos seu "
            "{placa} (OS {os}). Como foi a experiência? Ficou satisfeito com o "
            "serviço? Se puder, deixe também sua avaliação no Google — ajuda "
            "muito a gente."
        ),
        "link": "",
    },
    {
        "name": "Oferta de revisão e lavagem",
        "delay_hours": 720,  # 30 dias
        "message_template": (
            "Olá {cliente}! Já faz um mês que seu {placa} passou por aqui "
            "(OS {os}). Que tal agendar uma revisão ou uma lavagem? Temos "
            "horário essa semana."
        ),
        "link": "",
    },
]


def forwards(apps, schema_editor):
    FollowUpRule = apps.get_model("followups", "FollowUpRule")
    for rule in RULES:
        FollowUpRule.objects.get_or_create(
            name=rule["name"],
            defaults={
                "trigger_event": "delivered",
                "delay_hours": rule["delay_hours"],
                "channel": "task",
                "message_template": rule["message_template"],
                "link": rule["link"],
                "os_types": [],
                "is_active": False,
            },
        )


def backwards(apps, schema_editor):
    FollowUpRule = apps.get_model("followups", "FollowUpRule")
    FollowUpRule.objects.filter(name__in=[r["name"] for r in RULES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("followups", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
