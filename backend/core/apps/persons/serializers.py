"""
Paddock Solutions — Persons Serializers
"""
import logging

from rest_framework import serializers

from .models import Person, PersonAddress, PersonContact, PersonRole

logger = logging.getLogger(__name__)


class PersonContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonContact
        fields = ["id", "contact_type", "value", "label", "is_primary"]


class PersonAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonAddress
        fields = [
            "id", "address_type", "zip_code", "street", "number",
            "complement", "neighborhood", "city", "state", "is_primary",
        ]


class PersonRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonRole
        fields = ["id", "role"]


class PersonListSerializer(serializers.ModelSerializer):
    """Serializer compacto para listagem — inclui contato principal."""

    roles = PersonRoleSerializer(many=True, read_only=True)
    primary_contact = serializers.SerializerMethodField()

    class Meta:
        model = Person
        fields = [
            "id", "full_name", "fantasy_name", "person_kind", "document",
            "roles", "primary_contact", "is_active", "logo_url", "created_at",
        ]
        read_only_fields = fields

    def get_primary_contact(self, obj: Person) -> dict | None:
        contact = obj.contacts.filter(is_primary=True).first() or obj.contacts.first()
        if contact:
            return {"type": contact.contact_type, "value": contact.value}
        return None


class PersonCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer de escrita com sync de roles, contatos e endereços."""

    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=["CLIENT", "INSURER", "BROKER", "EMPLOYEE", "SUPPLIER"]),
        write_only=True,
    )
    contacts = PersonContactSerializer(many=True, required=False)
    addresses = PersonAddressSerializer(many=True, required=False)

    class Meta:
        model = Person
        fields = [
            "person_kind", "full_name", "fantasy_name", "document",
            "secondary_document", "municipal_registration", "is_simples_nacional",
            "inscription_type", "birth_date", "gender", "logo_url", "insurer_code",
            "job_title", "department",
            "is_active", "notes", "roles", "contacts", "addresses",
        ]

    def validate_full_name(self, value: str) -> str:
        if len(value.strip()) < 2:
            raise serializers.ValidationError("Nome deve ter ao menos 2 caracteres.")
        return value.strip()

    def validate_roles(self, value: list) -> list:
        if not value:
            raise serializers.ValidationError("Pelo menos um role é obrigatório.")
        return list(set(value))

    def _sync_roles(self, person: Person, roles: list) -> None:
        existing = set(person.roles.values_list("role", flat=True))
        new_roles = set(roles)
        for role in new_roles - existing:
            PersonRole.objects.create(person=person, role=role)
        person.roles.filter(role__in=existing - new_roles).delete()

    def _sync_contacts(self, person: Person, contacts_data: list) -> None:
        person.contacts.all().delete()
        for c in contacts_data:
            PersonContact.objects.create(person=person, **c)

    def _sync_addresses(self, person: Person, addresses_data: list) -> None:
        person.addresses.all().delete()
        for a in addresses_data:
            PersonAddress.objects.create(person=person, **a)

    def create(self, validated_data: dict) -> Person:
        roles = validated_data.pop("roles")
        contacts = validated_data.pop("contacts", [])
        addresses = validated_data.pop("addresses", [])
        person = Person.objects.create(**validated_data)
        self._sync_roles(person, roles)
        self._sync_contacts(person, contacts)
        self._sync_addresses(person, addresses)
        return person

    def update(self, instance: Person, validated_data: dict) -> Person:
        roles = validated_data.pop("roles", None)
        contacts = validated_data.pop("contacts", None)
        addresses = validated_data.pop("addresses", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if roles is not None:
            self._sync_roles(instance, roles)
        if contacts is not None:
            self._sync_contacts(instance, contacts)
        if addresses is not None:
            self._sync_addresses(instance, addresses)
        return instance


class PersonDetailSerializer(serializers.ModelSerializer):
    """Serializer completo para detalhe de pessoa."""

    roles = PersonRoleSerializer(many=True, read_only=True)
    contacts = PersonContactSerializer(many=True, read_only=True)
    addresses = PersonAddressSerializer(many=True, read_only=True)
    job_title_display = serializers.CharField(source="get_job_title_display", read_only=True)
    department_display = serializers.CharField(source="get_department_display", read_only=True)

    class Meta:
        model = Person
        fields = [
            "id", "person_kind", "full_name", "fantasy_name", "document",
            "secondary_document", "municipal_registration", "is_simples_nacional",
            "inscription_type", "birth_date", "gender", "logo_url", "insurer_code",
            "job_title", "job_title_display", "department", "department_display",
            "is_active", "notes", "roles", "contacts", "addresses",
            "legacy_code", "legacy_category", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "job_title_display", "department_display", "created_at", "updated_at"]
