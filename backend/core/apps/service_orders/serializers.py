"""
Paddock Solutions — Service Orders Serializers
"""
import logging
from typing import Optional

from django.utils import timezone
from rest_framework import serializers

from apps.experts.serializers import ExpertMinimalSerializer
from apps.insurers.serializers import InsurerMinimalSerializer
from apps.persons.models import Person

from .models import (
    VALID_TRANSITIONS,
    ActivityType,
    BudgetSnapshot,
    ChecklistItem,
    ChecklistItemStatus,
    OSPhotoFolder,
    ServiceCatalog,
    ServiceOrder,
    ServiceOrderActivityLog,
    ServiceOrderLabor,
    ServiceOrderPart,
    ServiceOrderPhoto,
    ServiceOrderStatus,
    StatusTransitionLog,
)

logger = logging.getLogger(__name__)

# Caches construídos uma vez no import — evita recriar dict a cada registro serializado
_STATUS_DISPLAY: dict[str, str] = {}
_PHOTO_FOLDER_DISPLAY: dict[str, str] = {}


def _get_status_display() -> dict[str, str]:
    global _STATUS_DISPLAY
    if not _STATUS_DISPLAY:
        from .models import ServiceOrderStatus as _SOS
        _STATUS_DISPLAY = dict(_SOS.choices)
    return _STATUS_DISPLAY


def _get_folder_display() -> dict[str, str]:
    global _PHOTO_FOLDER_DISPLAY
    if not _PHOTO_FOLDER_DISPLAY:
        _PHOTO_FOLDER_DISPLAY = dict(OSPhotoFolder.choices)
    return _PHOTO_FOLDER_DISPLAY


class ServiceOrderPhotoSerializer(serializers.ModelSerializer):
    """Serializer para fotos de OS — inclui URL gerada pelo storage configurado."""

    url = serializers.SerializerMethodField()
    folder_display = serializers.SerializerMethodField()

    class Meta:
        model = ServiceOrderPhoto
        fields = [
            "id",
            "folder",
            "folder_display",
            "slot",
            "checklist_type",
            "caption",
            "original_stage",
            "s3_key",
            "url",
            "uploaded_at",
            "is_active",
        ]
        read_only_fields = ["id", "s3_key", "url", "uploaded_at", "original_stage", "folder_display"]

    def get_url(self, obj: ServiceOrderPhoto) -> str | None:
        """Retorna URL pública/presignada via default_storage (S3 em prod, local em dev)."""
        from django.core.files.storage import default_storage

        if not obj.s3_key:
            return None
        try:
            return default_storage.url(obj.s3_key)
        except Exception:
            return None

    def get_folder_display(self, obj: ServiceOrderPhoto) -> str:
        return _get_folder_display().get(obj.folder, obj.folder)


