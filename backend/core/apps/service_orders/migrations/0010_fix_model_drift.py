# Generated manually — model drift correction.
# Captures AlterField/AlterModelOptions/RenameIndex operations that accumulated
# without a migration being created. Isolated here so the feature migration
# (0011_add_slot_checklist_type_to_photo) remains minimal and clearly scoped.

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("service_orders", "0009_add_consultant_delivery_indexes"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── ServiceOrderPhoto: model options + index rename ────────────────────
        migrations.AlterModelOptions(
            name="serviceorderphoto",
            options={
                "ordering": ["uploaded_at"],
                "verbose_name": "Foto de OS",
                "verbose_name_plural": "Fotos de OS",
            },
        ),
        migrations.RenameIndex(
            model_name="serviceorderphoto",
            new_name="service_ord_service_4cdd75_idx",
            old_name="so_photo_order_folder_idx",
        ),
        # ── ServiceOrderPhoto: original_stage help_text update ─────────────────
        migrations.AlterField(
            model_name="serviceorderphoto",
            name="original_stage",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Valor original do campo stage (legado, para retrocompatibilidade)",
                max_length=30,
                verbose_name="Stage original",
            ),
        ),
        # ── BudgetSnapshot: align fields with PaddockBaseModel inheritance ──────
        migrations.AlterField(
            model_name="budgetsnapshot",
            name="id",
            field=models.UUIDField(
                default=uuid.uuid4, editable=False, primary_key=True, serialize=False
            ),
        ),
        migrations.AlterField(
            model_name="budgetsnapshot",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, db_index=True),
        ),
        migrations.AlterField(
            model_name="budgetsnapshot",
            name="created_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="%(class)s_created",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name="budgetsnapshot",
            name="items_snapshot",
            field=models.JSONField(
                default=list,
                help_text="Lista serializada de peças e serviços no momento do snapshot",
            ),
        ),
        # ── ServiceOrderActivityLog: new activity_type choices ─────────────────
        migrations.AlterField(
            model_name="serviceorderactivitylog",
            name="activity_type",
            field=models.CharField(
                choices=[
                    ("created", "OS Aberta"),
                    ("status_changed", "Status Alterado"),
                    ("updated", "Informação Atualizada"),
                    ("reminder", "Lembrete Adicionado"),
                    ("file_upload", "Arquivo Anexado"),
                    ("note_added", "Nota Adicionada"),
                    ("budget_snapshot", "Snapshot de Orçamento"),
                    ("cilia_import", "Importação Cilia"),
                    ("delivery", "Entrega ao Cliente"),
                    ("part_added", "Peça Adicionada"),
                    ("part_removed", "Peça Removida"),
                    ("labor_added", "Serviço Adicionado"),
                    ("labor_removed", "Serviço Removido"),
                    ("invoice_issued", "NF Emitida"),
                ],
                max_length=30,
            ),
        ),
    ]
