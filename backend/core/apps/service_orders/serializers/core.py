"""
Paddock Solutions — Service Orders: Core Serializers
OS CRUD, photo, parts, labor, budget, status transition, checklist, etc.
"""
import logging
from typing import Optional

from django.utils import timezone
from rest_framework import serializers

from apps.experts.serializers import ExpertMinimalSerializer
from apps.insurers.serializers import InsurerMinimalSerializer
from apps.persons.models import Person

from ..models import (
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
    TransitionOverrideRequest,
)

logger = logging.getLogger(__name__)

# Caches construidos uma vez no import -- evita recriar dict a cada registro serializado
_STATUS_DISPLAY: dict[str, str] = {}
_PHOTO_FOLDER_DISPLAY: dict[str, str] = {}


def _get_status_display() -> dict[str, str]:
    global _STATUS_DISPLAY
    if not _STATUS_DISPLAY:
        from ..models import ServiceOrderStatus as _SOS
        _STATUS_DISPLAY = dict(_SOS.choices)
    return _STATUS_DISPLAY


def _get_folder_display() -> dict[str, str]:
    global _PHOTO_FOLDER_DISPLAY
    if not _PHOTO_FOLDER_DISPLAY:
        _PHOTO_FOLDER_DISPLAY = dict(OSPhotoFolder.choices)
    return _PHOTO_FOLDER_DISPLAY


class ServiceOrderPhotoSerializer(serializers.ModelSerializer):
    """Serializer para fotos de OS -- inclui URL gerada pelo storage configurado."""

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
        """Retorna URL publica/presignada via default_storage (S3 em prod, absoluta em dev)."""
        from django.core.files.storage import default_storage

        if not obj.s3_key:
            return None
        try:
            url = default_storage.url(obj.s3_key)
            # Em dev o FileSystemStorage retorna caminhos relativos (/media/...).
            # O app mobile precisa de URL absoluta -- usamos request.build_absolute_uri()
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
    """Serializer para snapshots de orcamento -- somente leitura."""

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
    """Metodos compartilhados para serializers de StatusTransitionLog."""

    def get_changed_by_name(self, obj: StatusTransitionLog) -> str:
        return obj.changed_by.get_full_name() or obj.changed_by.email

    def get_from_status_display(self, obj: StatusTransitionLog) -> str:
        return _get_status_display().get(obj.from_status, obj.from_status)

    def get_to_status_display(self, obj: StatusTransitionLog) -> str:
        return _get_status_display().get(obj.to_status, obj.to_status)


class StatusTransitionLogSerializer(_StatusTransitionMixin, serializers.ModelSerializer):
    """Serializer para log de transicoes de status."""

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
    """Item do feed de notificacoes -- transicao de status com contexto da OS."""

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
    """Serializer para historico detalhado de atividades da OS."""
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
    """Validacao compartilhada para itens de linha (pecas e mao-de-obra)."""

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
                {"unit_price": "O preco unitario nao pode ser negativo."}
            )
        if quantity and unit_price and discount is not None:
            line_total = quantity * unit_price
            if discount > line_total:
                raise serializers.ValidationError(
                    {"discount": "O desconto nao pode ser maior que o total da linha."}
                )
        return attrs


