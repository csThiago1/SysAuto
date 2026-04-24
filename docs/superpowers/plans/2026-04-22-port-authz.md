# Port `authz` App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the `authz` app from the worktree to the main branch — granular DB-backed permissions coexisting with the existing JWT RBAC.

**Architecture:** TENANT_APP with 5 models (Permission, Role, RolePermission, UserRole, UserPermission). Resolution: `UserPermission` overrides > Role membership > False. No existing code removed.

**Tech Stack:** Django 5, DRF, `django_tenants.test.cases.TenantTestCase`, `apps.authentication.permissions` (existing RBAC unchanged)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `backend/core/apps/authz/__init__.py` | Package marker |
| Create | `backend/core/apps/authz/apps.py` | AppConfig `AuthzConfig` |
| Create | `backend/core/apps/authz/models.py` | Permission, Role, RolePermission, UserRole, UserPermission |
| Create | `backend/core/apps/authz/services.py` | `user_has_perm(user, perm_code) -> bool` |
| Create | `backend/core/apps/authz/serializers.py` | Read serializers for all 5 models |
| Create | `backend/core/apps/authz/views.py` | 4 ViewSets with RBAC |
| Create | `backend/core/apps/authz/urls.py` | Router registration |
| Create | `backend/core/apps/authz/admin.py` | Admin registration |
| Create | `backend/core/apps/authz/migrations/__init__.py` | Package marker |
| Create | `backend/core/apps/authz/migrations/0001_initial.py` | All 5 tables |
| Create | `backend/core/apps/authz/migrations/0002_seed_roles.py` | 6 roles + 20 permissions |
| Create | `backend/core/apps/authz/tests/__init__.py` | Package marker |
| Create | `backend/core/apps/authz/tests/test_services.py` | Unit tests for `user_has_perm` |
| Create | `backend/core/apps/authz/tests/test_api.py` | API tests (RBAC) |
| Modify | `backend/core/config/settings/base.py` | Add `"apps.authz"` to `TENANT_APPS` |
| Modify | `backend/core/config/urls.py` | Add `/api/v1/authz/` URL prefix |

---

### Task 1: Scaffold App + Models + Migration 0001

**Files:**
- Create: `backend/core/apps/authz/__init__.py`
- Create: `backend/core/apps/authz/apps.py`
- Create: `backend/core/apps/authz/models.py`
- Create: `backend/core/apps/authz/admin.py`
- Create: `backend/core/apps/authz/migrations/__init__.py`
- Create: `backend/core/apps/authz/migrations/0001_initial.py`

- [ ] **Step 1: Write models**

`backend/core/apps/authz/apps.py`:
```python
from django.apps import AppConfig


class AuthzConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.authz"
    verbose_name = "Authorização Granular"
```

`backend/core/apps/authz/models.py`:
```python
from django.conf import settings
from django.db import models


class Permission(models.Model):
    """Permissão nomeada. Ex: 'budget.approve', 'os.cancel', 'payment.record'."""

    code = models.CharField(max_length=60, unique=True, db_index=True)
    label = models.CharField(max_length=200)
    module = models.CharField(max_length=40, db_index=True)

    class Meta:
        ordering = ["module", "code"]

    def __str__(self) -> str:
        return self.code


class Role(models.Model):
    """Agrupamento de permissões. Seeds: OWNER, ADMIN, MANAGER, CONSULTANT, MECHANIC, FINANCIAL."""

    code = models.CharField(max_length=40, unique=True, db_index=True)
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


class UserRole(models.Model):
    """Atribui Role a um GlobalUser no schema do tenant."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="authz_user_roles",
    )
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="user_roles")

    class Meta:
        unique_together = [("user", "role")]


class UserPermission(models.Model):
    """Override individual: grant/revoke permissão específica — sobrepõe Role."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="authz_user_permissions",
    )
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)
    granted = models.BooleanField(default=True)

    class Meta:
        unique_together = [("user", "permission")]
```

`backend/core/apps/authz/admin.py`:
```python
from django.contrib import admin
from .models import Permission, Role, RolePermission, UserRole, UserPermission

admin.site.register(Permission)
admin.site.register(Role)
admin.site.register(RolePermission)
admin.site.register(UserRole)
admin.site.register(UserPermission)
```

- [ ] **Step 2: Write migration 0001**

`backend/core/apps/authz/migrations/0001_initial.py`:
```python
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
```

- [ ] **Step 3: Apply migration to verify**

```bash
cd backend/core && .venv/bin/python manage.py migrate_schemas --schema=tenant_dscar --settings=config.settings.dev
```

