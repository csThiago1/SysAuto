"""
Paddock Solutions — Insurers Serializers
"""

import logging

from rest_framework import serializers

from apps.insurers.models import Insurer, InsurerTenantProfile
from apps.lookups.validators import clean_cnpj, is_valid_cnpj

logger = logging.getLogger(__name__)


class InsurerSerializer(serializers.ModelSerializer):
    """
    Serializer completo para seguradoras.

    O DV só é validado em CNPJ novo ou alterado: o seed tem CNPJs com DV inválido.
    """

    class Meta:
        model = Insurer
        fields = [
            "id",
            "code",
            "name",
            "trade_name",
            "trade_names",
            "cnpj",
            "cnpjs",
            "susep_code",
            "brand_color",
            "abbreviation",
            "logo_url",
            "is_active",
            "uses_cilia",
        ]
        read_only_fields = ["id", "code"]

    def _known_cnpjs(self) -> set[str]:
        if self.instance is None:
            return set()
        return {clean_cnpj(self.instance.cnpj), *self.instance.cnpjs}

    def validate_cnpj(self, value: str) -> str:
        if clean_cnpj(value) not in self._known_cnpjs() and not is_valid_cnpj(value):
            raise serializers.ValidationError("CNPJ inválido.")
        return value

    def validate_cnpjs(self, value: list[str]) -> list[str]:
        digits = [clean_cnpj(c) for c in value]
        known = self._known_cnpjs()
        invalid = [c for c in digits if c not in known and not is_valid_cnpj(c)]
        if invalid:
            raise serializers.ValidationError(f"CNPJ inválido: {', '.join(invalid)}.")
        return digits


class InsurerMinimalSerializer(serializers.ModelSerializer):
    """Serializer padrão para lista e uso nested em OS."""

    display_name = serializers.SerializerMethodField()
    logo = serializers.SerializerMethodField()

    class Meta:
        model = Insurer
        fields = [
            "id",
            "code",
            "name",
            "trade_name",
            "cnpj",
            "cnpjs",
            "brand_color",
            "abbreviation",
            "display_name",
            "logo",
            "logo_url",
            "uses_cilia",
            "is_active",
        ]
        read_only_fields = ["code", "cnpjs"]

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
