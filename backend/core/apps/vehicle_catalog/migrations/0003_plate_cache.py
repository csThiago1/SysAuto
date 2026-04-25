from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("vehicle_catalog", "0002_fipe_models"),
    ]

    operations = [
        migrations.CreateModel(
            name="PlateCache",
            fields=[
                ("id", models.AutoField(primary_key=True, serialize=False)),
                ("plate", models.CharField(
                    max_length=8,
                    unique=True,
                    db_index=True,
                    verbose_name="Placa",
                )),
                ("make",    models.CharField(max_length=80,  blank=True, default="")),
                ("model",   models.CharField(max_length=120, blank=True, default="")),
                ("year",    models.IntegerField(null=True, blank=True)),
                ("chassis", models.CharField(max_length=17,  blank=True, default="")),
                ("renavam", models.CharField(max_length=11,  blank=True, default="")),
                ("city",    models.CharField(max_length=80,  blank=True, default="")),
                ("color",   models.CharField(max_length=40,  blank=True, default="")),
                ("fuel_type", models.CharField(max_length=20, blank=True, default="")),
                ("raw_response", models.JSONField(
                    default=dict,
                    help_text="Resposta bruta da API externa para auditoria.",
                )),
                ("fetched_at", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={
                "verbose_name": "Cache de Placa",
                "verbose_name_plural": "Cache de Placas",
                "ordering": ["-fetched_at"],
            },
        ),
    ]
