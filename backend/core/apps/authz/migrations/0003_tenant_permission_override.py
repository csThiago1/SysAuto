"""Add TenantPermissionOverride model for configurable RBAC matrix."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("authz", "0002_seed_roles"),
    ]

    operations = [
        migrations.CreateModel(
            name="TenantPermissionOverride",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("role", models.CharField(db_index=True, max_length=20)),
                ("permission_code", models.CharField(max_length=50)),
                ("allowed", models.BooleanField()),
            ],
            options={
                "db_table": "authz_perm_overrides",
                "verbose_name": "Override de Permissao",
                "verbose_name_plural": "Overrides de Permissao",
                "unique_together": {("role", "permission_code")},
            },
        ),
    ]
