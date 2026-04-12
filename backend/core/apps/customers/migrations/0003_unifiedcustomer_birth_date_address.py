from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("customers", "0002_unifiedcustomer_global_user"),
    ]

    operations = [
        migrations.AddField(
            model_name="unifiedcustomer",
            name="birth_date",
            field=models.DateField(blank=True, null=True, verbose_name="Data de nascimento"),
        ),
        migrations.AddField(
            model_name="unifiedcustomer",
            name="address",
            field=models.CharField(blank=True, default="", max_length=300, verbose_name="Endereço"),
        ),
    ]
