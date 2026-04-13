"""
Paddock Solutions — Service Orders Views
ViewSet completo para OS + endpoint de dashboard stats.
"""
import logging
from datetime import timedelta
from typing import Any, Optional

from django.db.models import Count, Max, Q, QuerySet
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
import httpx

from apps.authentication.permissions import IsConsultantOrAbove
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    ChecklistItem,
    ServiceCatalog,
    ServiceOrder,
    ServiceOrderActivityLog,
    ServiceOrderPhoto,
    ServiceOrderStatus,
    StatusTransitionLog,
    ServiceOrderPart,
    ServiceOrderLabor,
)
from .serializers import (
    BudgetSnapshotSerializer,
    ChecklistItemBulkSerializer,
    ChecklistItemSerializer,
    DeliverOSSerializer,
    ServiceCatalogListSerializer,
    ServiceCatalogSerializer,
    ServiceOrderActivityLogSerializer,
    ServiceOrderCalendarSerializer,
    ServiceOrderCreateSerializer,
    ServiceOrderDetailSerializer,
    ServiceOrderLaborSerializer,
    ServiceOrderListSerializer,
    ServiceOrderOverdueSerializer,
    ServiceOrderPartSerializer,
    ServiceOrderPhotoSerializer,
    ServiceOrderStatusTransitionSerializer,
    ServiceOrderSyncSerializer,
    ServiceOrderUpdateSerializer,
    StatusTransitionLogSerializer,
    UploadPhotoSerializer,
)
from .services import ServiceOrderDeliveryService, ServiceOrderService

logger = logging.getLogger(__name__)


# ── Activity logging helpers ──────────────────────────────────────────────────

def _build_field_changes(
    old_data: dict,
    new_data: dict,
    field_map: dict[str, str],
) -> list[dict]:
    """
    Compara old_data e new_data usando field_map {campo: label_pt}.
    Retorna lista de {field_label, old_value, new_value} para campos alterados.
    """
    changes = []
    for field, label in field_map.items():
        old_val = str(old_data.get(field, "")) if old_data.get(field) is not None else ""
        new_val = str(new_data.get(field, "")) if new_data.get(field) is not None else ""
        if old_val != new_val:
            changes.append({"field_label": label, "old_value": old_val, "new_value": new_val})
    return changes


PART_FIELD_MAP: dict[str, str] = {
    "description": "Descrição",
    "quantity": "Qtd.",
    "unit_price": "Valor Unit.",
    "discount": "Desconto",
}

LABOR_FIELD_MAP: dict[str, str] = {
    "description": "Descrição",
    "quantity": "Qtd.",
    "unit_price": "Valor Unit.",
    "discount": "Desconto",
}


