"""
Paddock Solutions — Experts Serializers (DEPRECATED)

Expert foi consolidado em persons.Person + ExpertProfile (2026-06-22).
Mantemos apenas ExpertMinimalSerializer pra retro-compat de ServiceOrder.expert_detail.
"""
from rest_framework import serializers

from apps.persons.models import Person


class ExpertMinimalSerializer(serializers.ModelSerializer):
    """Serializer compacto para perito (Person + role=EXPERT).

    Usado em ServiceOrderSerializer.expert_detail para retorno aninhado.
    Campos espelham a antiga estrutura experts.Expert.
    """

    name = serializers.CharField(source="full_name", read_only=True)
    registration_number = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()

    class Meta:
        model = Person
        fields = ["id", "name", "registration_number", "phone"]

    def get_registration_number(self, obj: Person) -> str:
        profile = getattr(obj, "expert_profile", None)
        return profile.registration_number if profile else ""

    def get_phone(self, obj: Person) -> str:
        contact = obj.contacts.filter(contact_type="CELULAR").first()
        return contact.value if contact else ""
