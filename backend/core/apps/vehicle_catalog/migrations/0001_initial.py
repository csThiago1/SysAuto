from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name="VehicleColor",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=50, unique=True, verbose_name="Nome")),
                (
                    "hex_code",
                    models.CharField(
                        help_text="Ex: #C0C0C0", max_length=7, verbose_name="Código hex"
                    ),
                ),
            ],
            options={
                "verbose_name": "Cor de veículo",
                "verbose_name_plural": "Cores de veículos",
                "ordering": ["name"],
                "app_label": "vehicle_catalog",
            },
        ),
    ]