Expected: Migration applied without errors.

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/authz/
git commit -m "feat(authz): scaffold app + models + migration 0001"
```

---

### Task 2: Service `user_has_perm` + Seed Migration + Tests

**Files:**
- Create: `backend/core/apps/authz/services.py`
- Create: `backend/core/apps/authz/migrations/0002_seed_roles.py`
- Create: `backend/core/apps/authz/tests/__init__.py`
- Create: `backend/core/apps/authz/tests/test_services.py`

- [ ] **Step 1: Write failing test**

`backend/core/apps/authz/tests/test_services.py`:
```python
"""Testes para authz.services.user_has_perm."""
from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.authz.models import Permission, Role, RolePermission, UserPermission, UserRole
from apps.authz.services import user_has_perm


class UserHasPermTest(TenantTestCase):

    def setUp(self) -> None:
        super().setUp()
        self.user = GlobalUser.objects.create_user(email="test@x.com", password="pw")
        self.perm = Permission.objects.create(code="budget.approve", label="Aprovar", module="budget")

    def test_userpermission_granted_true_returns_true(self) -> None:
        UserPermission.objects.create(user=self.user, permission=self.perm, granted=True)
        assert user_has_perm(self.user, "budget.approve") is True

    def test_userpermission_granted_false_blocks_even_with_role(self) -> None:
        role = Role.objects.create(code="MANAGER", label="Gerente")
        RolePermission.objects.create(role=role, permission=self.perm)
        UserRole.objects.create(user=self.user, role=role)
        UserPermission.objects.create(user=self.user, permission=self.perm, granted=False)
        assert user_has_perm(self.user, "budget.approve") is False

    def test_role_grants_permission(self) -> None:
        role = Role.objects.create(code="ADMIN", label="Admin")
        RolePermission.objects.create(role=role, permission=self.perm)
        UserRole.objects.create(user=self.user, role=role)
        assert user_has_perm(self.user, "budget.approve") is True

    def test_no_role_no_override_returns_false(self) -> None:
        assert user_has_perm(self.user, "budget.approve") is False

    def test_unknown_perm_code_returns_false(self) -> None:
        assert user_has_perm(self.user, "nonexistent.perm") is False
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend/core && .venv/bin/pytest apps/authz/tests/test_services.py -v
```

Expected: `ImportError` or `ModuleNotFoundError` (services.py doesn't exist yet).

- [ ] **Step 3: Write service**

`backend/core/apps/authz/services.py`:
```python
from django.contrib.auth import get_user_model

from .models import RolePermission, UserPermission


User = get_user_model()


def user_has_perm(user: User, perm_code: str) -> bool:  # type: ignore[valid-type]
    """Resolve permissão com precedência UserPermission > Role > negação.

    1. Se UserPermission explícita existe: retorna `granted` (máxima prioridade).
    2. Se algum Role do usuário tem a permissão: True.
    3. Caso contrário: False.
    """
    override = (
        UserPermission.objects.filter(user=user, permission__code=perm_code)
        .only("granted")
        .first()
    )
    if override is not None:
        return override.granted

    return RolePermission.objects.filter(
        role__user_roles__user=user, permission__code=perm_code,
    ).exists()
```

- [ ] **Step 4: Write seed migration 0002**

`backend/core/apps/authz/migrations/0002_seed_roles.py`:
```python
"""Seed: 6 roles padrão + ~20 permissões canônicas."""
from django.db import migrations


PERMISSIONS = [
    # (code, label, module)
    ("budget.view", "Ver orçamentos", "budget"),
    ("budget.create", "Criar orçamento", "budget"),
    ("budget.approve", "Aprovar orçamento", "budget"),
    ("budget.reject", "Recusar orçamento", "budget"),
    ("os.view", "Ver OS", "os"),
    ("os.create", "Abrir OS", "os"),
    ("os.cancel", "Cancelar OS", "os"),
    ("os.import_xml", "Importar XML de seguradora", "os"),
    ("os.change_status", "Transicionar status de OS", "os"),
    ("payment.view", "Ver pagamentos", "payment"),
    ("payment.record", "Registrar pagamento", "payment"),
    ("payment.refund", "Estornar pagamento", "payment"),
    ("vehicle.view", "Ver veículos", "vehicle"),
    ("vehicle.create", "Cadastrar veículo", "vehicle"),
    ("vehicle.lookup", "Consultar placa externa", "vehicle"),
    ("import.view", "Ver tentativas de importação", "import"),
    ("import.trigger", "Disparar importação Cilia", "import"),
    ("import.upload_xml", "Upload de XML seguradora", "import"),
    ("authz.manage_roles", "Gerenciar roles de usuários", "authz"),
    ("authz.manage_perms", "Gerenciar permissões de usuários", "authz"),
]