class ServiceOrderPartSerializer(_LineItemValidationMixin, serializers.ModelSerializer):
    """Serializer para itens de peca de uma OS."""

    total = serializers.FloatField(read_only=True)
    product_name = serializers.SerializerMethodField()
    origem = serializers.CharField(read_only=True)
    origem_display = serializers.CharField(source="get_origem_display", read_only=True)
    tipo_qualidade = serializers.CharField(read_only=True)
    tipo_qualidade_display = serializers.CharField(source="get_tipo_qualidade_display", read_only=True)
    status_peca = serializers.CharField(read_only=True)
    status_peca_display = serializers.CharField(source="get_status_peca_display", read_only=True)
    custo_real = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True, allow_null=True)
    unidade_fisica_id = serializers.UUIDField(source="unidade_fisica.id", read_only=True, allow_null=True, default=None)
    payer_display = serializers.CharField(source="get_payer_display", read_only=True)
    source_type_display = serializers.CharField(source="get_source_type_display", read_only=True)
    billing_status_display = serializers.CharField(source="get_billing_status_display", read_only=True)

    class Meta:
        model = ServiceOrderPart
        fields = [
            "id", "product", "product_name", "description", "part_number",
            "quantity", "unit_price", "discount", "total",
            "origem", "origem_display",
            "tipo_qualidade", "tipo_qualidade_display",
            "status_peca", "status_peca_display",
            "custo_real", "unidade_fisica_id",
            "payer", "source_type", "billing_status", "billed_at",
            "payer_display", "source_type_display", "billing_status_display",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "product_name", "total",
            "origem", "origem_display",
            "tipo_qualidade", "tipo_qualidade_display",
            "status_peca", "status_peca_display",
            "custo_real", "unidade_fisica_id",
            "payer_display", "source_type_display", "billing_status_display",
            "created_at", "updated_at",
        ]

    def get_product_name(self, obj: ServiceOrderPart) -> str | None:
        """Retorna o nome do produto vinculado, se houver."""
        if obj.product:
            return obj.product.name
        return None


class PartEstoqueInputSerializer(serializers.Serializer):
    """Input para adicionar peca do estoque a OS."""

    unidade_fisica_id = serializers.UUIDField()
    tipo_qualidade = serializers.ChoiceField(choices=["genuina", "reposicao", "similar", "usada"])
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, help_text="Valor cobrado ao cliente -- PC-9")
    description = serializers.CharField(max_length=300, required=False, default="")


class PartCompraInputSerializer(serializers.Serializer):
    """Input para solicitar compra de peca para OS."""

    description = serializers.CharField(max_length=300)
    part_number = serializers.CharField(max_length=100, required=False, default="")
    tipo_qualidade = serializers.ChoiceField(choices=["genuina", "reposicao", "similar", "usada"])
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, help_text="Valor cobrado -- PC-9")
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2, default=1)
    observacoes = serializers.CharField(max_length=500, required=False, default="")


class PartSeguradoraInputSerializer(serializers.Serializer):
    """Input para registrar peca de seguradora na OS."""

    description = serializers.CharField(max_length=300)
    tipo_qualidade = serializers.ChoiceField(choices=["genuina", "reposicao", "similar", "usada"])
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, help_text="Valor cobrado -- PC-9")
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2, default=1)


class ServiceOrderLaborSerializer(_LineItemValidationMixin, serializers.ModelSerializer):
    """Serializer para itens de mao-de-obra de uma OS."""

    total = serializers.FloatField(read_only=True)
    service_catalog_name = serializers.CharField(
        source="service_catalog.name", read_only=True, allow_null=True
    )
    payer_display = serializers.CharField(source="get_payer_display", read_only=True)
    source_type_display = serializers.CharField(source="get_source_type_display", read_only=True)
    billing_status_display = serializers.CharField(source="get_billing_status_display", read_only=True)

    class Meta:
        model = ServiceOrderLabor
        fields = [
            "id", "service_catalog", "service_catalog_name",
            "description", "quantity", "unit_price", "discount", "total",
            "payer", "source_type", "billing_status", "billed_at",
            "payer_display", "source_type_display", "billing_status_display",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "service_catalog_name", "total",
            "payer_display", "source_type_display", "billing_status_display",
            "created_at", "updated_at",
        ]


class ServiceCatalogSerializer(serializers.ModelSerializer):
    """Serializer completo para criacao/edicao do catalogo."""

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
    """Serializer para OS vencidas/com entrega hoje -- endpoint overdue."""

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
        """Classifica urgencia: overdue / due_today / upcoming."""
        days = self.get_days_overdue(obj)
        if days > 0:
            return "overdue"
        if days == 0:
            return "due_today"
        return "upcoming"