@extend_schema_view(
    list=extend_schema(
        summary="Listar ordens de serviço",
        parameters=[
            OpenApiParameter("status", description="Filtrar por status", required=False),
            OpenApiParameter("customer_type", description="insurer | private", required=False),
            OpenApiParameter("os_type", description="Tipo de OS", required=False),
            OpenApiParameter("search", description="Busca por placa, número, sinistro ou cliente", required=False),
            OpenApiParameter("ordering", description="Ordenar por campo", required=False),
        ],
    ),
    retrieve=extend_schema(summary="Detalhar ordem de serviço"),
    create=extend_schema(summary="Abrir nova ordem de serviço"),
    update=extend_schema(summary="Atualizar ordem de serviço"),
    partial_update=extend_schema(summary="Atualizar parcialmente uma OS"),
)
class ServiceOrderViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    ViewSet para Ordens de Serviço.

    Não expõe destroy — OS nunca são deletadas (soft delete via is_active).
    Transição de status: POST /service-orders/{id}/transition/
    Histórico de transições: GET /service-orders/{id}/transitions/
    Próximo número: GET /service-orders/next-number/
    """

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "status": ["exact", "in"],
        "customer_type": ["exact"],
        "os_type": ["exact"],
        "insurer": ["exact"],
        "consultant": ["exact"],
        "is_active": ["exact"],
        "entry_date": ["gte", "lte", "date"],
        "estimated_delivery_date": ["gte", "lte"],
        "created_at": ["gte", "lte", "date"],
    }
    search_fields = ["number", "casualty_number", "customer_name", "plate"]
    ordering_fields = ["number", "created_at", "entry_date", "estimated_delivery_date", "opened_at"]
    ordering = ["-opened_at"]

    def get_queryset(self) -> QuerySet[ServiceOrder]:
        """
        Retorna apenas OS ativas do tenant, com select_related otimizado.

        Parâmetro opcional: ?exclude_closed=true
        Exclui delivered e cancelled do resultado — ideal para o Kanban
        (reduz payload ~70% em oficinas com muitas OS entregues).
        """
        qs = (
            ServiceOrder.objects.filter(is_active=True)
            .select_related("consultant", "insurer", "expert", "customer", "created_by")
            .prefetch_related(
                "transition_logs__changed_by",
                "photos",
                "parts",
                "labor_items",
                "budget_snapshots",
                "activities",
            )
            .order_by("-opened_at")
        )
        if self.request.query_params.get("exclude_closed") == "true":
            qs = qs.exclude(
                status__in=[ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELLED]
            )
        return qs

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == "list":
            return ServiceOrderListSerializer
        if self.action == "create":
            return ServiceOrderCreateSerializer
        if self.action in ["update", "partial_update"]:
            return ServiceOrderUpdateSerializer
        return ServiceOrderDetailSerializer

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """Cria nova OS via ServiceOrderService (gera número automático)."""
        serializer = ServiceOrderCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        order = ServiceOrderService.create(
            data=serializer.validated_data,
            created_by_id=str(request.user.id),
        )
        logger.info(
            "OS #%d aberta para placa=%s por user_id=%s",
            order.number,
            order.plate,
            request.user.id,
        )
        return Response(
            ServiceOrderDetailSerializer(order, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """Atualiza OS via ServiceOrderService (processa auto-transitions)."""
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = ServiceOrderUpdateSerializer(
            instance, data=request.data, partial=partial, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        order = ServiceOrderService.update(
            order_id=str(instance.id),
            data=serializer.validated_data,
            updated_by_id=str(request.user.id),
        )
        return Response(ServiceOrderDetailSerializer(order, context={"request": request}).data)

    @extend_schema(summary="Transitar status da OS (Kanban)")
    @action(detail=True, methods=["post"], url_path="transition")
    def transition(self, request: Request, pk: Optional[str] = None) -> Response:
        """
        POST /service-orders/{id}/transition/
        Body: {"new_status": "<status>"}
        """
        service_order: ServiceOrder = self.get_object()
        serializer = ServiceOrderStatusTransitionSerializer(
            data=request.data,
            context={"service_order": service_order, "request": request},
        )
        serializer.is_valid(raise_exception=True)
        new_status: str = serializer.validated_data["new_status"]
        order = ServiceOrderService.transition(
            order_id=str(service_order.id),
            new_status=new_status,
            changed_by_id=str(request.user.id),
        )

        # Fire push notification to the consultant (if they have a token registered)
        consultant = order.consultant
        if consultant is not None:
            from apps.authentication.models import GlobalUser
            from django_tenants.utils import get_tenant
            from .tasks import task_notify_status_change
            from .models import ServiceOrderStatus as SOS

            status_label = dict(SOS.choices).get(new_status, new_status)
            try:
                tenant = get_tenant(request)
                schema = getattr(tenant, "schema_name", "public")
            except Exception:
                schema = "public"

            task_notify_status_change.delay(
                tenant_schema=schema,
                user_id=str(consultant.pk),
                os_number=order.number,
                plate=order.plate or "",
                new_status_label=status_label,
            )

        return Response(ServiceOrderDetailSerializer(order, context={"request": request}).data)

    @extend_schema(summary="Histórico de transições de status")
    @action(detail=True, methods=["get"], url_path="transitions")
    def transitions(self, request: Request, pk: Optional[str] = None) -> Response:
        """GET /service-orders/{id}/transitions/"""
        logs = (
            StatusTransitionLog.objects.filter(service_order_id=pk)
            .select_related("changed_by")
            .order_by("-created_at")
        )
        return Response(StatusTransitionLogSerializer(logs, many=True).data)

    @extend_schema(summary="Próximo número de OS disponível")
    @action(detail=False, methods=["get"], url_path="next-number")
    def next_number(self, request: Request) -> Response:
        """GET /service-orders/next-number/"""
        return Response({"next_number": ServiceOrderService.get_next_number()})

    @extend_schema(
        summary="Sync incremental para WatermelonDB",
        parameters=[
            OpenApiParameter(
                "since",
                description="ISO datetime — retorna apenas OS atualizadas desde esta data",
                required=False,
            )
        ],
    )
    @action(detail=False, methods=["get"], url_path="sync")
    def sync(self, request: Request) -> Response:
        """
        GET /api/v1/service-orders/sync/?since=<iso_datetime>

        Retorna OS no formato WatermelonDB sync protocol.

        Protocolo correto:
        - created: registros criados após `since` (ou todos, no primeiro sync)
        - updated: registros existentes antes de `since` mas modificados depois
        - deleted: registros desativados (is_active=False) após `since`

        Colocar tudo em `created` causa o aviso "[Sync] Server wants client to create
        record ... but it already exists locally" no WatermelonDB.
        """
        from django.utils.dateparse import parse_datetime

        since_str = request.query_params.get("since")
        since_dt = parse_datetime(since_str) if since_str else None

        if since_dt is None:
            # Primeiro sync: todos os registros ativos vão em created
            created_qs = ServiceOrder.objects.filter(is_active=True).select_related("consultant")
            updated_qs = ServiceOrder.objects.none()
            deleted_ids: list[str] = []
        else:
            # Sync incremental: separa por data de criação vs atualização
            changed_qs = ServiceOrder.objects.filter(
                updated_at__gte=since_dt
            ).select_related("consultant")

            created_qs = changed_qs.filter(is_active=True, created_at__gte=since_dt)
            updated_qs = changed_qs.filter(is_active=True, created_at__lt=since_dt)
            deleted_ids = [
                str(pk)
                for pk in changed_qs.filter(is_active=False).values_list("id", flat=True)
            ]

        return Response(
            {
                "changes": {
                    "service_orders": {
                        "created": ServiceOrderSyncSerializer(created_qs, many=True).data,
                        "updated": ServiceOrderSyncSerializer(updated_qs, many=True).data,
                        "deleted": deleted_ids,
                    }
                },
                "timestamp": int(timezone.now().timestamp() * 1000),
            }
        )

    @extend_schema(summary="Ver histórico detalhado da OS", responses=ServiceOrderActivityLogSerializer(many=True))
    @action(detail=True, methods=["get", "post"], url_path="history")
    def history(self, request: Request, pk: Optional[str] = None) -> Response:
        """
        GET /service-orders/{id}/history/ -> Lista o histórico
        POST /service-orders/{id}/history/ -> Adiciona uma nova nota/lembrete (body: {"message": "..."})
        """
        service_order = self.get_object()

        if request.method == "POST":
            message = request.data.get("message", "")
            activity_type = request.data.get("activity_type", "reminder")
            metadata = request.data.get("metadata") or {}

            # Only allow safe activity types from the frontend
            ALLOWED_TYPES = {"reminder", "customer_updated"}
            if activity_type not in ALLOWED_TYPES:
                activity_type = "reminder"

            if not message and activity_type == "reminder":
                return Response({"message": ["Este campo é obrigatório."]}, status=status.HTTP_400_BAD_REQUEST)

            from .models import ServiceOrderActivityLog
            log = ServiceOrderActivityLog.objects.create(
                service_order=service_order,
                user=request.user,
                activity_type=activity_type,
                description=message,
                metadata=metadata,
            )
            return Response(ServiceOrderActivityLogSerializer(log).data, status=status.HTTP_201_CREATED)

        # GET
        from .models import ServiceOrderActivityLog
        logs = ServiceOrderActivityLog.objects.filter(service_order=service_order)
        serializer = ServiceOrderActivityLogSerializer(logs, many=True)
        return Response(serializer.data)

    @extend_schema(summary="Importar orçamento da Cilia para a OS existente")
    @action(detail=True, methods=["post"], url_path="import-cilia")
    def import_cilia(self, request: Request, pk: Optional[str] = None) -> Response:
        """
        POST /service-orders/{id}/import-cilia/
        Body: {"sinistro": "...", "orcamento": "..."}
        """
        service_order: ServiceOrder = self.get_object()
        sinistro = request.data.get("sinistro")
        orcamento = request.data.get("orcamento")
        versao = request.data.get("versao")
        
        if not sinistro or not orcamento:
            return Response({"erro": "sinistro e orcamento são obrigatórios"}, status=400)
            
        if isinstance(orcamento, str) and "." in orcamento and not versao:
            parts = orcamento.split(".")
            orcamento = parts[0]
            versao = parts[1]

        from apps.cilia.client import buscar_orcamento
        try:
            dados = buscar_orcamento(str(sinistro), str(orcamento), str(versao) if versao else None)
        except httpx.HTTPError as e:
            logger.error(f"Erro Cilia API: {e}")
            return Response({"erro": "Erro ao comunicar com a API Cilia"}, status=502)
        except Exception as e:
            return Response({"erro": str(e)}, status=500)
            
        # Update ServiceOrder
        totals = dados.get("totals", {})
        service_order.parts_total = totals.get("total_pieces_cost", 0)
        service_order.services_total = totals.get("total_workforce_cost", 0)
        service_order.casualty_number = str(sinistro)
        
        # Opcional: Atualizar a seguradora se vier no json e quisermos forçar, 
        # mas como é update, atualizamos apenas dados financeiros e o ID do sinistro.
        service_order.save(update_fields=["parts_total", "services_total", "casualty_number", "updated_at"])
        
        from .models import ServiceOrderActivityLog
        ServiceOrderActivityLog.objects.create(
            service_order=service_order,
            user=request.user,
            activity_type="updated",
            description=f"Orçamento Cilia (Sinistro {sinistro} / Orçamento {orcamento}) sincronizado com sucesso."
        )
        
        # Save exact payload to OrcamentoCilia backup
        from apps.cilia.models import OrcamentoCilia
        try:
            conclusion_dict = dados.get("conclusion") or {}
            OrcamentoCilia.objects.update_or_create(
                budget_version_id=dados.get("budget_version_id"),
                defaults={
                    "budget_id": dados.get("budget_id"),
                    "casualty_number": str(dados.get("casualty_number", sinistro)),
                    "budget_number": dados.get("budget_number"),
                    "version_number": dados.get("version_number", 1),
                    "status": dados.get("status", ""),
                    "total_liquid": totals.get("total_liquid", 0),
                    "total_pieces": totals.get("total_pieces_cost", 0),
                    "total_workforce": totals.get("total_workforce_cost", 0),
                    "total_hours": totals.get("total_hours", 0),
                    "raw_data": dados,
                }
            )
        except Exception as e:
            logger.error(f"Erro ao salvar backup de OrcamentoCilia: {e}")

        return Response({"sucesso": True, "total": service_order.total})

    @extend_schema(summary="Listar/adicionar peças da OS")
    @action(detail=True, methods=["get", "post"], url_path="parts")
    def parts(self, request: Request, pk: Optional[str] = None) -> Response:
        """
        GET  /service-orders/{id}/parts/  → lista peças
        POST /service-orders/{id}/parts/  → adiciona peça
        """
        service_order: ServiceOrder = self.get_object()

        if request.method == "POST":
            if service_order.status in (
                ServiceOrderStatus.READY,
                ServiceOrderStatus.DELIVERED,
                ServiceOrderStatus.CANCELLED,
            ):
                return Response(
                    {"detail": "Não é possível modificar itens de uma OS encerrada ou pronta para entrega."},
                    status=422,
                )
            serializer = ServiceOrderPartSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            part = serializer.save(service_order=service_order, created_by=request.user)
            ServiceOrderActivityLog.objects.create(
                service_order=service_order,
                user=request.user,
                activity_type="part_added",
                description=f"Peça '{part.description}' adicionada — {part.quantity}× R${part.unit_price}",
                metadata={
                    "description": part.description,
                    "quantity": str(part.quantity),
                    "unit_price": str(part.unit_price),
                    "discount": str(part.discount),
                    "total": str(part.total),
                },
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        items = service_order.parts.all()
        return Response(ServiceOrderPartSerializer(items, many=True).data)

    @extend_schema(summary="Editar/remover peça da OS")
    @action(detail=True, methods=["patch", "delete"], url_path=r"parts/(?P<part_pk>[^/.]+)")
    def part_detail(self, request: Request, pk: Optional[str] = None, part_pk: Optional[str] = None) -> Response:
        """
        PATCH  /service-orders/{id}/parts/{part_pk}/  → edita peça
        DELETE /service-orders/{id}/parts/{part_pk}/  → remove peça
        """
        service_order: ServiceOrder = self.get_object()
        try:
            part = service_order.parts.get(pk=part_pk)
        except ServiceOrderPart.DoesNotExist:
            return Response({"detail": "Peça não encontrada."}, status=status.HTTP_404_NOT_FOUND)

        if request.method == "DELETE":
            desc = part.description
            part.delete()
            ServiceOrderActivityLog.objects.create(
                service_order=service_order,
                user=request.user,
                activity_type="part_removed",
                description=f"Peça '{desc}' removida da OS",
            )
            return Response(status=status.HTTP_204_NO_CONTENT)

        if service_order.status in (
            ServiceOrderStatus.READY,
            ServiceOrderStatus.DELIVERED,
            ServiceOrderStatus.CANCELLED,
        ):
            return Response(
                {"detail": "Não é possível modificar itens de uma OS encerrada ou pronta para entrega."},
                status=422,
            )
        old_data = {f: str(getattr(part, f, "")) for f in PART_FIELD_MAP}
        serializer = ServiceOrderPartSerializer(part, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated_part = serializer.save()
        new_data = {f: str(getattr(updated_part, f, "")) for f in PART_FIELD_MAP}
        changes = _build_field_changes(old_data, new_data, PART_FIELD_MAP)
        if changes:
            ServiceOrderActivityLog.objects.create(
                service_order=service_order,
                user=request.user,
                activity_type="part_updated",
                description=f"Peça '{updated_part.description}' editada",
                metadata={"field_changes": changes},
            )
        return Response(serializer.data)

    @extend_schema(summary="Listar/adicionar serviços da OS")
    @action(detail=True, methods=["get", "post"], url_path="labor")
    def labor(self, request: Request, pk: Optional[str] = None) -> Response:
        """
        GET  /service-orders/{id}/labor/  → lista serviços
        POST /service-orders/{id}/labor/  → adiciona serviço
        """
        service_order: ServiceOrder = self.get_object()

        if request.method == "POST":
            if service_order.status in (
                ServiceOrderStatus.READY,
                ServiceOrderStatus.DELIVERED,
                ServiceOrderStatus.CANCELLED,
            ):
                return Response(
                    {"detail": "Não é possível modificar itens de uma OS encerrada ou pronta para entrega."},
                    status=422,
                )
            serializer = ServiceOrderLaborSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            labor = serializer.save(service_order=service_order, created_by=request.user)
            ServiceOrderActivityLog.objects.create(
                service_order=service_order,
                user=request.user,
                activity_type="labor_added",
                description=f"Serviço '{labor.description}' adicionado — {labor.quantity}× R${labor.unit_price}",
                metadata={
                    "description": labor.description,
                    "quantity": str(labor.quantity),
                    "unit_price": str(labor.unit_price),
                    "discount": str(labor.discount),
                    "total": str(labor.total),
                },
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        items = service_order.labor_items.all()
        return Response(ServiceOrderLaborSerializer(items, many=True).data)

    @extend_schema(summary="Editar/remover serviço da OS")
    @action(detail=True, methods=["patch", "delete"], url_path=r"labor/(?P<labor_pk>[^/.]+)")
    def labor_detail(self, request: Request, pk: Optional[str] = None, labor_pk: Optional[str] = None) -> Response:
        """
        PATCH  /service-orders/{id}/labor/{labor_pk}/  → edita serviço
        DELETE /service-orders/{id}/labor/{labor_pk}/  → remove serviço
        """
        service_order: ServiceOrder = self.get_object()
        try:
            item = service_order.labor_items.get(pk=labor_pk)
        except ServiceOrderLabor.DoesNotExist:
            return Response({"detail": "Serviço não encontrado."}, status=status.HTTP_404_NOT_FOUND)

        if request.method == "DELETE":
            desc = item.description
            item.delete()
            ServiceOrderActivityLog.objects.create(
                service_order=service_order,
                user=request.user,
                activity_type="labor_removed",
                description=f"Serviço '{desc}' removido da OS",
            )
            return Response(status=status.HTTP_204_NO_CONTENT)

        if service_order.status in (
            ServiceOrderStatus.READY,
            ServiceOrderStatus.DELIVERED,
            ServiceOrderStatus.CANCELLED,
        ):
            return Response(
                {"detail": "Não é possível modificar itens de uma OS encerrada ou pronta para entrega."},
                status=422,
            )
        old_data = {f: str(getattr(item, f, "")) for f in LABOR_FIELD_MAP}
        serializer = ServiceOrderLaborSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        new_data = {f: str(getattr(updated, f, "")) for f in LABOR_FIELD_MAP}
        changes = _build_field_changes(old_data, new_data, LABOR_FIELD_MAP)
        if changes:
            ServiceOrderActivityLog.objects.create(
                service_order=service_order,
                user=request.user,
                activity_type="labor_updated",
                description=f"Serviço '{updated.description}' editado",
                metadata={"field_changes": changes},
            )
        return Response(serializer.data)

    @extend_schema(
        summary="OS vencidas ou com entrega hoje",
        parameters=[
            OpenApiParameter(
                "days_ahead",
                description="Incluir OS vencendo nos próximos N dias (default: 0)",
                required=False,
            ),
            OpenApiParameter(
                "ordering",
                description="Ordenar por campo (estimated_delivery_date, -estimated_delivery_date, number)",
                required=False,
            ),
            OpenApiParameter(
                "status",
                description="Filtrar por status específico",
                required=False,
            ),
        ],
        responses=ServiceOrderOverdueSerializer(many=True),
    )
    @action(detail=False, methods=["get"], url_path="overdue")
    def overdue(self, request: Request) -> Response:
        """
        GET /api/v1/service-orders/overdue/
        Retorna OS ativas com estimated_delivery_date <= cutoff, excluindo delivered/cancelled.
        """
        today = timezone.localdate()
        days_ahead = int(request.query_params.get("days_ahead", 0))
        cutoff = today + timedelta(days=days_ahead)

        open_statuses = [
            s for s in ServiceOrderStatus.values
            if s not in (ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELLED)
        ]

        status_filter = request.query_params.get("status")
        if status_filter and status_filter in open_statuses:
            open_statuses = [status_filter]

        qs = (
            ServiceOrder.objects.filter(
                is_active=True,
                status__in=open_statuses,
                estimated_delivery_date__isnull=False,
                estimated_delivery_date__lte=cutoff,
            )
            .select_related("consultant", "insurer")
            .order_by("estimated_delivery_date")
        )

        ordering = request.query_params.get("ordering")
        if ordering in ("estimated_delivery_date", "-estimated_delivery_date", "number"):
            qs = qs.order_by(ordering)

        serializer = ServiceOrderOverdueSerializer(qs, many=True)
        return Response(serializer.data)

    @extend_schema(summary="Listar/fazer upload de fotos da OS")
    @action(detail=True, methods=["get", "post"], url_path="photos")
    def photos(self, request: Request, pk: Optional[str] = None) -> Response:
        """
        GET  /service-orders/{id}/photos/  → lista fotos ativas com URL
        POST /service-orders/{id}/photos/  → upload de foto (multipart: file, folder, caption)

        Fotos são imutáveis — soft delete apenas (is_active=False).
        """
        from .models import ActivityType, OSPhotoFolder

        service_order: ServiceOrder = self.get_object()

        if request.method == "POST":
            serializer = UploadPhotoSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            file = serializer.validated_data["file"]
            folder = serializer.validated_data["folder"]
            caption = serializer.validated_data.get("caption", "")
            slot = serializer.validated_data.get("slot", "")
            checklist_type = serializer.validated_data.get("checklist_type", "")

            from django.core.files.storage import default_storage
            import uuid as _uuid

            ext = file.name.rsplit(".", 1)[-1].lower() if "." in file.name else "jpg"
            path = f"service_orders/{service_order.id}/{folder}/{_uuid.uuid4().hex}.{ext}"
            saved_path = default_storage.save(path, file)

            photo = ServiceOrderPhoto.objects.create(
                service_order=service_order,
                folder=folder,
                caption=caption,
                slot=slot,
                checklist_type=checklist_type,
                s3_key=saved_path,
                uploaded_by_id=request.user.id,
            )

            folder_label = dict(OSPhotoFolder.choices).get(folder, folder)
            ServiceOrderActivityLog.objects.create(
                service_order=service_order,
                user=request.user,
                activity_type=ActivityType.FILE_UPLOAD,
                description=f"Foto adicionada na pasta: {folder_label}",
                metadata={"folder": folder, "s3_key": saved_path},
            )

            logger.info(
                "Foto enviada para OS #%d — pasta=%s path=%s por user_id=%s",
                service_order.number,
                folder,
                saved_path,
                request.user.id,
            )
            return Response(ServiceOrderPhotoSerializer(photo).data, status=status.HTTP_201_CREATED)

        active_photos = service_order.photos.filter(is_active=True).order_by("uploaded_at")
        return Response(ServiceOrderPhotoSerializer(active_photos, many=True).data)

    @extend_schema(summary="Entregar OS ao cliente")
    @action(detail=True, methods=["post"], url_path="deliver")
    def deliver(self, request: Request, pk: Optional[str] = None) -> Response:
        """
        POST /service-orders/{id}/deliver/
        Entrega a OS ao cliente. Requer status 'ready'.
        Clientes particulares: nfe_key ou nfse_number obrigatório.
        """
        service_order: ServiceOrder = self.get_object()
        serializer = DeliverOSSerializer(
            data=request.data,
            context={"service_order": service_order},
        )
        serializer.is_valid(raise_exception=True)

        updated = ServiceOrderDeliveryService.deliver(
            order=service_order,
            data=serializer.validated_data,
            delivered_by_id=str(request.user.id),
        )
        return Response(ServiceOrderDetailSerializer(updated).data)

    @extend_schema(summary="Listar snapshots de orçamento da OS")
    @action(detail=True, methods=["get"], url_path="budget-snapshots")
    def budget_snapshots(self, request: Request, pk: Optional[str] = None) -> Response:
        """GET /service-orders/{id}/budget-snapshots/"""
        service_order: ServiceOrder = self.get_object()
        snapshots = service_order.budget_snapshots.all()
        return Response(BudgetSnapshotSerializer(snapshots, many=True).data)

    @extend_schema(summary="Remover foto da OS (soft delete)")
    @action(detail=True, methods=["delete"], url_path=r"photos/(?P<photo_pk>[^/.]+)")
    def photo_detail(
        self, request: Request, pk: Optional[str] = None, photo_pk: Optional[str] = None
    ) -> Response:
        """
        DELETE /service-orders/{id}/photos/{photo_pk}/
        Soft delete apenas — s3_key preservado como evidência de sinistro.
        """
        service_order: ServiceOrder = self.get_object()
        try:
            photo = service_order.photos.get(pk=photo_pk)
        except ServiceOrderPhoto.DoesNotExist:
            return Response({"detail": "Foto não encontrada."}, status=status.HTTP_404_NOT_FOUND)

        photo.is_active = False
        photo.save(update_fields=["is_active"])
        logger.info(
            "Foto %s da OS #%d desativada (soft delete) por user_id=%s",
            photo_pk,
            service_order.number,
            request.user.id,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Checklist Items (Sprint M4) ──────────────────────────────────────────

    @extend_schema(
        summary="Listar itens de checklist da OS",
        parameters=[
            OpenApiParameter("checklist_type", description="entrada | acompanhamento | saida", required=False),
        ],
    )
    @action(detail=True, methods=["get"], url_path="checklist-items")
    def list_checklist_items(self, request: Request, pk: Optional[str] = None) -> Response:
        """Lista todos os itens de checklist de uma OS, opcionalmente filtrados por tipo."""
        service_order = self.get_object()
        checklist_type = request.query_params.get("checklist_type")
        qs = service_order.checklist_items.all()
        if checklist_type:
            qs = qs.filter(checklist_type=checklist_type)
        serializer = ChecklistItemSerializer(qs, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="Upsert em lote de itens de checklist",
        request=ChecklistItemBulkSerializer,
        responses={200: ChecklistItemSerializer(many=True)},
    )
    @action(detail=True, methods=["post"], url_path="checklist-items/bulk")
    def bulk_upsert_checklist_items(self, request: Request, pk: Optional[str] = None) -> Response:
        """
        Recebe lista de itens e faz upsert (create_or_update) por
        (service_order, checklist_type, category, item_key).
        Usado pelo app mobile para sincronizar o estado offline.
        """
        service_order = self.get_object()
        serializer = ChecklistItemBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated: list[ChecklistItem] = []
        for item_data in serializer.validated_data["items"]:
            obj, _ = ChecklistItem.objects.update_or_create(
                service_order=service_order,
                checklist_type=item_data["checklist_type"],
                category=item_data["category"],
                item_key=item_data["item_key"],
                defaults={
                    "status": item_data["status"],
                    "notes": item_data.get("notes", ""),
                },
            )
            updated.append(obj)

        return Response(ChecklistItemSerializer(updated, many=True).data)


@extend_schema(
    summary="Dashboard — métricas de OS",
    responses={
        200: {
            "type": "object",
            "properties": {
                "total_open": {"type": "integer"},
                "by_status": {"type": "object"},
                "today_deliveries": {"type": "integer"},
            },
        }
    },
)
class DashboardStatsView(APIView):
    """
    Endpoint de métricas do dashboard — retorno varia conforme role.

    ?role=CONSULTANT → dados pessoais
    ?role=MANAGER|ADMIN|OWNER → KPIs financeiros + equipe
    Sem parâmetro → legacy (retrocompatibilidade)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        """Retorna estatísticas do dashboard conforme role."""
        role = request.query_params.get("role", "").upper()

        if role == "CONSULTANT":
            return Response(self._consultant_stats(request))

        if role in ("MANAGER", "ADMIN", "OWNER"):
            return Response(self._manager_stats())

        # Legacy — retrocompatibilidade
        return Response(self._legacy_stats())

    # ── Legacy ────────────────────────────────────────────────────────────────

    def _legacy_stats(self) -> dict:
        """Retorna métricas no formato legado (compatibilidade)."""
        open_statuses = [
            s
            for s in ServiceOrderStatus.values
            if s not in (ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELLED)
        ]
        active_qs = ServiceOrder.objects.filter(is_active=True, status__in=open_statuses)
        total_open: int = active_qs.count()
        by_status_qs = (
            active_qs.values("status").annotate(count=Count("id")).order_by("status")
        )
        by_status: dict[str, int] = {row["status"]: row["count"] for row in by_status_qs}
        today = timezone.localdate()
        today_deliveries: int = ServiceOrder.objects.filter(
            is_active=True,
            estimated_delivery_date=today,
            status__in=open_statuses,
        ).count()
        return {
            "total_open": total_open,
            "by_status": by_status,
            "today_deliveries": today_deliveries,
        }

    # ── Consultor ─────────────────────────────────────────────────────────────

    def _consultant_stats(self, request: Request) -> dict:
        """Retorna métricas pessoais do consultor."""
        from datetime import timedelta

        today = timezone.localdate()
        week_ago = today - timedelta(days=7)

        open_qs = ServiceOrder.objects.exclude(
            status__in=(ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELLED)
        )
        my_open: int = open_qs.count()

        deliveries_today: int = open_qs.filter(
            estimated_delivery_date=today
        ).count()

        overdue: int = open_qs.filter(
            estimated_delivery_date__lt=today
        ).count()

        completed_week: int = ServiceOrder.objects.filter(
            status=ServiceOrderStatus.DELIVERED,
            delivery_date__date__gte=week_ago,
        ).count()

        recent_os = ServiceOrder.objects.exclude(
            status__in=(ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELLED)
        ).order_by("-opened_at")[:5]

        recent_list = [
            {
                "id": str(os.id),
                "number": os.number,
                "plate": os.plate,
                "customer_name": os.customer_name,
                "status": os.status,
                "status_display": os.get_status_display(),
                "days_in_shop": (today - os.opened_at.date()).days,
            }
            for os in recent_os
        ]

        return {
            "role": "consultant",
            "my_open": my_open,
            "my_deliveries_today": deliveries_today,
            "my_overdue": overdue,
            "my_completed_week": completed_week,
            "my_recent_os": recent_list,
        }

    # ── Gerente / Admin / Diretoria ───────────────────────────────────────────

    def _manager_stats(self) -> dict:
        """Retorna KPIs financeiros e de produtividade para gerentes."""
        import calendar as cal_mod
        from decimal import Decimal

        from django.db.models import ExpressionWrapper, F, Sum
        from django.db.models import DecimalField as DBDecimalField

        today = timezone.localdate()
        month_start = today.replace(day=1)

        # ── Billing: tenta ReceivableDocument, fallback em OS totais ──────────
        billing_month = Decimal("0")
        billing_by_type: dict[str, str] = {"insurer": "0.00", "private": "0.00"}
        billing_last_6: list[dict] = []

        try:
            from apps.accounts_receivable.models import ReceivableDocument

            month_docs = ReceivableDocument.objects.filter(
                competence_date__gte=month_start,
                competence_date__lte=today,
            )
            billing_month = month_docs.aggregate(total=Sum("amount"))["total"] or Decimal("0")

            insurer_total = (
                month_docs.filter(origin="OS_INSURER").aggregate(t=Sum("amount"))["t"]
                or Decimal("0")
            )
            private_total = (
                month_docs.filter(origin="OS_PRIVATE").aggregate(t=Sum("amount"))["t"]
                or Decimal("0")
            )
            billing_by_type = {
                "insurer": str(insurer_total),
                "private": str(private_total),
            }

            for i in range(5, -1, -1):
                year = today.year if today.month - i > 0 else today.year - 1
                month = (today.month - i - 1) % 12 + 1
                m_start = today.replace(year=year, month=month, day=1)
                m_end = m_start.replace(day=cal_mod.monthrange(year, month)[1])
                total = (
                    ReceivableDocument.objects.filter(
                        competence_date__range=(m_start, m_end)
                    ).aggregate(t=Sum("amount"))["t"]
                    or Decimal("0")
                )
                billing_last_6.append({
                    "month": m_start.strftime("%b/%y"),
                    "amount": str(total),
                })

        except ImportError:
            # Fallback: soma services_total + parts_total das OS entregues no mês
            total_expr = ExpressionWrapper(
                F("services_total") + F("parts_total") - F("discount_total"),
                output_field=DBDecimalField(),
            )
            delivered_qs = ServiceOrder.objects.filter(
                status=ServiceOrderStatus.DELIVERED,
                delivery_date__date__gte=month_start,
            )
            totals = delivered_qs.aggregate(
                total=Sum(total_expr),
                insurer=Sum(
                    total_expr,
                    filter=Q(customer_type="insurer"),
                ),
                private_t=Sum(
                    total_expr,
                    filter=Q(customer_type="private"),
                ),
            )
            billing_month = totals["total"] or Decimal("0")
            billing_by_type = {
                "insurer": str(totals["insurer"] or 0),
                "private": str(totals["private_t"] or 0),
            }

        # ── Entregas do mês ────────────────────────────────────────────────────
        delivered_month: int = ServiceOrder.objects.filter(
            status=ServiceOrderStatus.DELIVERED,
            delivery_date__date__gte=month_start,
        ).count()

        avg_ticket = (
            (billing_month / delivered_month).quantize(Decimal("0.01"))
            if delivered_month > 0
            else Decimal("0")
        )

        # ── OS atrasadas ───────────────────────────────────────────────────────
        overdue_qs = (
            ServiceOrder.objects.filter(estimated_delivery_date__lt=today)
            .exclude(status__in=(ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELLED))
            .order_by("estimated_delivery_date")
        )
        overdue_count: int = overdue_qs.count()
        overdue_os = [
            {
                "id": str(os.id),
                "number": os.number,
                "plate": os.plate,
                "customer_name": os.customer_name,
                "estimated_delivery_date": str(os.estimated_delivery_date),
                "days_overdue": (today - os.estimated_delivery_date).days,
                "status": os.status,
                "status_display": os.get_status_display(),
            }
            for os in overdue_qs[:10]
        ]

        # ── Produtividade da equipe (proxy: created_by) ────────────────────────
        productivity_qs = (
            ServiceOrder.objects.filter(
                status=ServiceOrderStatus.DELIVERED,
                delivery_date__date__gte=month_start,
            )
            .values("created_by__email")
            .annotate(delivered=Count("id"))
            .order_by("-delivered")[:10]
        )

        open_by_user = (
            ServiceOrder.objects.exclude(
                status__in=(ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELLED)
            )
            .values("created_by__email")
            .annotate(open_count=Count("id"))
        )
        open_map: dict[str, int] = {
            row["created_by__email"]: row["open_count"] for row in open_by_user
        }

        team_productivity = [
            {
                "email": row["created_by__email"],
                "name": (row["created_by__email"] or "")
                .split("@")[0]
                .replace(".", " ")
                .title(),
                "delivered_month": row["delivered"],
                "open_count": open_map.get(row["created_by__email"], 0),
            }
            for row in productivity_qs
        ]

        return {
            "role": "manager",
            "billing_month": str(billing_month),
            "delivered_month": delivered_month,
            "avg_ticket": str(avg_ticket),
            "overdue_count": overdue_count,
            "billing_by_type": billing_by_type,
            "billing_last_6_months": billing_last_6,
            "team_productivity": team_productivity,
            "overdue_os": overdue_os,
        }


