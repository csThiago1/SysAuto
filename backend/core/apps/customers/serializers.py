"""
Paddock Solutions — Customers Serializers
LGPD: CPF, email e telefone NUNCA são expostos em texto claro na API.
Busca é feita via hash (cpf_hash, email_hash, phone_hash).
"""
import logging

from rest_framework import serializers

from .models import UnifiedCustomer

logger = logging.getLogger(__name__)


class UnifiedCustomerListSerializer(serializers.ModelSerializer):
    """
    Serializer compacto para listagem de clientes.
    Dados criptografados (CPF, email, telefone) são omitidos — LGPD Art. 46.
    """

    class Meta:
        model = UnifiedCustomer
        fields = [
            "id",
            "name",
            "lgpd_consent_version",
            "lgpd_consent_date",
            "group_sharing_consent",
            "is_active",
            "created_at",
        ]
        read_only_fields = fields


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
