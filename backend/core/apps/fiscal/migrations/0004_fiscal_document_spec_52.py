# Ciclo 06C: FiscalDocument spec §5.2 + FiscalDocumentItem spec §5.3
# ADDITIVE ONLY — todos os campos novos são null=True ou blank=True/default.
# reference_id e environment recebem AlterField (additive: null, default).
# Validado: zero DROP, zero RemoveField, zero destrutivo.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("fiscal", "0003_fiscal_config_item_event"),
        ("service_orders", "0020_capacity_models"),
        ("persons", "0008_backfill_person_document"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── FiscalDocument: tornar campos legados opcionais ─────────────────
        migrations.AlterField(
            model_name="fiscaldocument",
            name="reference_id",
            field=models.UUIDField(db_index=True, null=True, blank=True),
        ),
        migrations.AlterField(
            model_name="fiscaldocument",
            name="reference_type",
            field=models.CharField(max_length=50, blank=True, default=""),
        ),
        migrations.AlterField(
            model_name="fiscaldocument",
            name="environment",
            field=models.CharField(
                max_length=15,
                choices=[("homologation", "Homologação"), ("production", "Produção")],
                blank=True,
                default="homologacao",
            ),
        ),

        # ── FiscalDocument: novos campos spec §5.2 ──────────────────────────
        migrations.AddField(
            model_name="fiscaldocument",
            name="ref",
            field=models.CharField(
                max_length=50,
                null=True,
                blank=True,
                unique=True,
                db_index=True,
                help_text="Ref de idempotência enviada à Focus.",
            ),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="config",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="documents",
                to="fiscal.fiscalconfigmodel",
            ),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="service_order",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="fiscal_documents",
                to="service_orders.serviceorder",
            ),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="destinatario",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="fiscal_received",
                to="persons.person",
            ),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="protocolo",
            field=models.CharField(max_length=50, blank=True, default=""),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="caminho_xml",
            field=models.CharField(max_length=500, blank=True, default=""),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="caminho_pdf",
            field=models.CharField(max_length=500, blank=True, default=""),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="caminho_xml_cancelamento",
            field=models.CharField(max_length=500, blank=True, default=""),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="payload_enviado",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Snapshot do payload enviado à Focus.",
            ),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="ultima_resposta",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Snapshot da última resposta da Focus.",
            ),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="mensagem_sefaz",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="natureza_rejeicao",
            field=models.CharField(max_length=255, blank=True, default=""),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="valor_impostos",
            field=models.DecimalField(max_digits=14, decimal_places=2, default=0),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="documento_referenciado",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="devolucoes_complementares",
                to="fiscal.fiscaldocument",
            ),
        ),
        # created_by já existe no DB desde 0001 — só atualiza o estado (related_name)
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterField(
                    model_name="fiscaldocument",
                    name="created_by",
                    field=models.ForeignKey(
                        null=True,
                        blank=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="manual_reason",
            field=models.CharField(
                max_length=255,
                blank=True,
                default="",
                help_text="Justificativa obrigatória para NFS-e manual (sem OS).",
            ),
        ),

        # ── FiscalDocument: constraint e índices ────────────────────────────
        migrations.AddConstraint(
            model_name="fiscaldocument",
            constraint=models.CheckConstraint(
                name="fiscal_doc_manual_needs_reason",
                check=models.Q(service_order__isnull=False)
                | ~models.Q(manual_reason=""),
            ),
        ),
        migrations.AddIndex(
            model_name="fiscaldocument",
            index=models.Index(
                fields=["status", "document_type"],
                name="fiscal_doc_status_type_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="fiscaldocument",
            index=models.Index(
                fields=["service_order", "document_type"],
                name="fiscal_doc_os_type_idx",
            ),
        ),

        # ── FiscalDocumentItem: novos campos spec §5.3 ──────────────────────
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="codigo_servico_lc116",
            field=models.CharField(
                max_length=10,
                blank=True,
                default="",
                help_text="Item LC 116 para NFS-e (ex: '14.01').",
            ),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="valor_bruto",
            field=models.DecimalField(max_digits=14, decimal_places=2, default=0),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="valor_liquido",
            field=models.DecimalField(max_digits=14, decimal_places=2, default=0),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="valor_iss",
            field=models.DecimalField(max_digits=14, decimal_places=2, default=0),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="iss_retido",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="icms_cst",
            field=models.CharField(max_length=5, blank=True, default=""),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="icms_aliquota",
            field=models.DecimalField(max_digits=5, decimal_places=2, default=0),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="icms_valor",
            field=models.DecimalField(max_digits=12, decimal_places=2, default=0),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="pis_cst",
            field=models.CharField(max_length=5, blank=True, default=""),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="pis_valor",
            field=models.DecimalField(max_digits=12, decimal_places=2, default=0),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="cofins_cst",
            field=models.CharField(max_length=5, blank=True, default=""),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="cofins_valor",
            field=models.DecimalField(max_digits=12, decimal_places=2, default=0),
        ),
    ]
