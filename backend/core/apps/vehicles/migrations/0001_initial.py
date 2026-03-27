import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="VehicleBrand",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("fipe_brand_id", models.IntegerField(db_index=True, unique=True)),
                ("name", models.CharField(db_index=True, max_length=100)),
                (
                    "vehicle_type",
                    models.CharField(
                        choices=[("car", "Carro"), ("motorcycle", "Moto"), ("truck", "Caminhão")],
                        db_index=True,
                        default="car",
                        max_length=20,
                    ),
                ),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="VehicleModel",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "brand",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="models",
                        to="vehicles.vehiclebrand",
                    ),
                ),
                ("fipe_model_id", models.IntegerField(db_index=True)),
                ("name", models.CharField(db_index=True, max_length=200)),
            ],
            options={"ordering": ["name"], "unique_together": {("brand", "fipe_model_id")}},
        ),
        migrations.CreateModel(
            name="VehicleVersion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "model",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="versions",
                        to="vehicles.vehiclemodel",
                    ),
                ),
                ("fipe_code", models.CharField(db_index=True, max_length=20, unique=True)),
                ("year_model", models.IntegerField(db_index=True)),
                ("fuel", models.CharField(blank=True, default="", max_length=20)),
                ("full_name", models.CharField(db_index=True, max_length=500)),
            ],
            options={"ordering": ["full_name"]},
        ),
        migrations.CreateModel(
            name="Vehicle",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("plate", models.CharField(db_index=True, max_length=10)),
                (
                    "version",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="vehicles",
                        to="vehicles.vehicleversion",
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
