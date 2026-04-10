"""
Migration: substitui ImageField 'logo' por CharField 'logo_url'.
Remove dependência do Pillow.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("insurers", "0002_insurer_uses_cilia"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="insurer",
            name="logo",
        ),
        migrations.AddField(
            model_name="insurer",
            name="logo_url",
            field=models.CharField(
                blank=True,
                default="",
                max_length=500,
                verbose_name="URL do logo",
            ),
        ),
    ]
