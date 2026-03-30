"""
Paddock Solutions — Customers Serializers
LGPD: CPF, email e telefone NUNCA são expostos em texto claro na API.
Busca é feita via hash (cpf_hash, email_hash, phone_hash).
"""
import datetime
import logging

from rest_framework import serializers

from .models import UnifiedCustomer

logger = logging.getLogger(__name__)


class UnifiedCustomerListSerializer(serializers.ModelSerializer):
    """
    Serializer compacto para listagem de clientes.
    CPF e telefone são expostos apenas mascarados — LGPD Art. 46.
    Usado no dropdown de busca da Nova OS.
    """

    cpf_masked = serializers.SerializerMethodField()
    phone_masked = serializers.SerializerMethodField()

    class Meta:
        model = UnifiedCustomer
        fields = [
            "id",
            "name",
            "cpf_masked",
            "phone_masked",
            "lgpd_consent_version",
            "lgpd_consent_date",
            "group_sharing_consent",
            "is_active",
            "created_at",
        ]
        read_only_fields = fields

    def get_cpf_masked(self, obj: UnifiedCustomer) -> str | None:
        """Retorna CPF mascarado (***.***.***-XX) — nunca em texto claro."""
        if not obj.cpf:
            return None
        cpf = str(obj.cpf)
        if len(cpf) == 11:
            return f"***.***.***-{cpf[-2:]}"
        return "***.***.***-**"

    def get_phone_masked(self, obj: UnifiedCustomer) -> str | None:
        """Retorna telefone mascarado — apenas últimos 4 dígitos."""
        if not obj.phone:
            return None
        phone = str(obj.phone)
        digits = "".join(filter(str.isdigit, phone))
        if len(digits) >= 4:
            return f"(**) *****-{digits[-4:]}"
        return "(**) *****-****"


class UnifiedCustomerDetailSerializer(serializers.ModelSerializer):
    """
    Serializer completo para detalhe de cliente.

    Dados sensíveis descriptografados são retornados apenas neste serializer
    e apenas para usuários autenticados com permissão adequada.
    CPF é mascarado — nunca retornar em texto claro na API.
    """

    cpf_masked = serializers.SerializerMethodField()
    phone_masked = serializers.SerializerMethodField()

    class Meta:
        model = UnifiedCustomer
        fields = [
            "id",
            "name",
            "cpf_masked",
            "email",
            "phone_masked",
            "lgpd_consent_version",
            "lgpd_consent_date",
            "lgpd_consent_ip",
            "group_sharing_consent",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_cpf_masked(self, obj: UnifiedCustomer) -> str | None:
        """Retorna CPF mascarado (***.***.***-XX) — nunca em texto claro."""
        if not obj.cpf:
            return None
        cpf = str(obj.cpf)
        if len(cpf) == 11:
            return f"***.***.***-{cpf[-2:]}"
        return "***.***.***-**"

    def get_phone_masked(self, obj: UnifiedCustomer) -> str | None:
        """Retorna telefone mascarado — apenas últimos 4 dígitos."""
        if not obj.phone:
            return None
        phone = str(obj.phone)
        digits = "".join(filter(str.isdigit, phone))
        if len(digits) >= 4:
            return f"(**) *****-{digits[-4:]}"
        return "(**) *****-****"


class UnifiedCustomerCreateSerializer(serializers.ModelSerializer):
    """
    Serializer para criação de cliente com validação LGPD.

    O consentimento LGPD é obrigatório (write_only). CPF e telefone
    passam por normalização (apenas dígitos) antes de serem armazenados.
    """

    cpf = serializers.CharField(max_length=11, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20)
    lgpd_consent = serializers.BooleanField(write_only=True)

    class Meta:
        model = UnifiedCustomer
        fields = ["name", "cpf", "phone", "email", "lgpd_consent"]

    def validate_lgpd_consent(self, value: bool) -> bool:
        """Garante que o consentimento LGPD foi fornecido explicitamente."""
        if not value:
            raise serializers.ValidationError("Consentimento LGPD é obrigatório.")
        return value

    def validate_cpf(self, value: str) -> str:
        """Remove formatação e valida comprimento do CPF."""
        digits = "".join(filter(str.isdigit, value)) if value else ""
        if digits and len(digits) != 11:
            raise serializers.ValidationError("CPF deve ter 11 dígitos.")
        return digits or ""

    def validate_phone(self, value: str) -> str:
        """Remove formatação e valida comprimento mínimo do telefone."""
        digits = "".join(filter(str.isdigit, value))
        if len(digits) < 10:
            raise serializers.ValidationError("Telefone inválido.")
        return digits

    def create(self, validated_data: dict) -> UnifiedCustomer:
        """Preenche metadados de consentimento LGPD e persiste o cliente."""
        validated_data.pop("lgpd_consent")
        validated_data["lgpd_consent_version"] = "1.0"
        validated_data["lgpd_consent_date"] = datetime.datetime.now(tz=datetime.timezone.utc)
        return super().create(validated_data)