ROLES = [
    # (code, label, perm_codes)
    ("OWNER", "Proprietário", [p[0] for p in PERMISSIONS]),
    ("ADMIN", "Administrador", [p[0] for p in PERMISSIONS]),
    (
        "MANAGER",
        "Gerente",
        [
            "budget.view", "budget.create", "budget.approve", "budget.reject",
            "os.view", "os.create", "os.cancel", "os.change_status",
            "payment.view", "payment.record", "payment.refund",
            "vehicle.view", "vehicle.create", "vehicle.lookup",
            "import.view", "import.trigger", "import.upload_xml",
        ],
    ),
    (
        "CONSULTANT",
        "Consultor",
        [
            "budget.view", "budget.create",
            "os.view", "os.create", "os.change_status",
            "payment.view",
            "vehicle.view", "vehicle.lookup",
            "import.view",
        ],
    ),
    (
        "MECHANIC",
        "Mecânico",
        ["os.view", "os.change_status", "vehicle.view"],
    ),
    (
        "FINANCIAL",
        "Financeiro",
        ["payment.view", "payment.record", "payment.refund", "budget.view"],
    ),
]


def seed_roles(apps, schema_editor):
    Permission = apps.get_model("authz", "Permission")
    Role = apps.get_model("authz", "Role")
    RolePermission = apps.get_model("authz", "RolePermission")

    perms_by_code = {}
    for code, label, module in PERMISSIONS:
        p, _ = Permission.objects.get_or_create(code=code, defaults={"label": label, "module": module})
        perms_by_code[code] = p

    for code, label, perm_codes in ROLES:
        role, _ = Role.objects.get_or_create(code=code, defaults={"label": label})
        for perm_code in perm_codes:
            perm = perms_by_code.get(perm_code)
            if perm:
                RolePermission.objects.get_or_create(role=role, permission=perm)


def unseed_roles(apps, schema_editor):
    pass  # Não remove dados em rollback — operação segura


class Migration(migrations.Migration):

    dependencies = [
        ("authz", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_roles, unseed_roles),
    ]
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd backend/core && .venv/bin/pytest apps/authz/tests/test_services.py -v
```

Expected: 5/5 PASSED.

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/authz/services.py backend/core/apps/authz/migrations/0002_seed_roles.py backend/core/apps/authz/tests/
git commit -m "feat(authz): user_has_perm service + seed migration + unit tests"
```

---

### Task 3: Serializers + ViewSets + URLs + Registration

**Files:**
- Create: `backend/core/apps/authz/serializers.py`
- Create: `backend/core/apps/authz/views.py`
- Create: `backend/core/apps/authz/urls.py`
- Create: `backend/core/apps/authz/tests/test_api.py`
- Modify: `backend/core/config/settings/base.py`
- Modify: `backend/core/config/urls.py`

- [ ] **Step 1: Write failing API tests**

`backend/core/apps/authz/tests/test_api.py`:
```python
"""API tests para authz endpoints."""
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.authz.models import Permission, Role, UserRole


class AuthzAPITestCase(TenantTestCase):

    def setUp(self) -> None:
        super().setUp()
        self.user = GlobalUser.objects.create_user(email="api@x.com", password="pw")
        self.client = APIClient()
        self.client.defaults["HTTP_X_TENANT_DOMAIN"] = self.domain.domain
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})

    def test_list_permissions_returns_200(self) -> None:
        Permission.objects.create(code="budget.view", label="Ver", module="budget")
        resp = self.client.get("/api/v1/authz/permissions/")
        assert resp.status_code == 200
        assert len(resp.data["results"]) == 1

    def test_list_roles_returns_200(self) -> None:
        Role.objects.create(code="MANAGER", label="Gerente")
        resp = self.client.get("/api/v1/authz/roles/")
        assert resp.status_code == 200
        assert resp.data["results"][0]["code"] == "MANAGER"

    def test_create_user_role_as_admin(self) -> None:
        role = Role.objects.create(code="CONSULTANT", label="Consultor")
        user2 = GlobalUser.objects.create_user(email="u2@x.com", password="pw")
        resp = self.client.post("/api/v1/authz/user-roles/", {"user": user2.id, "role": role.id}, format="json")
        assert resp.status_code == 201

    def test_create_user_role_as_consultant_forbidden(self) -> None:
        self.client.force_authenticate(user=self.user, token={"role": "CONSULTANT"})
        role = Role.objects.create(code="MECHANIC", label="Mecânico")
        resp = self.client.post("/api/v1/authz/user-roles/", {"user": self.user.id, "role": role.id}, format="json")
        assert resp.status_code == 403

    def test_create_user_permission_as_admin(self) -> None:
        perm = Permission.objects.create(code="os.cancel", label="Cancelar", module="os")
        resp = self.client.post(
            "/api/v1/authz/user-permissions/",
            {"user": self.user.id, "permission": perm.id, "granted": True},
            format="json",
        )
        assert resp.status_code == 201
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend/core && .venv/bin/pytest apps/authz/tests/test_api.py -v
```

