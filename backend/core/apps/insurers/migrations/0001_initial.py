import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name="Insurer",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("name", models.CharField(max_length=200, unique=True, verbose_name="Razão social")),
                (
                    "trade_name",
                    models.CharField(
                        blank=True, default="", max_length=200, verbose_name="Nome fantasia"
                    ),
                ),
                ("cnpj", models.CharField(max_length=18, unique=True, verbose_name="CNPJ")),
                (
                    "brand_color",
                    models.CharField(
                        default="#000000",
                        help_text="Cor hex da marca para exibição na UI (ex: #003DA5)",
                        max_length=7,
                        verbose_name="Cor da marca",
                    ),
                ),
                (
                    "abbreviation",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Abreviação para avatar/logo (ex: BR, PS, AZ)",
                        max_length=4,
                        verbose_name="Abreviação",
                    ),
                ),
                (
                    "logo",
                    models.ImageField(
                        blank=True, null=True, upload_to="insurers/logos/", verbose_name="Logo"
                    ),
                ),
                ("is_active", models.BooleanField(default=True, verbose_name="Ativo")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Seguradora",
                "verbose_name_plural": "Seguradoras",
                "ordering": ["name"],
            },
        ),
    ]
