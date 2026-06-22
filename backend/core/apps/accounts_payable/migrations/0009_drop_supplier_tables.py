"""Drop Supplier e SupplierContact — consolidados em persons.Person + PersonContact."""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("accounts_payable", "0008_swap_payable_supplier_fk"),
        ("accounting", "0005_swap_despesa_recorrente_fk"),
        ("purchasing", "0007_swap_purchasing_fks"),
    ]

    operations = [
        migrations.DeleteModel(name="SupplierContact"),
        migrations.DeleteModel(name="Supplier"),
    ]
