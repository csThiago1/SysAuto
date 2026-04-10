"""
Paddock Solutions — Authentication Serializers
"""
from rest_framework import serializers

from .models import GlobalUser


class StaffUserSerializer(serializers.ModelSerializer):
    """Serializer para listagem e atualização de job_title de funcionários."""

    job_title_display = serializers.CharField(source="get_job_title_display", read_only=True)

    class Meta:
        model = GlobalUser
        fields = ["id", "name", "job_title", "job_title_display"]
        read_only_fields = ["id", "name"]


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


class MeSerializer(serializers.Serializer):
    """
    Serializer para o endpoint /me — identidade completa do usuário autenticado.
    Agrega GlobalUser + Employee (se existir no tenant) + UnifiedCustomer (se vinculado).
    """

    id = serializers.UUIDField()
    name = serializers.CharField()
    email_hash = serializers.CharField()
    role = serializers.CharField()
    active_company = serializers.CharField()
    tenant_schema = serializers.CharField()
    is_employee = serializers.BooleanField()
    is_customer = serializers.BooleanField()
    employee = EmployeeSnapshotSerializer(allow_null=True)
    customer = CustomerSnapshotSerializer(allow_null=True)
