from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("vehicle_catalog", "0003_plate_cache"),
    ]

    operations = [
        migrations.AddField(
            model_name="platecache",
            name="version",
            field=models.CharField(
                blank=True,
                default="",
                max_length=80,
                help_text="Versão/trim ex: LT1, EXL, Premier",
            ),
        ),
        migrations.AddField(
            model_name="platecache",
            name="engine",
            field=models.CharField(
                blank=True,
                default="",
                max_length=20,
                help_text="Motorização ex: 1.0T, 2.0, 1.6",
            ),
        ),
    ]
