"""
Paddock Solutions — Insurers Serializers
"""
import logging

from rest_framework import serializers

from apps.insurers.models import Insurer, InsurerTenantProfile

logger = logging.getLogger(__name__)


class InsurerSerializer(serializers.ModelSerializer):
    """Serializer completo para seguradoras."""

    class Meta:
        model = Insurer
        fields = [
            "id",
            "name",
            "trade_name",
            "cnpj",
            "brand_color",
            "abbreviation",
            "logo_url",
            "is_active",
            "uses_cilia",
        ]
        read_only_fields = ["id"]


class InsurerMinimalSerializer(serializers.ModelSerializer):
    """Serializer padrão para lista e uso nested em OS."""

    display_name = serializers.SerializerMethodField()
    logo = serializers.SerializerMethodField()

    class Meta:
        model = Insurer
        fields = [
            "id", "name", "trade_name", "cnpj", "brand_color",
            "abbreviation", "display_name", "logo", "logo_url",
            "uses_cilia", "is_active",
        ]

    def get_display_name(self, obj: Insurer) -> str:
        return obj.trade_name or obj.name

    def get_logo(self, obj: Insurer) -> str:
        """Return logo_url from Insurer model.

        Note: Person.logo_url was removed in Ciclo 07 — logo is now stored
        exclusively on the Insurer model via upload_logo endpoint.
        """
        return obj.logo_url or ""


class InsurerTenantProfileSerializer(serializers.ModelSerializer):
    """Serializer para o perfil operacional da seguradora por tenant."""

    class Meta:
        model = InsurerTenantProfile
        fields = [
            "contact_sinistro_nome",
            "contact_sinistro_phone",
            "contact_sinistro_email",
            "contact_financeiro_nome",
            "contact_financeiro_phone",
            "contact_financeiro_email",
            "contact_comercial_nome",
            "contact_comercial_phone",
            "contact_comercial_email",
            "portal_url",
            "sla_dias_uteis",
            "observacoes_operacionais",
            "import_tool",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]