class BudgetSnapshotSerializer(serializers.ModelSerializer):
    """Serializer para snapshots de orçamento — somente leitura."""

    trigger_display = serializers.CharField(source="get_trigger_display", read_only=True)
    grand_total = serializers.FloatField(read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = BudgetSnapshot
        fields = [
            "id",
            "version",
            "trigger",
            "trigger_display",
            "parts_total",
            "services_total",
            "discount_total",
            "grand_total",
            "items_snapshot",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = fields

    def get_created_by_name(self, obj: BudgetSnapshot) -> str:
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.email
        return "Sistema"


class StatusTransitionLogSerializer(serializers.ModelSerializer):
    """Serializer para log de transições de status."""

    changed_by_name = serializers.SerializerMethodField()
    from_status_display = serializers.SerializerMethodField()
    to_status_display = serializers.SerializerMethodField()

    class Meta:
        model = StatusTransitionLog
        fields = [
            "id",
            "from_status",
            "from_status_display",
            "to_status",
            "to_status_display",
            "triggered_by_field",
            "changed_by_name",
            "created_at",
        ]

    def get_changed_by_name(self, obj: StatusTransitionLog) -> str:
        return obj.changed_by.get_full_name() or obj.changed_by.email

    def get_from_status_display(self, obj: StatusTransitionLog) -> str:
        return _get_status_display().get(obj.from_status, obj.from_status)

    def get_to_status_display(self, obj: StatusTransitionLog) -> str:
        return _get_status_display().get(obj.to_status, obj.to_status)

class ServiceOrderActivityLogSerializer(serializers.ModelSerializer):
    """Serializer para histórico detalhado de atividades da OS."""
    user_name = serializers.SerializerMethodField()
    activity_type_display = serializers.CharField(source="get_activity_type_display", read_only=True)

    class Meta:
        model = ServiceOrderActivityLog
        fields = [
            "id",
            "activity_type",
            "activity_type_display",
            "description",
            "metadata",
            "user",
            "user_name",
            "created_at",
        ]
        read_only_fields = fields

    def get_user_name(self, obj: ServiceOrderActivityLog) -> str:
        return obj.user.get_full_name() or obj.user.email


class ServiceOrderPartSerializer(serializers.ModelSerializer):
    """Serializer para itens de peça de uma OS."""

    total = serializers.FloatField(read_only=True)
    product_name = serializers.SerializerMethodField()

    class Meta:
        model = ServiceOrderPart
        fields = [
            "id", "product", "product_name", "description", "part_number",
            "quantity", "unit_price", "discount", "total",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "product_name", "total", "created_at", "updated_at"]

    def get_product_name(self, obj: ServiceOrderPart) -> str | None:
        """Retorna o nome do produto vinculado, se houver."""
        if obj.product:
            return obj.product.name
        return None

    def validate(self, attrs: dict) -> dict:
        quantity = attrs.get("quantity")
        unit_price = attrs.get("unit_price")
        discount = attrs.get("discount")
        if quantity is not None and quantity <= 0:
            raise serializers.ValidationError(
                {"quantity": "A quantidade deve ser maior que zero."}
            )
        if unit_price is not None and unit_price < 0:
            raise serializers.ValidationError(
                {"unit_price": "O preço unitário não pode ser negativo."}
            )
        if quantity and unit_price and discount is not None:
            line_total = quantity * unit_price
            if discount > line_total:
                raise serializers.ValidationError(
                    {"discount": "O desconto não pode ser maior que o total da linha."}
                )
        return attrs


class ServiceOrderLaborSerializer(serializers.ModelSerializer):
    """Serializer para itens de mão-de-obra de uma OS."""

    total = serializers.FloatField(read_only=True)
    service_catalog_name = serializers.CharField(
        source="service_catalog.name", read_only=True, allow_null=True
    )

    class Meta:
        model = ServiceOrderLabor
        fields = [
            "id", "service_catalog", "service_catalog_name",
            "description", "quantity", "unit_price", "discount", "total",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "service_catalog_name", "total", "created_at", "updated_at"]

    def validate(self, attrs: dict) -> dict:
        quantity = attrs.get("quantity")
        unit_price = attrs.get("unit_price")
        discount = attrs.get("discount")
        if quantity is not None and quantity <= 0:
            raise serializers.ValidationError(
                {"quantity": "A quantidade deve ser maior que zero."}
            )
        if unit_price is not None and unit_price < 0:
            raise serializers.ValidationError(
                {"unit_price": "O preço unitário não pode ser negativo."}
            )
        if quantity and unit_price and discount is not None:
            line_total = quantity * unit_price
            if discount > line_total:
                raise serializers.ValidationError(
                    {"discount": "O desconto não pode ser maior que o total da linha."}
                )
        return attrs


class ServiceCatalogSerializer(serializers.ModelSerializer):
    """Serializer completo para criação/edição do catálogo."""

    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = ServiceCatalog
        fields = [
            "id", "name", "description", "category", "category_display",
            "suggested_price", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "category_display", "created_at", "updated_at"]


class ServiceCatalogListSerializer(serializers.ModelSerializer):
    """Serializer compacto para listas e combobox."""

    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = ServiceCatalog
        fields = ["id", "name", "category", "category_display", "suggested_price"]


class ServiceOrderOverdueSerializer(serializers.ModelSerializer):
    """Serializer para OS vencidas/com entrega hoje — endpoint overdue."""

    status_display = serializers.CharField(source="get_status_display", read_only=True)
    days_overdue = serializers.SerializerMethodField()
    urgency = serializers.SerializerMethodField()

    class Meta:
        model = ServiceOrder
        fields = [
            "id", "number", "plate", "customer_name", "status", "status_display",
            "estimated_delivery_date", "days_overdue", "urgency",
        ]

    def get_days_overdue(self, obj: ServiceOrder) -> int:
        """Retorna dias de atraso (positivo = vencida, 0 = hoje, negativo = no prazo)."""
        if not obj.estimated_delivery_date:
            return 0
        return (timezone.localdate() - obj.estimated_delivery_date).days

    def get_urgency(self, obj: ServiceOrder) -> str:
        """Classifica urgência: overdue / due_today / upcoming."""
        days = self.get_days_overdue(obj)
        if days > 0:
            return "overdue"
        if days == 0:
            return "due_today"
        return "upcoming"


class ServiceOrderCalendarSerializer(serializers.ModelSerializer):
    """Serializer compacto para o endpoint de calendário."""

    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ServiceOrder
        fields = [
            "id", "number", "plate", "make", "model",
            "customer_name", "customer_type",
            "status", "status_display",
            "scheduling_date", "estimated_delivery_date",
        ]


class ServiceOrderListSerializer(serializers.ModelSerializer):
    """
    Serializer compacto para listagem (Kanban, tabelas).
    Não inclui nested pesados para reduzir payload.
    """

    total = serializers.FloatField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    customer_type_display = serializers.CharField(
        source="get_customer_type_display", read_only=True
    )
    os_type_display = serializers.CharField(source="get_os_type_display", read_only=True)
    insurer_detail = InsurerMinimalSerializer(source="insurer", read_only=True)
    consultant_name = serializers.SerializerMethodField()
    days_in_shop = serializers.SerializerMethodField()
    allowed_transitions = serializers.SerializerMethodField()

    class Meta:
        model = ServiceOrder
        fields = [
            "id",
            "number",
            "status",
            "status_display",
            "allowed_transitions",
            "customer_type",
            "customer_type_display",
            "os_type",
            "os_type_display",
            "customer_name",
            "plate",
            "make",
            "model",
            "vehicle_version",
            "year",
            "color",
            "insurer_detail",
            "consultant_name",
            "entry_date",
            "estimated_delivery_date",
            "days_in_shop",
            "parts_total",
            "services_total",
            "discount_total",
            "total",
            "is_active",
            "opened_at",
            "created_at",
        ]
        read_only_fields = ["id", "total", "status_display", "days_in_shop", "created_at"]

    def get_consultant_name(self, obj: ServiceOrder) -> str:
        if obj.consultant:
            return obj.consultant.get_full_name() or obj.consultant.email
        return ""

    def get_days_in_shop(self, obj: ServiceOrder) -> Optional[int]:
        ref = obj.entry_date or obj.opened_at
        if ref:
            return (timezone.now() - ref).days
        return None

    def get_allowed_transitions(self, obj: ServiceOrder) -> list[str]:
        return VALID_TRANSITIONS.get(obj.status, [])


class ServiceOrderDetailSerializer(serializers.ModelSerializer):
    """Serializer completo para a tela de abertura/edição da OS."""

    total = serializers.FloatField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    customer_type_display = serializers.CharField(
        source="get_customer_type_display", read_only=True
    )
    os_type_display = serializers.CharField(source="get_os_type_display", read_only=True)
    insured_type_display = serializers.CharField(
        source="get_insured_type_display", read_only=True
    )
    vehicle_location_display = serializers.CharField(
        source="get_vehicle_location_display", read_only=True
    )
    allowed_transitions = serializers.SerializerMethodField()
    insurer_detail = InsurerMinimalSerializer(source="insurer", read_only=True)
    expert_detail = ExpertMinimalSerializer(source="expert", read_only=True)
    transition_logs = StatusTransitionLogSerializer(many=True, read_only=True)
    photos = ServiceOrderPhotoSerializer(many=True, read_only=True)
    parts = ServiceOrderPartSerializer(many=True, read_only=True)
    labor_items = ServiceOrderLaborSerializer(many=True, read_only=True)
    budget_snapshots = BudgetSnapshotSerializer(many=True, read_only=True)
    days_in_shop = serializers.SerializerMethodField()
    consultant_name = serializers.SerializerMethodField()

    class Meta:
        model = ServiceOrder
        fields = "__all__"

    def get_allowed_transitions(self, obj: ServiceOrder) -> list[str]:
        return VALID_TRANSITIONS.get(obj.status, [])

    def get_days_in_shop(self, obj: ServiceOrder) -> Optional[int]:
        ref = obj.entry_date or obj.opened_at
        if ref:
            return (timezone.now() - ref).days
        return None

    def get_consultant_name(self, obj: ServiceOrder) -> str:
        if obj.consultant:
            return obj.consultant.get_full_name() or obj.consultant.email
        return ""


class ServiceOrderCreateSerializer(serializers.ModelSerializer):
    """
    Serializer para abertura de nova OS.
    Número é gerado automaticamente pelo ServiceOrderService — não exposto como campo de entrada.
    """

    # customer recebe UUID do UnifiedCustomer (schema public) — diferente de Person (tenant FK).
    # Aceita UUID sem validação FK e descarta no create() para não quebrar o IntegerField do FK.
    # customer_name (desnormalizado) é a referência real neste fluxo.
    customer = serializers.UUIDField(
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = ServiceOrder
        exclude = ["number", "created_by", "invoice_issued", "opened_at"]
        extra_kwargs = {
            # Campos opcionais do veículo — model tem default="" mas sem blank=True
            "make":            {"required": False, "allow_blank": True},
            "model":           {"required": False, "allow_blank": True},
            "vehicle_version": {"required": False, "allow_blank": True},
            "color":           {"required": False, "allow_blank": True},
            "chassis":         {"required": False, "allow_blank": True},
            "fuel_type":       {"required": False, "allow_blank": True},
            "broker_name":     {"required": False, "allow_blank": True},
            "casualty_number": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs: dict) -> dict:
        if attrs.get("customer_type") == ServiceOrder.CustomerType.INSURER:
            if not attrs.get("insurer"):
                raise serializers.ValidationError(
                    {"insurer": "Seguradora é obrigatória para OS de seguradora."}
                )
            if not attrs.get("insured_type"):
                raise serializers.ValidationError(
                    {"insured_type": "Tipo de segurado é obrigatório para OS de seguradora."}
                )
        return attrs

    def create(self, validated_data: dict) -> "ServiceOrder":
        # UUID do UnifiedCustomer não pode ser salvo no FK inteiro de Person — descarta.
        validated_data.pop("customer", None)
        return super().create(validated_data)


class ServiceOrderUpdateSerializer(serializers.ModelSerializer):
    """Serializer para atualização parcial de OS."""

    # customer recebe UUID do UnifiedCustomer (schema public) — igual ao create
    customer = serializers.UUIDField(
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = ServiceOrder
        exclude = ["number", "created_by", "opened_at"]
        extra_kwargs = {
            "make":            {"required": False, "allow_blank": True},
            "model":           {"required": False, "allow_blank": True},
            "vehicle_version": {"required": False, "allow_blank": True},
            "color":           {"required": False, "allow_blank": True},
            "chassis":         {"required": False, "allow_blank": True},
            "fuel_type":       {"required": False, "allow_blank": True},
            "broker_name":     {"required": False, "allow_blank": True},
            "casualty_number": {"required": False, "allow_blank": True},
            "customer_name":   {"required": False, "allow_blank": True},
            "plate":           {"required": False, "allow_blank": True},
        }

    def validate(self, attrs: dict) -> dict:
        """Valida campos de seguradora quando customer_type muda para 'insurer'."""
        # Usa o valor atual do objeto se não foi enviado no payload
        instance = self.instance
        customer_type = attrs.get(
            "customer_type",
            getattr(instance, "customer_type", None) if instance else None,
        )
        if customer_type == "insurer":
            insurer = attrs.get("insurer", getattr(instance, "insurer", None) if instance else None)
            insured_type = attrs.get(
                "insured_type",
                getattr(instance, "insured_type", None) if instance else None,
            )
            if not insurer:
                raise serializers.ValidationError({"insurer": "Seguradora é obrigatória para OS de seguradora."})
            if not insured_type:
                raise serializers.ValidationError(
                    {"insured_type": "Tipo de segurado é obrigatório para OS de seguradora."}
                )
        return attrs


class ServiceOrderStatusTransitionSerializer(serializers.Serializer):
    """Serializer para mudança manual de status via ação customizada."""

    new_status = serializers.ChoiceField(choices=ServiceOrderStatus.choices)

    def validate_new_status(self, value: str) -> str:
        service_order: ServiceOrder = self.context["service_order"]
        if not service_order.can_transition_to(value):
            allowed = VALID_TRANSITIONS.get(service_order.status, [])
            raise serializers.ValidationError(
                f"Transição inválida: '{service_order.status}' → '{value}'. "
                f"Permitidas: {allowed}"
            )
        return value


class DeliverOSSerializer(serializers.Serializer):
    """Serializer para entrega da OS ao cliente."""

    mileage_out  = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    notes        = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    nfe_key      = serializers.CharField(required=False, allow_blank=True, max_length=44)
    nfse_number  = serializers.CharField(required=False, allow_blank=True, max_length=20)

    def validate(self, attrs: dict) -> dict:
        """Valida fiscal para clientes particulares."""
        service_order: ServiceOrder = self.context["service_order"]
        if service_order.customer_type == "private":
            nfe_key = attrs.get("nfe_key") or service_order.nfe_key
            nfse_number = attrs.get("nfse_number") or service_order.nfse_number
            if not nfe_key and not nfse_number:
                raise serializers.ValidationError(
                    {"fiscal": "NF-e ou NFS-e obrigatória para clientes particulares."}
                )
        return attrs


class UploadPhotoSerializer(serializers.Serializer):
    """Serializer para upload de foto com pasta, slot, tipo de checklist e legenda."""

    file           = serializers.ImageField()
    folder         = serializers.ChoiceField(choices=OSPhotoFolder.choices)
    caption        = serializers.CharField(required=False, allow_blank=True, max_length=200)
    slot           = serializers.CharField(required=False, allow_blank=True, default="")
    checklist_type = serializers.CharField(required=False, allow_blank=True, default="")


class ServiceOrderSyncSerializer(serializers.ModelSerializer):
    """
    Serializer para sync incremental WatermelonDB.

    Mapeia campos do modelo para o schema do WatermelonDB,
    expondo timestamps em milissegundos (epoch ms) conforme
    o protocolo de sync do WatermelonDB.
    """

    id = serializers.UUIDField()                      # obrigatório pelo protocolo WatermelonDB sync
    remote_id = serializers.CharField(source="id")   # mantido para o campo remote_id do schema
    vehicle_brand = serializers.CharField(source="make")
    vehicle_model = serializers.CharField(source="model")
    vehicle_year = serializers.IntegerField(source="year", allow_null=True)
    vehicle_color = serializers.CharField(source="color")
    vehicle_plate = serializers.CharField(source="plate")
    # Campos string que podem ser null no DB — WatermelonDB exige string não-nula
    customer_type = serializers.SerializerMethodField()
    os_type = serializers.SerializerMethodField()
    consultant_name = serializers.SerializerMethodField()
    insurer_id = serializers.SerializerMethodField()
    insured_type = serializers.SerializerMethodField()
    # Decimais como float — WatermelonDB schema type: 'number'
    total_parts = serializers.FloatField(source="parts_total")
    total_services = serializers.FloatField(source="services_total")
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
            "total_parts",
            "total_services",
            "created_at_remote",
            "updated_at_remote",
        ]

    def get_customer_type(self, obj: ServiceOrder) -> str:
        """Retorna customer_type ou string vazia (WatermelonDB não aceita null em string)."""
        return obj.customer_type or ""

    def get_os_type(self, obj: ServiceOrder) -> str:
        """Retorna os_type ou string vazia (WatermelonDB não aceita null em string)."""
        return obj.os_type or ""

    def get_consultant_name(self, obj: ServiceOrder) -> str:
        """Retorna nome completo ou email do consultor, ou string vazia."""
        if obj.consultant:
            return obj.consultant.get_full_name() or obj.consultant.email
        return ""

    def get_insurer_id(self, obj: ServiceOrder) -> str:
        """Retorna UUID da seguradora ou string vazia (WatermelonDB não aceita null em string)."""
        return str(obj.insurer_id) if obj.insurer_id else ""

    def get_insured_type(self, obj: ServiceOrder) -> str:
        """Retorna insured_type ou string vazia."""
        return obj.insured_type or ""

    def get_created_at_remote(self, obj: ServiceOrder) -> int:
        """Retorna opened_at como epoch em milissegundos para o WatermelonDB."""
        return int(obj.opened_at.timestamp() * 1000)

    def get_updated_at_remote(self, obj: ServiceOrder) -> int:
        """Retorna updated_at como epoch em milissegundos para o WatermelonDB."""
        return int(obj.updated_at.timestamp() * 1000)


# ─── ChecklistItem Serializers (Sprint M4) ───────────────────────────────────

class ChecklistItemSerializer(serializers.ModelSerializer):
    """Serializer para leitura e escrita de itens de checklist."""

    class Meta:
        model = ChecklistItem
        fields = [
            "id",
            "checklist_type",
            "category",
            "item_key",
            "status",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ChecklistItemBulkSerializer(serializers.Serializer):
    """Aceita lista de itens para upsert em lote — usado pelo app mobile."""

    items = ChecklistItemSerializer(many=True)

    def validate_items(self, items: list) -> list:
        if not items:
            raise serializers.ValidationError("Lista de itens não pode ser vazia.")
        return items
