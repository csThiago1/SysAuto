from __future__ import annotations

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('quotes', '0002_rename_quotes_orc_empresa_status_idx_quotes_orca_empresa_1b8645_idx_and_more'),
        ('service_orders', '0020_capacity_models'),
    ]

    operations = [
        migrations.CreateModel(
            name='Signature',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('document_type', models.CharField(choices=[('BUDGET_APPROVAL', 'Aprovação de Orçamento'), ('OS_OPEN', 'Recepção do Veículo'), ('OS_DELIVERY', 'Entrega do Veículo'), ('COMPLEMENT_APPROVAL', 'Aprovação de Complemento'), ('INSURANCE_ACCEPTANCE', 'Aceite da Seguradora')], db_index=True, max_length=40)),
                ('method', models.CharField(choices=[('CANVAS_TABLET', 'Canvas em Tablet'), ('REMOTE_LINK', 'Link Remoto (WhatsApp/Email)'), ('SCAN_PDF', 'Scan de PDF assinado')], db_index=True, max_length=20)),
                ('signer_name', models.CharField(max_length=200)),
                ('signer_cpf', models.CharField(blank=True, default='', max_length=14)),
                ('signature_png_base64', models.TextField(help_text='PNG da assinatura em base64 (canvas do tablet ou scan)')),
                ('signature_hash', models.CharField(db_index=True, help_text='SHA256 do PNG + metadados (integridade/anti-tampering)', max_length=64)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.CharField(blank=True, default='', max_length=400)),
                ('signed_at', models.DateTimeField(db_index=True, default=django.utils.timezone.now, editable=False)),
                ('remote_token', models.CharField(blank=True, default='', max_length=500)),
                ('notes', models.TextField(blank=True, default='')),
                ('orcamento', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='signatures', to='quotes.orcamento')),
                ('service_order', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='signatures', to='service_orders.serviceorder')),
            ],
            options={
                'ordering': ['-signed_at'],
                'indexes': [models.Index(fields=['service_order', 'document_type', '-signed_at'], name='sig_os_doctype_idx'), models.Index(fields=['orcamento', 'document_type', '-signed_at'], name='sig_orcamento_doctype_idx')],
                'constraints': [models.CheckConstraint(check=models.Q(('service_order__isnull', False), ('orcamento__isnull', False), _connector='OR'), name='sig_requires_owner')],
            },
        ),
    ]
