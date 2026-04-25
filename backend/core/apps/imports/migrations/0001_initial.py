import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("service_orders", "0021_versioning_and_events"),
    ]

    operations = [
        migrations.CreateModel(
            name="ImportAttempt",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True)),
                ("source", models.CharField(choices=[("cilia", "Cilia API"), ("hdi", "HDI HTML"), ("xml_porto", "XML Porto"), ("xml_azul", "XML Azul"), ("xml_itau", "XML Itaú")], db_index=True, max_length=20)),
                ("trigger", models.CharField(choices=[("polling", "Polling Automático"), ("upload_manual", "Upload Manual"), ("user_requested", "Solicitado pelo Usuário")], max_length=30)),
                ("casualty_number", models.CharField(blank=True, db_index=True, default="", max_length=40)),
                ("budget_number", models.CharField(blank=True, default="", max_length=40)),
                ("version_number", models.IntegerField(blank=True, null=True)),
                ("http_status", models.IntegerField(blank=True, null=True)),
                ("parsed_ok", models.BooleanField(default=False)),
                ("error_message", models.TextField(blank=True, default="")),
                ("error_type", models.CharField(blank=True, default="", max_length=60)),
                ("raw_payload", models.JSONField(blank=True, null=True)),
                ("raw_hash", models.CharField(blank=True, db_index=True, default="", max_length=64)),
                ("service_order", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="imports_attempts", to="service_orders.serviceorder")),
                ("version_created", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="imports_attempts", to="service_orders.serviceorderversion")),
                ("duplicate_of", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="imports_duplicates", to="imports.importattempt")),
                ("created_at", models.DateTimeField(db_index=True, default=django.utils.timezone.now, editable=False)),
                ("created_by", models.CharField(blank=True, default="Sistema", max_length=120)),
                ("duration_ms", models.IntegerField(blank=True, null=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="importattempt",
            index=models.Index(fields=["source", "-created_at"], name="imp_source_created_idx"),
        ),
        migrations.AddIndex(
            model_name="importattempt",
            index=models.Index(fields=["casualty_number", "budget_number", "-created_at"], name="imp_casualty_budget_idx"),
        ),
    ]
