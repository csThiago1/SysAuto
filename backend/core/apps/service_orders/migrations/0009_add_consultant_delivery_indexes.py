"""
Add DB indexes for consultant and estimated_delivery_date.
These columns are hot paths in overdue queries and consultant-filtered lists.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("service_orders", "0008_budget_snapshot_photo_folder"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="serviceorder",
            index=models.Index(fields=["consultant"], name="so_consultant_idx"),
        ),
        migrations.AddIndex(
            model_name="serviceorder",
            index=models.Index(fields=["estimated_delivery_date"], name="so_est_delivery_idx"),
        ),
    ]
