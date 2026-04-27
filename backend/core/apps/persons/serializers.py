"""
Paddock Solutions — Persons Serializers

LGPD (Ciclo 06A):
  - PersonContactSerializer: value mascarado por padrão; plain apenas com fiscal_admin
  - PersonDocumentMaskedSerializer: exibe CPF/CNPJ mascarado (padrão)
  - PersonDocumentPlainSerializer: exibe CPF/CNPJ completo (requer fiscal_admin)
  - PersonDetailSerializer: inclui documents e contacts mascarados
"""

import logging

from rest_framework import serializers

from .models import (
    BrokerOffice,
    BrokerPerson,
    ClientProfile,
    Person,
    PersonAddress,
    PersonContact,
    PersonDocument,
    PersonRole,
)
from .utils import sha256_hex

logger = logging.getLogger(__name__)


def _mask_value(value: str) -> str:
    """Mascara valor deixando apenas os últimos 4 chars visíveis."""
    if not value:
        return "****"
    if len(value) > 4:
        return f"{'*' * (len(value) - 4)}{value[-4:]}"
    return "****"


class PersonDocumentMaskedSerializer(serializers.ModelSerializer):
    """Serializer de documento com PII mascarada — padrão para todos os usuários."""

    value_masked = serializers.SerializerMethodField()

    class Meta:
        model = PersonDocument
        fields = [
            "id",
            "doc_type",
            "value_masked",
            "is_primary",
            "issued_by",
            "issued_at",
            "expires_at",
        ]
        read_only_fields = fields

    def get_value_masked(self, obj: PersonDocument) -> str:
        """Retorna CPF mascarado: ***456789-01 → '*****.456.789-**'."""
        v: str = obj.value or ""
        return _mask_value(v)


class PersonDocumentPlainSerializer(serializers.ModelSerializer):
    """Serializer de documento com PII em plaintext — apenas para fiscal_admin."""

    class Meta:
        model = PersonDocument
        fields = [
            "id",
            "doc_type",
            "value",
            "value_hash",
            "is_primary",
            "issued_by",
            "issued_at",
            "expires_at",
        ]
        read_only_fields = fields


class PersonDocumentWriteSerializer(serializers.ModelSerializer):
    """Serializer de escrita para PersonDocument — popula value_hash automaticamente."""

    class Meta:
        model = PersonDocument
        fields = [
            "doc_type",
            "value",
            "is_primary",
            "issued_by",
            "issued_at",
            "expires_at",
        ]

    def validate(self, attrs: dict) -> dict:
        """Popula value_hash a partir de value."""
        value = attrs.get("value", "")
        if value:
            attrs["value_hash"] = sha256_hex(value)
        return attrs

    def create(self, validated_data: dict) -> PersonDocument:
        return PersonDocument.objects.create(**validated_data)


class PersonContactSerializer(serializers.ModelSerializer):
    """Contato mascarado — padrão para todos os usuários.

    O campo value retorna valor mascarado.
    Para acesso plain, usar PersonContactPlainSerializer (fiscal_admin).
    """

    value_masked = serializers.SerializerMethodField()

    class Meta:
        model = PersonContact
        fields = ["id", "contact_type", "value", "value_masked", "label", "is_primary"]
        read_only_fields = fields

    def get_value_masked(self, obj: PersonContact) -> str:
        """Retorna contato mascarado."""
        v: str = obj.value or ""
        return _mask_value(v)


class PersonContactWriteSerializer(serializers.ModelSerializer):
    """Serializer de escrita para PersonContact — popula value_hash automaticamente."""

    class Meta:
        model = PersonContact
        fields = ["contact_type", "value", "label", "is_primary"]

    def validate(self, attrs: dict) -> dict:
        """Popula value_hash a partir de value."""
        value = attrs.get("value", "")
        if value:
            attrs["value_hash"] = sha256_hex(value)
        return attrs


class PersonAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonAddress
        fields = [
            "id",
            "address_type",
            "zip_code",
            "street",
            "number",
            "complement",
            "neighborhood",
            "city",
            "state",
            "municipio_ibge",
            "is_primary",
        ]


class ClientProfileSerializer(serializers.ModelSerializer):
    """Serializer do perfil de cliente — dados de consentimento LGPD."""

    class Meta:
        model = ClientProfile
        fields = [
            "lgpd_consent_version",
            "lgpd_consent_date",
            "lgpd_consent_ip",
            "group_sharing_consent",
        ]
        read_only_fields = ["lgpd_consent_date", "lgpd_consent_ip"]


class PersonRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonRole
        fields = ["id", "role"]


class PersonListSerializer(serializers.ModelSerializer):
    """Serializer compacto para listagem — inclui contato principal mascarado."""

    roles = PersonRoleSerializer(many=True, read_only=True)
    primary_contact = serializers.SerializerMethodField()

    class Meta:
        model = Person
        fields = [
            "id",
            "full_name",
            "fantasy_name",
            "person_kind",
            "roles",
            "primary_contact",
            "is_active",
            "created_at",
        ]
        read_only_fields = fields

    def get_primary_contact(self, obj: Person) -> dict | None:
        contact = obj.contacts.filter(is_primary=True).first() or obj.contacts.first()
        if contact:
            # Mascarar o contato — nunca retornar plain em listagem
            v: str = contact.value or ""
            return {"type": contact.contact_type, "value": _mask_value(v)}
        return None


class PersonCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer de escrita com sync de roles, contatos, endereços e documentos."""

    roles = serializers.ListField(
        child=serializers.ChoiceField(
            choices=["CLIENT", "INSURER", "BROKER", "EMPLOYEE", "SUPPLIER"]
        ),
        write_only=True,
    )
    contacts = PersonContactWriteSerializer(many=True, required=False)
    addresses = PersonAddressSerializer(many=True, required=False)
    documents = PersonDocumentWriteSerializer(many=True, required=False)

    class Meta:
        model = Person
        fields = [
            "person_kind",
            "full_name",
            "fantasy_name",
            "secondary_document",
            "municipal_registration",
            "is_simples_nacional",
            "inscription_type",
            "birth_date",
            "gender",
            "is_active",
            "notes",
            "roles",
            "contacts",
            "addresses",
            "documents",
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

    def _sync_documents(self, person: Person, documents_data: list) -> None:
        if not documents_data:
            return  # empty list = no change; preserve existing documents
        person.documents.all().delete()
        for d in documents_data:
            PersonDocument.objects.create(person=person, **d)

    def _sync_broker_profile(self, person: Person, roles: list) -> None:
        """Auto-cria BrokerOffice (PJ) ou BrokerPerson (PF) quando role=BROKER."""
        if "BROKER" not in roles:
            return
        if person.person_kind == "PJ":
            BrokerOffice.objects.get_or_create(person=person)
        elif person.person_kind == "PF":
            BrokerPerson.objects.get_or_create(person=person)

    def create(self, validated_data: dict) -> Person:
        roles = validated_data.pop("roles")
        contacts = validated_data.pop("contacts", [])
        addresses = validated_data.pop("addresses", [])
        documents = validated_data.pop("documents", [])
        person = Person.objects.create(**validated_data)
        self._sync_roles(person, roles)
        self._sync_broker_profile(person, roles)
        self._sync_contacts(person, contacts)
        self._sync_addresses(person, addresses)
        self._sync_documents(person, documents)
        return person

    def update(self, instance: Person, validated_data: dict) -> Person:
        roles = validated_data.pop("roles", None)
        contacts = validated_data.pop("contacts", None)
        addresses = validated_data.pop("addresses", None)
        documents = validated_data.pop("documents", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if roles is not None:
            self._sync_roles(instance, roles)
            self._sync_broker_profile(instance, roles)
        if contacts is not None:
            self._sync_contacts(instance, contacts)
        if addresses is not None:
            self._sync_addresses(instance, addresses)
        if documents is not None:
            self._sync_documents(instance, documents)
        return instance


class PersonDetailSerializer(serializers.ModelSerializer):
    """Serializer completo para detalhe de pessoa — PII mascarada por padrão."""

    roles = PersonRoleSerializer(many=True, read_only=True)
    contacts = PersonContactSerializer(many=True, read_only=True)
    addresses = PersonAddressSerializer(many=True, read_only=True)
    documents = PersonDocumentMaskedSerializer(many=True, read_only=True)
    client_profile = ClientProfileSerializer(read_only=True)

    class Meta:
        model = Person
        fields = [
            "id",
            "person_kind",
            "full_name",
            "fantasy_name",
            "secondary_document",
            "municipal_registration",
            "is_simples_nacional",
            "inscription_type",
            "birth_date",
            "gender",
            "is_active",
            "notes",
            "created_at",
            "updated_at",
            "legacy_code",
            "legacy_category",
            "roles",
            "documents",
            "contacts",
            "addresses",
            "client_profile",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]
