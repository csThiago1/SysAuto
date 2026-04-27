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
    Holiday,
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
        """Retorna URL pública/presignada via default_storage (S3 em prod, absoluta em dev)."""
        from django.core.files.storage import default_storage

        if not obj.s3_key:
            return None
        try:
            url = default_storage.url(obj.s3_key)
            # Em dev o FileSystemStorage retorna caminhos relativos (/media/...).
            # O app mobile precisa de URL absoluta — usamos request.build_absolute_uri()
            # para incluir o host (ex: http://192.168.x.x:8000/media/...).
            if url.startswith("/"):
                request = self.context.get("request")
                if request is not None:
                    return request.build_absolute_uri(url)
            return url
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


class _StatusTransitionMixin:
    """Métodos compartilhados para serializers de StatusTransitionLog."""

    def get_changed_by_name(self, obj: StatusTransitionLog) -> str:
        return obj.changed_by.get_full_name() or obj.changed_by.email

    def get_from_status_display(self, obj: StatusTransitionLog) -> str:
        return _get_status_display().get(obj.from_status, obj.from_status)

    def get_to_status_display(self, obj: StatusTransitionLog) -> str:
        return _get_status_display().get(obj.to_status, obj.to_status)


class StatusTransitionLogSerializer(_StatusTransitionMixin, serializers.ModelSerializer):
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


class NotificationFeedSerializer(_StatusTransitionMixin, serializers.ModelSerializer):
    """Item do feed de notificações — transição de status com contexto da OS."""

    os_id = serializers.UUIDField(source="service_order.id")
    os_number = serializers.IntegerField(source="service_order.number")
    os_plate = serializers.CharField(source="service_order.plate")
    os_make = serializers.CharField(source="service_order.make")
    os_model = serializers.CharField(source="service_order.model")
    os_customer_name = serializers.CharField(source="service_order.customer_name")
    changed_by_name = serializers.SerializerMethodField()
    from_status_display = serializers.SerializerMethodField()
    to_status_display = serializers.SerializerMethodField()

    class Meta:
        model = StatusTransitionLog
        fields = [
            "id",
            "os_id", "os_number", "os_plate", "os_make", "os_model", "os_customer_name",
            "from_status", "from_status_display",
            "to_status", "to_status_display",
            "triggered_by_field", "changed_by_name", "created_at",
        ]


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


class _LineItemValidationMixin:
    """Validação compartilhada para itens de linha (peças e mão-de-obra)."""

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


class ServiceOrderPartSerializer(_LineItemValidationMixin, serializers.ModelSerializer):
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


class ServiceOrderLaborSerializer(_LineItemValidationMixin, serializers.ModelSerializer):
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
            "scheduling_date", "estimated_delivery_date", "delivery_date",
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
    # Retorna customer_uuid (UnifiedCustomer) em vez do PK inteiro da Person FK.
    # O frontend espera UUID ou null neste campo — nunca um inteiro.
    customer = serializers.SerializerMethodField()
    # Expõe o PK inteiro da Person FK para que o frontend possa renderizar
    # dados do cliente mesmo quando customer_uuid é nulo (OS do novo fluxo).
    customer_person_id = serializers.SerializerMethodField()

    class Meta:
        model = ServiceOrder
        fields = "__all__"

    def get_customer(self, obj: "ServiceOrder") -> str | None:
        """Retorna customer_uuid para compatibilidade com frontend (não o PK integer da Person)."""
        return str(obj.customer_uuid) if obj.customer_uuid else None

    def get_customer_person_id(self, obj: "ServiceOrder") -> int | None:
        """Retorna o PK inteiro da Person FK (novo fluxo de criação de OS)."""
        return obj.customer_id  # type: ignore[return-value]

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
    # customer_id recebe o ID inteiro de Person (tenant FK) — fluxo CreateOSForm.
    # Não conflita com o campo customer (UUID) acima pois são campos distintos no serializer.
    customer_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = ServiceOrder
        exclude = ["number", "created_by", "invoice_issued", "opened_at"]
        # Campos calculados ou controlados por endpoints dedicados — não graváveis via POST
        read_only_fields = [
            "status",
            "is_active",
            "parts_total",
            "services_total",
            "discount_total",
            "ai_recommendations",
            "nfe_key",
            "nfse_number",
            "delivered_at",
            "delivery_date",
            "client_delivery_date",
        ]
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
            "customer_name":   {"required": False, "allow_blank": True},
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
    # customer_person_id recebe PK inteiro de Person — novo fluxo de troca de cliente
    customer_person_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        write_only=True,
        source="customer_id",
    )

    class Meta:
        model = ServiceOrder
        exclude = ["number", "created_by", "opened_at"]
        # Campos calculados ou controlados por endpoints dedicados — não graváveis via PATCH
        read_only_fields = [
            "status",
            "is_active",
            "invoice_issued",
            "parts_total",
            "services_total",
            "discount_total",
            "ai_recommendations",
            "nfe_key",
            "nfse_number",
            "delivered_at",
        ]
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

    def update(self, instance: "ServiceOrder", validated_data: dict) -> "ServiceOrder":
        # UUID do UnifiedCustomer não pode ser salvo no FK inteiro de Person — descarta.
        validated_data.pop("customer", None)
        return super().update(instance, validated_data)

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

    file           = serializers.FileField()   # ImageField exige Pillow; FileField basta aqui
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


