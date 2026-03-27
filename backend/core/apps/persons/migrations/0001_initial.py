import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Person",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("full_name", models.CharField(max_length=200)),
                (
                    "person_type",
                    models.CharField(
                        choices=[
                            ("CLIENT", "Cliente"),
                            ("EMPLOYEE", "Colaborador"),
                            ("INSURER", "Seguradora"),
                            ("BROKER", "Corretor"),
                        ],
                        max_length=20,
                    ),
                ),
                ("phone", models.CharField(blank=True, default="", max_length=30)),
                ("email", models.EmailField(blank=True, default="", max_length=254)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