class ServiceOrderCalendarSerializer(serializers.ModelSerializer):
    """Serializer compacto para o endpoint de calendario."""

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
    Nao inclui nested pesados para reduzir payload.
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
    closure_status = serializers.SerializerMethodField()

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
            "make_logo",
            "model",
            "vehicle_version",
            "year",
            "color",
            "insurer_detail",
            "consultant_name",
            "entry_date",
            "estimated_delivery_date",
            "delivered_at",
            "days_in_shop",
            "parts_total",
            "services_total",
            "discount_total",
            "total",
            "is_active",
            "opened_at",
            "created_at",
            "closure_status",
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

    def get_closure_status(self, obj: ServiceOrder) -> Optional[dict]:
        """Retorna o status de encerramento da OS (entregue + faturada + paga).

        Retorna None se a OS nao estiver no status delivered.
        Usa anotacoes do queryset quando disponiveis; caso contrario faz query direta.
        """
        if obj.status != ServiceOrderStatus.DELIVERED:
            return None

        is_invoiced: bool = bool(obj.invoice_issued)

        has_any = getattr(obj, "_has_any_receivables", None)
        has_pending = getattr(obj, "_has_pending_receivables", None)

        if has_any is None or has_pending is None:
            from apps.accounts_receivable.models import ReceivableDocument

            qs = ReceivableDocument.objects.filter(
                service_order_id=obj.pk,
                is_active=True,
            )
            has_any = qs.exists()
            has_pending = qs.exclude(status="received").exists() if has_any else False

        is_paid: bool = bool(has_any) and not bool(has_pending)
        is_closed: bool = is_invoiced and is_paid

        return {
            "is_delivered": True,
            "is_invoiced": is_invoiced,
            "is_paid": is_paid,
            "is_closed": is_closed,
        }

class ServiceOrderDetailSerializer(serializers.ModelSerializer):
    """Serializer completo para a tela de abertura/edicao da OS."""

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
    # O frontend espera UUID ou null neste campo -- nunca um inteiro.
    customer = serializers.SerializerMethodField()
    # Expoe o PK inteiro da Person FK para que o frontend possa renderizar
    # dados do cliente mesmo quando customer_uuid e nulo (OS do novo fluxo).
    customer_person_id = serializers.SerializerMethodField()
    closure_status = serializers.SerializerMethodField()
    transition_requirements = serializers.SerializerMethodField()

    class Meta:
        model = ServiceOrder
        fields = "__all__"

    def get_customer(self, obj: "ServiceOrder") -> str | None:
        """Retorna customer_uuid para compatibilidade com frontend (nao o PK integer da Person)."""
        return str(obj.customer_uuid) if obj.customer_uuid else None

    def get_customer_person_id(self, obj: "ServiceOrder") -> int | None:
        """Retorna o PK inteiro da Person FK (novo fluxo de criacao de OS)."""
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

    def get_closure_status(self, obj: ServiceOrder) -> Optional[dict]:
        """Retorna o status de encerramento da OS (entregue + faturada + paga).

        Retorna None se a OS nao estiver no status delivered.
        Usa anotacoes do queryset quando disponiveis; caso contrario faz query direta.
        """
        if obj.status != ServiceOrderStatus.DELIVERED:
            return None

        is_invoiced: bool = bool(obj.invoice_issued)

        has_any = getattr(obj, "_has_any_receivables", None)
        has_pending = getattr(obj, "_has_pending_receivables", None)

        if has_any is None or has_pending is None:
            from apps.accounts_receivable.models import ReceivableDocument

            qs = ReceivableDocument.objects.filter(
                service_order_id=obj.pk,
                is_active=True,
            )
            has_any = qs.exists()
            has_pending = qs.exclude(status="received").exists() if has_any else False

        is_paid: bool = bool(has_any) and not bool(has_pending)
        is_closed: bool = is_invoiced and is_paid

        return {
            "is_delivered": True,
            "is_invoiced": is_invoiced,
            "is_paid": is_paid,
            "is_closed": is_closed,
        }

    def get_transition_requirements(self, obj: ServiceOrder) -> dict[str, dict]:
        """Retorna validacao de pre-requisitos para cada transicao permitida."""
        from django.core.cache import cache
        cache_key = f"transition_reqs:{obj.pk}:{obj.updated_at.timestamp()}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached
        from apps.service_orders.transition_validator import TransitionValidator
        result = TransitionValidator.validate_all_targets(obj)
        cache.set(cache_key, result, timeout=60)
        return result


