import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("persons", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ServiceOrder",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("os_number", models.CharField(db_index=True, max_length=30, unique=True)),
                (
                    "customer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="service_orders",
                        to="persons.person",
                    ),
                ),
                ("vehicle_plate", models.CharField(db_index=True, max_length=10)),
                ("vehicle_description", models.CharField(max_length=200)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("reception", "Recepção"),
                            ("initial_survey", "Vistoria Inicial"),
                            ("budget", "Orçamento"),
                            ("waiting_parts", "Aguardando Peças"),
                            ("repair", "Reparo"),
                            ("mechanic", "Mecânica"),
                            ("bodywork", "Funilaria"),
                            ("painting", "Pintura"),
                            ("assembly", "Montagem"),
                            ("polishing", "Polimento"),
                            ("washing", "Lavagem"),
                            ("final_survey", "Vistoria Final"),
                            ("ready", "Pronto para Entrega"),
                            ("delivered", "Entregue"),
                            ("cancelled", "Cancelada"),
                        ],
                        db_index=True,
                        default="reception",
                        max_length=30,
                    ),
                ),
                ("total_value", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("notes", models.TextField(blank=True, default="")),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="ServiceOrderStatusHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "service_order",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="status_history",
                        to="service_orders.serviceorder",
                    ),
                ),
                ("from_status", models.CharField(max_length=30)),
                ("to_status", models.CharField(max_length=30)),
                ("changed_by", models.CharField(blank=True, default="Sistema", max_length=120)),
                ("notes", models.TextField(blank=True, default="")),
                ("changed_at", models.DateTimeField(auto_now_add=True, db_index=True)),
            ],
            options={
                "ordering": ["-changed_at"],
            },
        ),
    ]
