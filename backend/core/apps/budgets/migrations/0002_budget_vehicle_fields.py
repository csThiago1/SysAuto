from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("budgets", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="budget",
            name="vehicle_chassis",
            field=models.CharField(blank=True, default="", max_length=17),
        ),
        migrations.AddField(
            model_name="budget",
            name="vehicle_version",
            field=models.CharField(
                blank=True,
                default="",
                max_length=80,
                help_text="Versão/trim ex: LT1, EXL",
            ),
        ),
        migrations.AddField(
            model_name="budget",
            name="vehicle_engine",
            field=models.CharField(
                blank=True,
                default="",
                max_length=20,
                help_text="Motorização ex: 1.0T, 2.0",
            ),
        ),
    ]
