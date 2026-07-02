"""
Paddock Solutions — Authentication Serializers
"""
from rest_framework import serializers

from .models import GlobalUser


class StaffUserSerializer(serializers.ModelSerializer):
    """Serializer para listagem e gestao de usuarios."""

    job_title_display = serializers.CharField(source="get_job_title_display", read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = GlobalUser
        fields = [
            "id", "name", "email_hash", "role", "role_display",
            "job_title", "job_title_display", "is_active", "email_verified",
            "created_at",
        ]
        read_only_fields = ["id", "email_hash", "email_verified", "created_at"]


class EmployeeSnapshotSerializer(serializers.Serializer):
    """
    Snapshot resumido do perfil de colaborador do usuário.
    Retornado apenas quando o GlobalUser tem Employee no tenant atual.
    """

    id = serializers.UUIDField()
    department = serializers.CharField()
    position = serializers.CharField()
    status = serializers.CharField()
    registration_number = serializers.CharField()


class CustomerSnapshotSerializer(serializers.Serializer):
    """
    Snapshot resumido do perfil de cliente do usuário.
    Retornado apenas quando o GlobalUser tem UnifiedCustomer vinculado.
    """

    id = serializers.UUIDField()
    name = serializers.CharField()
    phone_masked = serializers.SerializerMethodField()
    cpf_masked = serializers.SerializerMethodField()

    def get_phone_masked(self, obj: object) -> str:
        """Retorna telefone mascarado: (**) *****-XXXX."""
        from apps.customers.models import UnifiedCustomer

        if isinstance(obj, UnifiedCustomer):
            phone = str(obj.phone or "")
            if len(phone) >= 4:
                return "(**) *****-" + phone[-4:]
        return ""

    def get_cpf_masked(self, obj: object) -> str:
        """Retorna CPF mascarado: ***.***.***-XX."""
        from apps.customers.models import UnifiedCustomer

        if isinstance(obj, UnifiedCustomer):
            cpf = str(obj.cpf or "")
            if len(cpf) >= 2:
                return "***.***.***-" + cpf[-2:]
        return ""


PADDOCK_ROLE_CHOICES = ["OWNER", "ADMIN", "MANAGER", "CONSULTANT", "STOREKEEPER"]


class MeSerializer(serializers.Serializer):
    """
    Serializer para o endpoint /me — identidade completa do usuário autenticado.
    Agrega GlobalUser + Employee (se existir no tenant) + UnifiedCustomer (se vinculado).
    """

    id = serializers.UUIDField()
    name = serializers.CharField()
    email_hash = serializers.CharField()
    role = serializers.ChoiceField(choices=PADDOCK_ROLE_CHOICES)
    extra_permissions = serializers.ListField(
        child=serializers.CharField(),
        help_text="Overrides individuais vindos do JWT (permission_service).",
    )
    active_company = serializers.CharField()
    tenant_schema = serializers.CharField()
    is_employee = serializers.BooleanField()
    is_customer = serializers.BooleanField()
    employee = EmployeeSnapshotSerializer(allow_null=True)
    customer = CustomerSnapshotSerializer(allow_null=True)


# ── Serializers apenas pra documentação OpenAPI ──────────────────────────────
# Os endpoints correspondentes aceitam/retornam dicts — estes serializers
# NÃO validam dados (as views fazem isso à mão), só descrevem shape pro
# drf-spectacular e pro codegen de tipos TS.


class LoginRequestSerializer(serializers.Serializer):
    """Body de POST /auth/login/."""

    email = serializers.CharField(help_text="Email OU username do usuário")
    password = serializers.CharField(style={"input_type": "password"})


class TokenPairSerializer(serializers.Serializer):
    """Retornado por /auth/login/ e /auth/refresh/."""

    access = serializers.CharField(help_text="JWT access token (TTL curto)")
    refresh = serializers.CharField(help_text="JWT refresh token (TTL longo)")


class RefreshRequestSerializer(serializers.Serializer):
    """Body de POST /auth/refresh/."""

    refresh = serializers.CharField()


class RegisterRequestSerializer(serializers.Serializer):
    """Body de POST /auth/register/ (admin cria usuário)."""

    email = serializers.EmailField()
    name = serializers.CharField()
    role = serializers.ChoiceField(
        choices=["OWNER", "ADMIN", "MANAGER", "CONSULTANT", "STOREKEEPER"]
    )
    password = serializers.CharField(style={"input_type": "password"})


class ForgotPasswordRequestSerializer(serializers.Serializer):
    """Body de POST /auth/forgot-password/."""

    email = serializers.EmailField()


class ResetPasswordRequestSerializer(serializers.Serializer):
    """Body de POST /auth/reset-password/."""

    token = serializers.CharField(help_text="Token raw enviado por email")
    password = serializers.CharField(
        style={"input_type": "password"}, min_length=8
    )


class VerifyEmailRequestSerializer(serializers.Serializer):
    """Body de POST /auth/verify-email/."""

    token = serializers.CharField(help_text="Token raw enviado por email")


class DetailResponseSerializer(serializers.Serializer):
    """Resposta genérica {"detail": "mensagem"} — usada em muitos endpoints."""

    detail = serializers.CharField()
