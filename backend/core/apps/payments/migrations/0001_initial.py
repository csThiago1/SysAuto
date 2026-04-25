from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("service_orders", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Payment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True)),
                (
                    "service_order",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="payments",
                        to="service_orders.serviceorder",
                    ),
                ),
                (
                    "payer_block",
                    models.CharField(
                        choices=[
                            ("SEGURADORA", "Coberto pela Seguradora"),
                            ("COMPLEMENTO_PARTICULAR", "Complemento Particular"),
                            ("FRANQUIA", "Franquia"),
                            ("PARTICULAR", "Particular"),
                        ],
                        db_index=True,
                        max_length=30,
                    ),
                ),
                ("amount", models.DecimalField(decimal_places=2, max_digits=14)),
                (
                    "method",
                    models.CharField(
                        choices=[
                            ("PIX", "Pix"),
                            ("BOLETO", "Boleto"),
                            ("DINHEIRO", "Dinheiro"),
                            ("CARTAO", "Cartão"),
                            ("TRANSFERENCIA", "Transferência"),
                        ],
                        max_length=20,
                    ),
                ),
                ("reference", models.CharField(blank=True, default="", max_length=200)),
                ("received_at", models.DateTimeField(blank=True, null=True)),
                ("received_by", models.CharField(blank=True, default="", max_length=120)),
                ("fiscal_doc_ref", models.CharField(blank=True, default="", max_length=60)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pendente"),
                            ("received", "Recebido"),
                            ("refunded", "Estornado"),
                        ],
                        db_index=True,
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="payment",
            index=models.Index(
                fields=["service_order", "payer_block", "status"],
                name="pay_so_block_status_idx",
            ),
        ),
    ]