class CalendarView(APIView):
    """
    GET /service-orders/calendar/?date_start=YYYY-MM-DD&date_end=YYYY-MM-DD
    Retorna OS com scheduling_date ou estimated_delivery_date dentro do range.
    Exclui OS canceladas.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        """Retorna lista de OS no range de datas."""
        date_start = request.query_params.get("date_start")
        date_end = request.query_params.get("date_end")

        if not date_start or not date_end:
            return Response(
                {"detail": "Parâmetros date_start e date_end são obrigatórios."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from datetime import datetime as _datetime
            _datetime.strptime(date_start, "%Y-%m-%d")
            _datetime.strptime(date_end, "%Y-%m-%d")
        except ValueError:
            return Response(
                {"detail": "Formato de data inválido. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = (
            ServiceOrder.objects.filter(
                Q(scheduling_date__date__range=(date_start, date_end))
                | Q(estimated_delivery_date__range=(date_start, date_end))
            )
            .exclude(status=ServiceOrderStatus.CANCELLED)
            .select_related("created_by")
        )

        serializer = ServiceOrderCalendarSerializer(qs, many=True)
        return Response(serializer.data)


class ServiceCatalogViewSet(viewsets.ModelViewSet):
    """
    CRUD do catálogo de serviços.
    DELETE faz soft delete (is_active=False).
    """

    serializer_class = ServiceCatalogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self) -> QuerySet:
        """Retorna catálogo ativo, com filtros opcionais de busca e categoria."""
        qs = ServiceCatalog.objects.filter(is_active=True)
        search = self.request.query_params.get("search", "")
        category = self.request.query_params.get("category", "")
        if search:
            qs = qs.filter(name__icontains=search)
        if category:
            qs = qs.filter(category=category)
        return qs

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == "list":
            return ServiceCatalogListSerializer
        return ServiceCatalogSerializer

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """Soft delete: apenas marca is_active=False."""
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)
