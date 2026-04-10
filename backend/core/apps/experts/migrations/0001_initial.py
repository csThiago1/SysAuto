import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ("authentication", "0001_initial"),
        ("insurers", "0001_initial"),
    ]
    operations = [
        migrations.CreateModel(
            name="Expert",
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
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("name", models.CharField(max_length=200, verbose_name="Nome")),
                (
                    "registration_number",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="CREA ou registro profissional",
                        max_length=50,
                        verbose_name="Número de registro",
                    ),
                ),
                (
                    "phone",
                    models.CharField(
                        blank=True, default="", max_length=20, verbose_name="Telefone"
                    ),
                ),
                (
                    "email",
                    models.EmailField(blank=True, default="", verbose_name="E-mail"),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "insurers",
                    models.ManyToManyField(
                        blank=True,
                        help_text="Seguradoras para as quais este perito atua",
                        related_name="experts",
                        to="insurers.Insurer",
                        verbose_name="Seguradoras",
                    ),
                ),
            ],
            options={
                "verbose_name": "Perito",
                "verbose_name_plural": "Peritos",
                "ordering": ["name"],
                "abstract": False,
            },
        ),
    ]
