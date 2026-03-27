from rest_framework import serializers

from .models import Person


class PersonListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Person
        fields = ["id", "full_name", "person_type", "phone", "email", "is_active", "created_at"]
        read_only_fields = fields


class PersonCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Person
        fields = ["full_name", "person_type", "phone", "email"]

    def validate_full_name(self, value: str) -> str:
        if len(value.strip()) < 3:
            raise serializers.ValidationError("Nome deve ter ao menos 3 caracteres.")
        return value.strip()


class PersonDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Person
        fields = ["id", "full_name", "person_type", "phone", "email", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]
