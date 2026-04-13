"""
Migration: add push_token to GlobalUser for Expo Push Notifications.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0002_globaluser_job_title"),
    ]

    operations = [
        migrations.AddField(
            model_name="globaluser",
            name="push_token",
            field=models.CharField(
                blank=True,
                default="",
                max_length=200,
                verbose_name="Expo Push Token",
            ),
        ),
    ]
