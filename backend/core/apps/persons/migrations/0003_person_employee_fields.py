"""
Migration: adiciona job_title e department ao model Person (dados de funcionário).
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("persons", "0002_logo_url_charfield"),
    ]

    operations = [
        migrations.AddField(
            model_name="person",
            name="job_title",
            field=models.CharField(
                blank=True,
                default="",
                max_length=100,
                verbose_name="Cargo",
            ),
        ),
        migrations.AddField(
            model_name="person",
            name="department",
            field=models.CharField(
                blank=True,
                default="",
                max_length=100,
                verbose_name="Setor",
            ),
        ),
    ]