class ServiceOrderCreateSerializer(serializers.ModelSerializer):
    """
    Serializer para abertura de nova OS.
    Numero e gerado automaticamente pelo ServiceOrderService -- nao exposto como campo de entrada.
    """

    # customer recebe UUID do UnifiedCustomer (schema public) -- diferente de Person (tenant FK).
    # Aceita UUID sem validacao FK e descarta no create() para nao quebrar o IntegerField do FK.
    # customer_name (desnormalizado) e a referencia real neste fluxo.
    customer = serializers.UUIDField(
        required=False,
        allow_null=True,
        write_only=True,
    )
    # customer_id recebe o ID inteiro de Person (tenant FK) -- fluxo CreateOSForm.
    # Nao conflita com o campo customer (UUID) acima pois sao campos distintos no serializer.
    customer_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = ServiceOrder
        exclude = ["number", "created_by", "invoice_issued", "opened_at"]
        # Campos calculados ou controlados por endpoints dedicados -- nao gravaveis via POST
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
            # Campos opcionais do veiculo -- model tem default="" mas sem blank=True
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
                    {"insurer": "Seguradora e obrigatoria para OS de seguradora."}
                )
            if not attrs.get("insured_type"):
                raise serializers.ValidationError(
                    {"insured_type": "Tipo de segurado e obrigatorio para OS de seguradora."}
                )
        return attrs

    # Mapa de logos de montadoras -- fonte: apiplacas.com.br
    _MAKE_LOGOS: dict[str, str] = {
        "chevrolet": "https://apiplacas.com.br/logos/logosMarcas/chevrolet.png",
        "fiat": "https://apiplacas.com.br/logos/logosMarcas/fiat.png",
        "ford": "https://apiplacas.com.br/logos/logosMarcas/ford.png",
        "honda": "https://apiplacas.com.br/logos/logosMarcas/honda.png",
        "hyundai": "https://apiplacas.com.br/logos/logosMarcas/hyundai.png",
        "toyota": "https://apiplacas.com.br/logos/logosMarcas/toyota.png",
        "volkswagen": "https://apiplacas.com.br/logos/logosMarcas/volkswagen.png",
        "renault": "https://apiplacas.com.br/logos/logosMarcas/renault.png",
        "nissan": "https://apiplacas.com.br/logos/logosMarcas/nissan.png",
        "jeep": "https://apiplacas.com.br/logos/logosMarcas/jeep.png",
        "bmw": "https://apiplacas.com.br/logos/logosMarcas/bmw.png",
        "mercedes-benz": "https://apiplacas.com.br/logos/logosMarcas/mercedes-benz.png",
        "audi": "https://apiplacas.com.br/logos/logosMarcas/audi.png",
        "kia": "https://apiplacas.com.br/logos/logosMarcas/kia.png",
        "peugeot": "https://apiplacas.com.br/logos/logosMarcas/peugeot.png",
        "mitsubishi": "https://apiplacas.com.br/logos/logosMarcas/mitsubishi.png",
        "volvo": "https://apiplacas.com.br/logos/logosMarcas/volvo.png",
        "byd": "https://apiplacas.com.br/logos/logosMarcas/byd.png",
        "citron": "https://apiplacas.com.br/logos/logosMarcas/citroen.png",
        "subaru": "https://apiplacas.com.br/logos/logosMarcas/subaru.png",
        "dodge": "https://apiplacas.com.br/logos/logosMarcas/dodge.png",
        "land rover": "https://apiplacas.com.br/logos/logosMarcas/land-rover.png",
        "caoa chery": "https://apiplacas.com.br/logos/logosMarcas/caoa-chery.png",
        "jac": "https://apiplacas.com.br/logos/logosMarcas/jac.png",
        "gwm": "https://apiplacas.com.br/logos/logosMarcas/gwm.png",
    }

    def create(self, validated_data: dict) -> "ServiceOrder":
        from apps.vehicles.models import Vehicle

        # UUID do UnifiedCustomer nao pode ser salvo no FK inteiro de Person -- descarta.
        validated_data.pop("customer", None)

        # Resolve make_logo se nao fornecido
        make = validated_data.get("make", "")
        if make and not validated_data.get("make_logo"):
            validated_data["make_logo"] = self._MAKE_LOGOS.get(make.lower(), "")

        # Persiste veiculo na base para lookup futuro (DB-first)
        plate = (validated_data.get("plate") or "").upper().strip().replace("-", "")
        if plate:
            model = validated_data.get("model", "")
            description = f"{make} {model}".strip()
            Vehicle.objects.get_or_create(
                plate=plate,
                is_active=True,
                defaults={
                    "description": description,
                    "color": validated_data.get("color", ""),
                    "year_manufacture": validated_data.get("year"),
                },
            )

        return super().create(validated_data)


