"""
Paddock Solutions — Insurers Serializers
"""
import logging

from rest_framework import serializers

from apps.insurers.models import Insurer

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
    """Serializer compacto para uso em nested (exibição em OS)."""

    display_name = serializers.SerializerMethodField()
    logo = serializers.SerializerMethodField()

    class Meta:
        model = Insurer
        fields = ["id", "name", "trade_name", "brand_color", "abbreviation", "display_name", "logo", "uses_cilia"]

    def get_display_name(self, obj: Insurer) -> str:
        return obj.trade_name or obj.name

    def get_logo(self, obj: Insurer) -> str:
        """Return logo_url from Insurer; fall back to tenant Person.logo_url if empty."""
        if obj.logo_url:
            return obj.logo_url
        try:
            from apps.persons.models import Person  # tenant-level import
            lookup_name = obj.trade_name or obj.name
            person = (
                Person.objects
                .filter(roles__role="INSURER")
                .filter(full_name__iexact=lookup_name)
                .only("logo_url")
                .first()
            )
            if person and person.logo_url:
                return person.logo_url
        except Exception:
            logger.debug("Could not look up Person logo for insurer %s", obj.name)
        return ""
