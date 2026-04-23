from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Permission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True)),
                ("code", models.CharField(max_length=60, unique=True, db_index=True)),
                ("label", models.CharField(max_length=200)),
                ("module", models.CharField(max_length=40, db_index=True)),
            ],
            options={"ordering": ["module", "code"]},
        ),
        migrations.CreateModel(
            name="Role",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True)),
                ("code", models.CharField(max_length=40, unique=True, db_index=True)),
                ("label", models.CharField(max_length=100)),
                ("description", models.TextField(blank=True, default="")),
            ],
        ),
        migrations.CreateModel(
            name="RolePermission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True)),
                ("role", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="role_permissions", to="authz.role")),
                ("permission", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="authz.permission")),
            ],
            options={"unique_together": {("role", "permission")}},
        ),
        migrations.AddField(
            model_name="role",
            name="permissions",
            field=models.ManyToManyField(related_name="roles", through="authz.RolePermission", to="authz.permission"),
        ),
        migrations.CreateModel(
            name="UserRole",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="authz_user_roles", to=settings.AUTH_USER_MODEL)),
                ("role", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="user_roles", to="authz.role")),
            ],
            options={"unique_together": {("user", "role")}},
        ),
        migrations.CreateModel(
            name="UserPermission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True)),
                ("granted", models.BooleanField(default=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="authz_user_permissions", to=settings.AUTH_USER_MODEL)),
                ("permission", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="authz.permission")),
            ],
            options={"unique_together": {("user", "permission")}},
        ),
    ]