class ServiceOrderUpdateSerializer(serializers.ModelSerializer):
    """Serializer para atualizacao parcial de OS."""

    # customer recebe UUID do UnifiedCustomer (schema public) -- igual ao create
    customer = serializers.UUIDField(
        required=False,
        allow_null=True,
        write_only=True,
    )
    # customer_person_id recebe PK inteiro de Person -- novo fluxo de troca de cliente
    customer_person_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        write_only=True,
        source="customer_id",
    )

    class Meta:
        model = ServiceOrder
        exclude = ["number", "created_by", "opened_at"]
        # Campos calculados ou controlados por endpoints dedicados -- nao gravaveis via PATCH
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
            "make_logo":       {"required": False, "allow_blank": True},
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
        # UUID do UnifiedCustomer nao pode ser salvo no FK inteiro de Person -- descarta.
        validated_data.pop("customer", None)
        return super().update(instance, validated_data)

    def validate(self, attrs: dict) -> dict:
        """Valida campos de seguradora quando customer_type muda para 'insurer'.

        Em PATCH parcial, so valida se o usuario esta alterando customer_type,
        insurer ou insured_type -- nao bloqueia edicoes de campos nao-relacionados
        em OS com dados inconsistentes pre-existentes.
        """
        instance = self.instance
        # So dispara validacao se algum campo relevante esta sendo alterado
        insurer_fields_in_payload = {"customer_type", "insurer", "insured_type"} & attrs.keys()
        if not insurer_fields_in_payload and instance is not None:
            return attrs

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
                raise serializers.ValidationError({"insurer": "Seguradora e obrigatoria para OS de seguradora."})
            if not insured_type:
                raise serializers.ValidationError(
                    {"insured_type": "Tipo de segurado e obrigatorio para OS de seguradora."}
                )
        return attrs


