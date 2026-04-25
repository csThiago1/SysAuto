from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("budgets", "0002_budget_vehicle_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="budget",
            name="vehicle_color",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="budget",
            name="vehicle_year",
            field=models.IntegerField(blank=True, null=True),
        ),
    ]
