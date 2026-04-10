from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("service_orders", "0001_initial"),
        ("persons", "0001_initial"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="serviceorder",
            name="customer_id",
        ),
        migrations.AddField(
            model_name="serviceorder",
            name="customer",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="service_orders",
                to="persons.person",
                verbose_name="Cliente",
            ),
        ),
    ]