class ServiceOrderStatusTransitionSerializer(serializers.Serializer):
    """Serializer para mudanca manual de status via acao customizada."""

    new_status = serializers.ChoiceField(choices=ServiceOrderStatus.choices)
    force = serializers.BooleanField(required=False, default=False)
    override_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    justification = serializers.CharField(required=False, allow_blank=True, default="")
    # Credenciais presenciais do gerente (opcional -- para override presencial)
    manager_email = serializers.EmailField(required=False, allow_blank=True, default="")
    manager_password = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_new_status(self, value: str) -> str:
        service_order: ServiceOrder = self.context["service_order"]
        if not service_order.can_transition_to(value):
            allowed = VALID_TRANSITIONS.get(service_order.status, [])
            raise serializers.ValidationError(
                f"Transicao invalida: '{service_order.status}' -> '{value}'. "
                f"Permitidas: {allowed}"
            )
        return value

    def validate(self, attrs: dict) -> dict:
        """Valida credenciais do gerente se force=True com credenciais presenciais."""
        if attrs.get("force") and attrs.get("manager_email"):
            from apps.authentication.models import GlobalUser
            from apps.authentication.permissions import ROLE_HIERARCHY

            email = attrs["manager_email"]
            password = attrs["manager_password"]

            try:
                manager = GlobalUser.objects.get(email=email, is_active=True)
            except GlobalUser.DoesNotExist:
                raise serializers.ValidationError(
                    {"manager_email": "Credenciais do gerente invalidas."}
                )

            if not manager.check_password(password):
                raise serializers.ValidationError(
                    {"manager_password": "Credenciais do gerente invalidas."}
                )

            # Verificar role MANAGER+
            role = getattr(manager, "role", "STOREKEEPER")
            # Em dev-credentials, role vem da session. Usar default ADMIN.
            if ROLE_HIERARCHY.get(role, 0) < ROLE_HIERARCHY.get("MANAGER", 3):
                raise serializers.ValidationError(
                    {"manager_email": "Usuario nao tem permissao de gerente."}
                )

            # Substituir changed_by pelo gerente autenticado presencialmente
            attrs["_manager_user"] = manager

        return attrs


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
                    {"fiscal": "NF-e ou NFS-e obrigatoria para clientes particulares."}
                )
        return attrs


class UploadPhotoSerializer(serializers.Serializer):
    """Serializer para upload de foto com pasta, slot, tipo de checklist e legenda."""

    file           = serializers.FileField()   # ImageField exige Pillow; FileField basta aqui
    folder         = serializers.ChoiceField(choices=OSPhotoFolder.choices)
    caption        = serializers.CharField(required=False, allow_blank=True, max_length=200)
    slot           = serializers.CharField(required=False, allow_blank=True, default="")
    checklist_type = serializers.CharField(required=False, allow_blank=True, default="")


# -- ChecklistItem Serializers (Sprint M4) --

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
    """Aceita lista de itens para upsert em lote -- usado pelo app mobile."""

    items = ChecklistItemSerializer(many=True)

    def validate_items(self, items: list) -> list:
        if not items:
            raise serializers.ValidationError("Lista de itens nao pode ser vazia.")
        return items


