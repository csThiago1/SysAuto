"""Drop pricing_catalog.Fornecedor — tabela vazia, OneToOne Person foi consolidado via SupplierProfile."""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("pricing_catalog", "0003_swap_codigo_fornecedor"),
        ("purchasing", "0007_swap_purchasing_fks"),
    ]

    operations = [
        migrations.DeleteModel(name="Fornecedor"),
    ]
