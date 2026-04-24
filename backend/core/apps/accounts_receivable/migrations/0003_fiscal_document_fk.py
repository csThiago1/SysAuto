# Ciclo 06C: vincula ReceivableDocument ao FiscalDocument (NFS-e/NF-e emitida)
# ADDITIVE — campo null=True, sem DROP.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts_receivable", "0002_rename_ar_doc_status_due_idx_accounts_re_status_b61b6a_idx_and_more"),
        ("fiscal", "0004_fiscal_document_spec_52"),
    ]

    operations = [
        migrations.AddField(
            model_name="receivabledocument",
            name="fiscal_document",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="receivable_documents",
                to="fiscal.fiscaldocument",
                verbose_name="Documento Fiscal",
            ),
        ),
    ]
