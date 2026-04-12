# Generated manually — feature: slot + checklist_type fields on ServiceOrderPhoto.
# Supports structured photo capture from the mobile app (Sprint M2):
#   slot          — vistoria position (frente, traseira, lateral_esq, …)
#   checklist_type — checklist context (entrada, saida, acompanhamento)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("service_orders", "0010_fix_model_drift"),
    ]

    operations = [
        migrations.AddField(
            model_name="serviceorderphoto",
            name="slot",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Slot de vistoria (ex: frente, traseira, lateral_esq)",
                max_length=50,
                verbose_name="Slot",
            ),
        ),
        migrations.AddField(
            model_name="serviceorderphoto",
            name="checklist_type",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Tipo de checklist: entrada, saida ou acompanhamento",
                max_length=20,
                verbose_name="Tipo de checklist",
            ),
        ),
    ]
