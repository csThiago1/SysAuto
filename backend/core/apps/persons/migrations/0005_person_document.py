"""
Migration 0005: PersonDocument model + TipoDocumento choices
Ciclo 06A — T01: PersonDocument com campos PII criptografados (LGPD)
"""
import encrypted_model_fields.fields
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("persons", "0004_person_job_title_department_choices"),
    ]

    operations = [
        migrations.CreateModel(
            name="PersonDocument",
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
                (
                    "doc_type",
                    models.CharField(
                        choices=[
                            ("CPF", "CPF"),
                            ("CNPJ", "CNPJ"),
                            ("RG", "RG"),
                            ("IE", "Inscrição Estadual"),
                            ("IM", "Inscrição Municipal"),
                            ("CNH", "CNH"),
                        ],
                        db_index=True,
                        max_length=10,
                        verbose_name="Tipo de documento",
                    ),
                ),
                (
                    "value",
                    encrypted_model_fields.fields.EncryptedCharField(
                        max_length=200,
                        verbose_name="Valor",
                    ),
                ),
                (
                    "value_hash",
                    models.CharField(
                        db_index=True,
                        default="",
                        max_length=64,
                        verbose_name="Hash do valor",
                    ),
                ),
                (
                    "is_primary",
                    models.BooleanField(default=False, verbose_name="Principal"),
                ),
                (
                    "issued_by",
                    models.CharField(
                        blank=True,
                        default="",
                        max_length=100,
                        verbose_name="Órgão emissor",
                    ),
                ),
                (
                    "issued_at",
                    models.DateField(
                        blank=True,
                        null=True,
                        verbose_name="Data de emissão",
                    ),
                ),
                (
                    "expires_at",
                    models.DateField(
                        blank=True,
                        null=True,
                        verbose_name="Data de validade",
                    ),
                ),
                (
                    "person",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="documents",
                        to="persons.person",
                        verbose_name="Pessoa",
                    ),
                ),
            ],
            options={
                "verbose_name": "Documento",
                "verbose_name_plural": "Documentos",
                "unique_together": {("person", "doc_type", "value_hash")},
            },
        ),
    ]
