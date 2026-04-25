from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("vehicle_catalog", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Vehicle",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True)),
                ("plate", models.CharField(db_index=True, max_length=10)),
                (
                    "version",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="tenant_vehicles",
                        to="vehicle_catalog.vehicleyearversion",
                    ),
                ),
                ("description", models.CharField(blank=True, default="", max_length=200)),
                ("color", models.CharField(blank=True, default="", max_length=50)),
                ("year_manufacture", models.IntegerField(blank=True, null=True)),
                ("chassis", models.CharField(blank=True, default="", max_length=50)),
                ("renavam", models.CharField(blank=True, default="", max_length=20)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