class HolidaySerializer(serializers.ModelSerializer):
    """Serializer para Feriados."""

    class Meta:
        model = Holiday
        fields = ["id", "date", "name", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


# -- Complemento: criacao de pecas e mao-de-obra particular --

class ComplementPartCreateSerializer(serializers.ModelSerializer):
    """Cria peca de complemento (particular) vinculada a OS."""

    class Meta:
        model = ServiceOrderPart
        fields = [
            "description", "part_number", "ncm", "quantity", "unit_price",
            "discount", "tipo_qualidade",
        ]

    def create(self, validated_data: dict) -> ServiceOrderPart:
        """Forca payer=customer e source_type=complement ao criar."""
        validated_data["payer"] = "customer"
        validated_data["source_type"] = "complement"
        return super().create(validated_data)


class ComplementLaborCreateSerializer(serializers.ModelSerializer):
    """Cria mao-de-obra de complemento (particular) vinculada a OS."""

    class Meta:
        model = ServiceOrderLabor
        fields = ["description", "quantity", "unit_price", "discount", "service_catalog"]

    def create(self, validated_data: dict) -> ServiceOrderLabor:
        """Forca payer=customer e source_type=complement ao criar."""
        validated_data["payer"] = "customer"
        validated_data["source_type"] = "complement"
        return super().create(validated_data)


# -- Resumo financeiro da OS --

class FinancialSummarySerializer(serializers.Serializer):
    """Resumo financeiro completo da OS, desagregado por origem e pagador."""

    insurer_parts = serializers.DecimalField(max_digits=14, decimal_places=2)
    insurer_labor = serializers.DecimalField(max_digits=14, decimal_places=2)
    insurer_subtotal = serializers.DecimalField(max_digits=14, decimal_places=2)
    deductible = serializers.DecimalField(max_digits=14, decimal_places=2)
    insurer_net = serializers.DecimalField(max_digits=14, decimal_places=2)
    complement_parts = serializers.DecimalField(max_digits=14, decimal_places=2)
    complement_labor = serializers.DecimalField(max_digits=14, decimal_places=2)
    complement_subtotal = serializers.DecimalField(max_digits=14, decimal_places=2)
    complement_billed = serializers.DecimalField(max_digits=14, decimal_places=2)
    complement_pending = serializers.DecimalField(max_digits=14, decimal_places=2)
    customer_owes = serializers.DecimalField(max_digits=14, decimal_places=2)
    insurer_owes = serializers.DecimalField(max_digits=14, decimal_places=2)
    grand_total = serializers.DecimalField(max_digits=14, decimal_places=2)
    # Import VersionDetailSerializer lazily to avoid circular import
    active_version = serializers.SerializerMethodField()

    def get_active_version(self, obj: dict) -> dict | None:
        version = obj.get("active_version") if isinstance(obj, dict) else getattr(obj, "active_version", None)
        if version is None:
            return None
        from apps.service_orders.serializers.versioning import VersionDetailSerializer
        return VersionDetailSerializer(version).data


class VehicleHistoryItemSerializer(serializers.ModelSerializer):
    """Serializer compacto para itens do historico de veiculo."""

    total = serializers.FloatField(read_only=True)

    class Meta:
        model = ServiceOrder
        fields = [
            "id",
            "number",
            "status",
            "customer_name",
            "entry_date",
            "delivered_at",
            "parts_total",
            "services_total",
            "discount_total",
            "total",
        ]
        read_only_fields = fields


# -- Override de Transicao -- Serializers --

class TransitionValidationResultSerializer(serializers.Serializer):
    """Resultado de validacao de transicao -- read-only."""

    can_proceed = serializers.BooleanField()
    hard_blocks = serializers.ListField(child=serializers.DictField())
    soft_blocks = serializers.ListField(child=serializers.DictField())
    warnings = serializers.ListField(child=serializers.DictField())
    has_pending_override = serializers.BooleanField()


class OverrideRequestCreateSerializer(serializers.Serializer):
    """Criacao de solicitacao de override."""

    target_status = serializers.ChoiceField(choices=ServiceOrderStatus.choices)
    reason = serializers.CharField(max_length=1000)


class OverrideResolveSerializer(serializers.Serializer):
    """Resolucao de override (aprovar/rejeitar)."""

    action = serializers.ChoiceField(choices=["approved", "rejected"])
    justification = serializers.CharField(max_length=1000)


class OverrideRequestSerializer(serializers.ModelSerializer):
    """Serializer de leitura de TransitionOverrideRequest."""

    requested_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    os_number = serializers.IntegerField(source="service_order.number", read_only=True)
    os_plate = serializers.CharField(source="service_order.plate", read_only=True)
    os_customer_name = serializers.CharField(source="service_order.customer_name", read_only=True)

    class Meta:
        model = TransitionOverrideRequest
        fields = [
            "id", "os_number", "os_plate", "os_customer_name",
            "from_status", "to_status", "status",
            "blocks_snapshot", "request_reason", "justification",
            "requested_by_name", "approved_by_name",
            "created_at", "resolved_at", "expires_at",
        ]

    def get_requested_by_name(self, obj) -> str:
        """Retorna nome completo ou email do solicitante."""
        return obj.requested_by.get_full_name() or obj.requested_by.email

    def get_approved_by_name(self, obj) -> str:
        """Retorna nome completo ou email do aprovador, ou string vazia."""
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.email
        return ""
