"""
Migration 0008 — BudgetSnapshot + OSPhotoFolder + ActivityType atualizado

Mudanças:
- Adiciona OSPhotoFolder choices (não cria tabela — apenas choices no app)
- ServiceOrderPhoto: renomeia stage → folder, adiciona original_stage e caption
- ActivityType: novos choices (sem mudança estrutural no DB)
- Novo model BudgetSnapshot
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def migrate_stage_to_folder(apps, schema_editor):
    """
    Copia valor de stage para folder (mapeando os status de OS para as pastas).
    Também preserva o valor original em original_stage.
    """
    ServiceOrderPhoto = apps.get_model("service_orders", "ServiceOrderPhoto")

    # Mapeamento stage (status da OS) → pasta correspondente
    STAGE_TO_FOLDER = {
        "reception":      "vistoria_inicial",
        "initial_survey": "vistoria_inicial",
        "budget":         "orcamentos",
        "waiting_auth":   "orcamentos",
        "authorized":     "orcamentos",
        "waiting_parts":  "acompanhamento",
        "repair":         "acompanhamento",
        "mechanic":       "acompanhamento",
        "bodywork":       "acompanhamento",
        "painting":       "acompanhamento",
        "assembly":       "acompanhamento",
        "polishing":      "acompanhamento",
        "washing":        "acompanhamento",
        "final_survey":   "vistoria_final",
        "ready":          "vistoria_final",
        "delivered":      "vistoria_final",
        "cancelled":      "documentos",
    }

    for photo in ServiceOrderPhoto.objects.all():
        old_stage = photo.stage if hasattr(photo, "stage") else ""
        folder = STAGE_TO_FOLDER.get(old_stage, "vistoria_inicial")
        photo.folder = folder
        photo.original_stage = old_stage
        photo.save(update_fields=["folder", "original_stage"])


def reverse_migrate_folder_to_stage(apps, schema_editor):
    """Reverso: copia original_stage de volta para stage."""
    ServiceOrderPhoto = apps.get_model("service_orders", "ServiceOrderPhoto")
    for photo in ServiceOrderPhoto.objects.all():
        if photo.original_stage:
            photo.stage = photo.original_stage
            photo.save(update_fields=["stage"])


class Migration(migrations.Migration):

    dependencies = [
        ("service_orders", "0007_alter_serviceorderlabor_created_by_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Adicionar folder + original_stage + caption ao ServiceOrderPhoto
        migrations.AddField(
            model_name="serviceorderphoto",
            name="folder",
            field=models.CharField(
                choices=[
                    ("vistoria_inicial",  "Vistoria Inicial"),
                    ("complemento",       "Complemento"),
                    ("checklist_entrada", "Checklist de Entrada"),
                    ("documentos",        "Documentos"),
                    ("orcamentos",        "Orçamentos"),
                    ("acompanhamento",    "Acompanhamento de Reparos"),
                    ("vistoria_final",    "Vistoria Final"),
                ],
                default="vistoria_inicial",
                max_length=30,
                verbose_name="Pasta",
            ),
        ),
        migrations.AddField(
            model_name="serviceorderphoto",
            name="original_stage",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Valor original do campo stage (legado)",
                max_length=30,
                verbose_name="Stage original",
            ),
        ),
        migrations.AddField(
            model_name="serviceorderphoto",
            name="caption",
            field=models.CharField(
                blank=True,
                default="",
                max_length=200,
                verbose_name="Legenda",
            ),
        ),
        # 2. Migrar dados stage → folder
        migrations.RunPython(
            migrate_stage_to_folder,
            reverse_code=reverse_migrate_folder_to_stage,
        ),
        # 3. Remover campo stage antigo
        migrations.RemoveField(
            model_name="serviceorderphoto",
            name="stage",
        ),
        # 4. Adicionar índice para folder
        migrations.AddIndex(
            model_name="serviceorderphoto",
            index=models.Index(
                fields=["service_order", "folder"],
                name="so_photo_order_folder_idx",
            ),
        ),
        # 5. Criar model BudgetSnapshot
        migrations.CreateModel(
            name="BudgetSnapshot",
            fields=[
                ("id", models.UUIDField(default=None, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
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
                    "service_order",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="budget_snapshots",
                        to="service_orders.serviceorder",
                        verbose_name="OS",
                    ),
                ),
                ("version", models.PositiveSmallIntegerField(verbose_name="Versão")),
                (
                    "trigger",
                    models.CharField(
                        choices=[
                            ("cilia_import", "Importação Cilia"),
                            ("manual_save",  "Salvo Manualmente"),
                            ("delivery",     "Entrega"),
                            ("part_change",  "Alteração de Peças/Serviços"),
                        ],
                        max_length=20,
                        verbose_name="Gatilho",
                    ),
                ),
                ("parts_total",    models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("services_total", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("discount_total", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("items_snapshot", models.JSONField(default=list, help_text="Lista serializada de peças e serviços")),
            ],
            options={
                "verbose_name": "Snapshot de Orçamento",
                "verbose_name_plural": "Snapshots de Orçamento",
                "db_table": "service_orders_budget_snapshot",
                "ordering": ["-version"],
            },
        ),
        migrations.AlterUniqueTogether(
            name="budgetsnapshot",
            unique_together={("service_order", "version")},
        ),
    ]
