"""
Paddock Solutions — Service Orders: Mobile Serializers
WatermelonDB sync serializer para o app React Native.
"""
from rest_framework import serializers

from ..models import ServiceOrder


class ServiceOrderSyncSerializer(serializers.ModelSerializer):
    """
    Serializer para sync incremental WatermelonDB.

    Mapeia campos do modelo para o schema do WatermelonDB,
    expondo timestamps em milissegundos (epoch ms) conforme
    o protocolo de sync do WatermelonDB.
    """

    id = serializers.UUIDField()                      # obrigatorio pelo protocolo WatermelonDB sync
    remote_id = serializers.CharField(source="id")   # mantido para o campo remote_id do schema
    vehicle_brand = serializers.CharField(source="make")
    vehicle_model = serializers.CharField(source="model")
    vehicle_year = serializers.IntegerField(source="year", allow_null=True)
    vehicle_color = serializers.CharField(source="color")
    vehicle_plate = serializers.CharField(source="plate")
    # Campos string que podem ser null no DB -- WatermelonDB exige string nao-nula
    customer_type = serializers.SerializerMethodField()
    os_type = serializers.SerializerMethodField()
    consultant_name = serializers.SerializerMethodField()
    insurer_id = serializers.SerializerMethodField()
    insured_type = serializers.SerializerMethodField()
    # Decimais como float -- WatermelonDB schema type: 'number'
    total_parts = serializers.FloatField(source="parts_total")
    total_services = serializers.FloatField(source="services_total")
    make_logo = serializers.SerializerMethodField()
    cover_photo_url = serializers.SerializerMethodField()
    created_at_remote = serializers.SerializerMethodField()
    updated_at_remote = serializers.SerializerMethodField()

    class Meta:
        model = ServiceOrder
        fields = [
            "id",
            "remote_id",
            "number",
            "status",
            "customer_name",
            "customer_type",
            "os_type",
            "vehicle_plate",
            "vehicle_brand",
            "vehicle_model",
            "vehicle_year",
            "vehicle_color",
            "consultant_name",
            "insurer_id",
            "insured_type",
            "make_logo",
            "cover_photo_url",
            "total_parts",
            "total_services",
            "created_at_remote",
            "updated_at_remote",
        ]

    def get_customer_type(self, obj: ServiceOrder) -> str:
        """Retorna customer_type ou string vazia (WatermelonDB nao aceita null em string)."""
        return obj.customer_type or ""

    def get_os_type(self, obj: ServiceOrder) -> str:
        """Retorna os_type ou string vazia (WatermelonDB nao aceita null em string)."""
        return obj.os_type or ""

    def get_consultant_name(self, obj: ServiceOrder) -> str:
        """Retorna nome completo ou email do consultor, ou string vazia."""
        if obj.consultant:
            return obj.consultant.get_full_name() or obj.consultant.email
        return ""

    def get_insurer_id(self, obj: ServiceOrder) -> str:
        """Retorna UUID da seguradora ou string vazia (WatermelonDB nao aceita null em string)."""
        return str(obj.insurer_id) if obj.insurer_id else ""

    def get_insured_type(self, obj: ServiceOrder) -> str:
        """Retorna insured_type ou string vazia."""
        return obj.insured_type or ""

    def get_make_logo(self, obj: ServiceOrder) -> str:
        """Retorna URL do logo da montadora ou string vazia."""
        return obj.make_logo or ""

    def get_cover_photo_url(self, obj: ServiceOrder) -> str:
        """Retorna URL da foto de frente (slot='frente', checklist_type='entrada').

        Usa prefetch_related quando disponivel. Fallback para query direta.
        WatermelonDB exige string nao-nula, retorna string vazia se nao houver foto.
        """
        from django.core.files.storage import default_storage

        # Tenta buscar da relacao (prefetch se disponivel)
        photo = (
            obj.photos.filter(
                slot="frente",
                checklist_type="entrada",
                is_active=True,
            )
            .order_by("-uploaded_at")
            .first()
        )
        if not photo or not photo.s3_key:
            return ""
        try:
            return default_storage.url(photo.s3_key)
        except Exception:
            return ""

    def get_created_at_remote(self, obj: ServiceOrder) -> int:
        """Retorna opened_at como epoch em milissegundos para o WatermelonDB."""
        return int(obj.opened_at.timestamp() * 1000)

    def get_updated_at_remote(self, obj: ServiceOrder) -> int:
        """Retorna updated_at como epoch em milissegundos para o WatermelonDB."""
        return int(obj.updated_at.timestamp() * 1000)
