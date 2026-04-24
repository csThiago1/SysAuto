# Ciclo 06C — NFS-e Manaus
# Migration 0004: FiscalDocument spec §5.2 + FiscalDocumentItem §5.3
#
# APENAS ADD FIELD / ADD INDEX / ADD CONSTRAINT — sem DROP, sem RENAME, sem ALTER destrutivo.
# Validar antes de aplicar: python manage.py sqlmigrate fiscal 0004
#
# Campos adicionados em FiscalDocument:
#   ref, config, service_order, destinatario,
#   protocolo, caminho_xml, caminho_pdf, caminho_xml_cancelamento,
#   payload_enviado, ultima_resposta, mensagem_sefaz, natureza_rejeicao,
#   valor_impostos, documento_referenciado, manual_reason
#   + CheckConstraint fiscal_doc_manual_needs_reason
#   + Index fiscal_doc_status_type_idx
#   + Index fiscal_doc_os_type_idx
#
# Campos adicionados em FiscalDocumentItem:
#   codigo_servico_lc116, valor_bruto, valor_desconto_item, valor_liquido,
#   valor_iss, iss_retido, icms_cst, icms_aliquota, icms_valor,
#   pis_cst, pis_valor, cofins_cst, cofins_valor
#
# NOTA: created_by já existe em fiscal_document (herdado de PaddockBaseModel em 0001) — não adicionado.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("fiscal", "0003_fiscal_config_item_event"),
        ("persons", "0001_initial"),
        ("service_orders", "0001_initial"),
    ]

    operations = [
        # ── FiscalDocument: CharField / TextField / JSONField / DecimalField ──

        migrations.AddField(
            model_name="fiscaldocument",
            name="ref",
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text="Chave de idempotência enviada ao Focus. NULL em registros anteriores à 06C.",
                max_length=50,
                null=True,
                unique=True,
            ),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="protocolo",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="caminho_xml",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="caminho_pdf",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="caminho_xml_cancelamento",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="payload_enviado",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Snapshot do payload enviado ao Focus.",
            ),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="ultima_resposta",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Snapshot da última resposta recebida do Focus.",
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
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="valor_impostos",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="manual_reason",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Justificativa obrigatória quando service_order é nulo.",
                max_length=255,
            ),
        ),

        # ── FiscalDocument: ForeignKey fields ──────────────────────────────────

        migrations.AddField(
            model_name="fiscaldocument",
            name="config",
            field=models.ForeignKey(
                blank=True,
                help_text="Configuração fiscal do emissor.",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="documents",
                to="fiscal.fiscalconfigmodel",
            ),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="service_order",
            field=models.ForeignKey(
                blank=True,
                help_text="OS de origem. Nulo para emissão manual (manual_reason obrigatório).",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="fiscal_documents",
                to="service_orders.serviceorder",
            ),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="destinatario",
            field=models.ForeignKey(
                blank=True,
                help_text="Destinatário da nota fiscal.",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="fiscal_received",
                to="persons.person",
            ),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="documento_referenciado",
            field=models.ForeignKey(
                blank=True,
                help_text="Documento original referenciado (devolução ou complementar).",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="devolucoes_complementares",
                to="fiscal.fiscaldocument",
            ),
        ),

        # ── FiscalDocument: CheckConstraint ────────────────────────────────────

        migrations.AddConstraint(
            model_name="fiscaldocument",
            constraint=models.CheckConstraint(
                check=(
                    models.Q(service_order__isnull=False)
                    | ~models.Q(manual_reason="")
                ),
                name="fiscal_doc_manual_needs_reason",
            ),
        ),

        # ── FiscalDocument: Indexes ─────────────────────────────────────────────

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

        # ── FiscalDocumentItem: CharField / DecimalField / BooleanField ────────

        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="codigo_servico_lc116",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Código de serviço LC 116 para NFS-e (ex: 14.01).",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="valor_bruto",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="valor_desconto_item",
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text="Desconto do item (complementa valor_desconto existente).",
                max_digits=14,
            ),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="valor_liquido",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="valor_iss",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="iss_retido",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="icms_cst",
            field=models.CharField(blank=True, default="", max_length=3),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="icms_aliquota",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=5),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="icms_valor",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="pis_cst",
            field=models.CharField(blank=True, default="", max_length=3),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="pis_valor",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="cofins_cst",
            field=models.CharField(blank=True, default="", max_length=3),
        ),
        migrations.AddField(
            model_name="fiscaldocumentitem",
            name="cofins_valor",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
    ]
