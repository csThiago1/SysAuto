from django.conf import settings
from django.db import models


class Permission(models.Model):
    """Permissão nomeada. Ex: 'budget.approve', 'os.cancel', 'payment.record'.

    Nota: usa models.Model simples (não PaddockBaseModel) — tabela de catálogo sem auditoria de criação necessária.
    """

    code = models.CharField(max_length=60, unique=True)
    label = models.CharField(max_length=200)
    module = models.CharField(max_length=40, db_index=True)

    class Meta:
        ordering = ["module", "code"]

    def __str__(self) -> str:
        return self.code


class Role(models.Model):
    """Agrupamento de permissões. Seeds: OWNER, ADMIN, MANAGER, CONSULTANT, MECHANIC, FINANCIAL.

    Nota: usa models.Model simples (não PaddockBaseModel) — tabela de catálogo sem auditoria de criação necessária.
    """

    code = models.CharField(max_length=40, unique=True)
    label = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    permissions = models.ManyToManyField(Permission, through="RolePermission", related_name="roles")

    def __str__(self) -> str:
        return self.code


class RolePermission(models.Model):
    """M2M through entre Role e Permission."""

    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)

    class Meta:
        unique_together = [("role", "permission")]

    def __str__(self) -> str:
        return f"{self.role} → {self.permission}"


class UserRole(models.Model):
    """Atribui Role a um GlobalUser no schema do tenant."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="authz_user_roles",
    )
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="user_roles")

    class Meta:
        unique_together = [("user", "role")]

    def __str__(self) -> str:
        return f"{self.user} → {self.role}"


class UserPermission(models.Model):
    """Override individual: grant/revoke permissão específica — sobrepõe Role."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="authz_user_permissions",
    )
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)
    granted = models.BooleanField(default=True)

    class Meta:
        unique_together = [("user", "permission")]

    def __str__(self) -> str:
        return f"{self.user} → {self.permission} ({'grant' if self.granted else 'revoke'})"


class TenantPermissionOverride(models.Model):
    """Override de permissao padrao por role para este tenant.

    Permite que o admin do tenant customize quais permissoes cada role
    tem, diferindo da matriz padrao definida em permissions_config.py.
    Vive no schema do tenant (authz e TENANT_APP).
    """

    role = models.CharField(max_length=20, db_index=True)
    permission_code = models.CharField(max_length=50)
    allowed = models.BooleanField()

    class Meta:
        unique_together = [("role", "permission_code")]
        db_table = "authz_perm_overrides"
        verbose_name = "Override de Permissao"
        verbose_name_plural = "Overrides de Permissao"

    def __str__(self) -> str:
        status = "permitido" if self.allowed else "bloqueado"
        return f"{self.role} / {self.permission_code} → {status}"
