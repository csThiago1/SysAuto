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
    ServiceOrderActivityLogSerializer,
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
            serializer.save(service_order=service_order, created_by=request.user)
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
        serializer = ServiceOrderPartSerializer(part, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
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
            serializer.save(service_order=service_order, created_by=request.user)
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
        serializer = ServiceOrderLaborSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
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
    Endpoint de métricas resumidas para o dashboard do ERP DS Car.

    Retorna contagem de OS abertas, agrupamento por status
    e previsões de entrega para hoje.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        """Retorna estatísticas agregadas das OS do tenant."""
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

        logger.debug(
            "Dashboard stats: total_open=%d today_deliveries=%d",
            total_open,
            today_deliveries,
        )

        return Response(
            {
                "total_open": total_open,
                "by_status": by_status,
                "today_deliveries": today_deliveries,
            },
            status=status.HTTP_200_OK,
        )
