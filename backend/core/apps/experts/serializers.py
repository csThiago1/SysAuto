"""
Paddock Solutions — Experts Serializers
"""
from rest_framework import serializers

from apps.experts.models import Expert
from apps.insurers.models import Insurer
from apps.insurers.serializers import InsurerMinimalSerializer


class ExpertSerializer(serializers.ModelSerializer):
    """Serializer completo para peritos."""

    insurers_detail = InsurerMinimalSerializer(source="insurers", many=True, read_only=True)
    insurer_ids = serializers.PrimaryKeyRelatedField(
        source="insurers",
        many=True,
        read_only=True,
    )

    class Meta:
        model = Expert
        fields = [
            "id",
            "name",
            "registration_number",
            "phone",
            "email",
            "insurer_ids",
            "insurers_detail",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ExpertMinimalSerializer(serializers.ModelSerializer):
    """Serializer compacto para uso em nested (exibição em OS)."""

    class Meta:
        model = Expert
        fields = ["id", "name", "registration_number", "phone"]


class ExpertCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação e atualização de peritos."""

    insurer_ids = serializers.PrimaryKeyRelatedField(
        source="insurers",
        many=True,
        queryset=Insurer.objects.all(),
        required=False,
    )

    class Meta:
        model = Expert
        fields = ["name", "registration_number", "phone", "email", "insurer_ids", "is_active"]