Expected: 404 errors or import errors (routes not registered).

- [ ] **Step 3: Write serializers**

`backend/core/apps/authz/serializers.py`:
```python
from rest_framework import serializers

from .models import Permission, Role, RolePermission, UserPermission, UserRole


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["id", "code", "label", "module"]


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "code", "label", "description"]


class UserRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserRole
        fields = ["id", "user", "role"]


class UserPermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPermission
        fields = ["id", "user", "permission", "granted"]
```

- [ ] **Step 4: Write views**

`backend/core/apps/authz/views.py`:
```python
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.authentication.permissions import IsAdminOrAbove, IsConsultantOrAbove

from .models import Permission, Role, UserPermission, UserRole
from .serializers import (
    PermissionSerializer,
    RoleSerializer,
    UserPermissionSerializer,
    UserRoleSerializer,
)


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista permissões do catálogo (CONSULTANT+)."""

    queryset = Permission.objects.all().order_by("module", "code")
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]


class RoleViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista roles do catálogo (CONSULTANT+)."""

    queryset = Role.objects.all().order_by("code")
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]


class UserRoleViewSet(viewsets.ModelViewSet):
    """Atribui/remove roles de usuários (ADMIN+ para escrita)."""

    queryset = UserRole.objects.select_related("user", "role").all()
    serializer_class = UserRoleSerializer
    permission_classes = [IsAuthenticated, IsAdminOrAbove]

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), IsConsultantOrAbove()]
        return [IsAuthenticated(), IsAdminOrAbove()]


class UserPermissionViewSet(viewsets.ModelViewSet):
    """Overrides individuais de permissão (ADMIN+ para escrita)."""

    queryset = UserPermission.objects.select_related("user", "permission").all()
    serializer_class = UserPermissionSerializer
    permission_classes = [IsAuthenticated, IsAdminOrAbove]

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), IsConsultantOrAbove()]
        return [IsAuthenticated(), IsAdminOrAbove()]
```

- [ ] **Step 5: Write URLs**

`backend/core/apps/authz/urls.py`:
```python
from rest_framework.routers import SimpleRouter

from .views import PermissionViewSet, RoleViewSet, UserPermissionViewSet, UserRoleViewSet

router = SimpleRouter()
router.register(r"permissions", PermissionViewSet, basename="authz-permission")
router.register(r"roles", RoleViewSet, basename="authz-role")
router.register(r"user-roles", UserRoleViewSet, basename="authz-user-role")
router.register(r"user-permissions", UserPermissionViewSet, basename="authz-user-permission")

urlpatterns = router.urls
```

- [ ] **Step 6: Register in settings and urls**

In `backend/core/config/settings/base.py`, add `"apps.authz"` to the `TENANT_APPS` list (after `"apps.items"`):
```python
TENANT_APPS = [
    # ... existing entries ...
    "apps.items",
    "apps.authz",   # ← add this line
    # ...
]
```

In `backend/core/config/urls.py`, add after the insurers line:
```python
path("api/v1/authz/", include("apps.authz.urls")),
```

- [ ] **Step 7: Apply migration**

```bash
cd backend/core && .venv/bin/python manage.py migrate_schemas --schema=tenant_dscar --settings=config.settings.dev
```

Expected: 0002_seed_roles applied.

- [ ] **Step 8: Run API tests**

```bash
cd backend/core && .venv/bin/pytest apps/authz/tests/ -v
```

Expected: 9/9 PASSED (5 service + 5 API — but 0002 seed means roles exist, so the tests that create roles manually still work since `get_or_create` is idempotent).

- [ ] **Step 9: Run full backend suite to confirm no regressions**

```bash
cd backend/core && .venv/bin/pytest --tb=short -q
```

Expected: All previously passing tests still pass.

- [ ] **Step 10: Commit**

```bash
git add backend/core/apps/authz/ backend/core/config/settings/base.py backend/core/config/urls.py
git commit -m "feat(authz): serializers + views + urls + registration — app completo"
```
