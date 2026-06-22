"""Swap: drop supplier FK antiga, rename person → supplier."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [("accounts_payable", "0007_add_payable_person_fk")]

    operations = [
        migrations.RemoveField(model_name="payabledocument", name="supplier"),
        migrations.RenameField(
            model_name="payabledocument",
            old_name="person",
            new_name="supplier",
        ),
        migrations.AlterField(
            model_name="payabledocument",
            name="supplier",
            field=models.ForeignKey(
                on_delete=models.deletion.PROTECT,
                related_name="payables",
                to="persons.person",
                limit_choices_to={"roles__role": "SUPPLIER"},
                verbose_name="Fornecedor",
            ),
        ),
    ]