class HolidaySerializer(serializers.ModelSerializer):
    """Serializer para Feriados."""

    class Meta:
        model = Holiday
        fields = ["id", "date", "name", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


# ── Versionamento de OS ──────────────────────────────────────────────────────

from apps.service_orders.models import (  # noqa: E402
    ServiceOrderVersion,
    ServiceOrderVersionItem,
    ServiceOrderEvent,
    ServiceOrderParecer,
)


class ServiceOrderVersionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOrderVersionItem
        fields = [
            "id", "version",
            "bucket", "payer_block", "impact_area", "item_type",
            "description", "external_code", "part_type", "supplier",
            "quantity", "unit_price", "unit_cost", "discount_pct", "net_price",
            "flag_abaixo_padrao", "flag_acima_padrao", "flag_inclusao_manual",
            "flag_codigo_diferente", "flag_servico_manual", "flag_peca_da_conta",
            "sort_order",
        ]
        read_only_fields = [
            "id", "version",
            "bucket", "payer_block", "impact_area", "item_type",
            "description", "external_code", "part_type", "supplier",
            "quantity", "unit_price", "unit_cost", "discount_pct", "net_price",
            "flag_abaixo_padrao", "flag_acima_padrao", "flag_inclusao_manual",
            "flag_codigo_diferente", "flag_servico_manual", "flag_peca_da_conta",
            "sort_order",
        ]


class ServiceOrderVersionSerializer(serializers.ModelSerializer):
    items = ServiceOrderVersionItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ServiceOrderVersion
        fields = [
            "id", "service_order", "version_number",
            "external_version", "external_numero_vistoria", "external_integration_id",
            "source", "status", "status_display",
            "subtotal", "discount_total", "net_total",
            "labor_total", "parts_total",
            "total_seguradora", "total_complemento_particular", "total_franquia",
            "content_hash", "hourly_rates", "global_discount_pct",
            "created_at", "created_by", "approved_at",
            "items",
        ]
        read_only_fields = [
            "id", "service_order", "version_number",
            "external_version", "external_numero_vistoria", "external_integration_id",
            "source", "status", "status_display",
            "subtotal", "discount_total", "net_total",
            "labor_total", "parts_total",
            "total_seguradora", "total_complemento_particular", "total_franquia",
            "content_hash", "hourly_rates", "global_discount_pct",
            "created_at", "created_by", "approved_at",
        ]


class ServiceOrderEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOrderEvent
        fields = [
            "id", "service_order", "event_type",
            "actor", "payload", "from_state", "to_state", "created_at",
        ]
        read_only_fields = [
            "id", "service_order", "event_type",
            "actor", "payload", "from_state", "to_state", "created_at",
        ]


class ServiceOrderParecerSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOrderParecer
        fields = [
            "id", "service_order", "version",
            "source", "flow_number",
            "author_external", "author_org", "author_internal",
            "parecer_type", "body",
            "created_at_external", "created_at",
        ]
        read_only_fields = ["id", "created_at"]
