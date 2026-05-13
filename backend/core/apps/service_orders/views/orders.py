"""
Paddock Solutions — Service Orders: Main ServiceOrderViewSet
ViewSet completo para OS com CRUD + 15+ custom actions.
"""
import logging
from datetime import timedelta
from typing import Any, Optional

from django.db.models import Count, DecimalField, Exists, F, Max, Min, OuterRef, Q, QuerySet, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
import httpx

from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove
from rest_framework.request import Request
from rest_framework.response import Response

from ..models import (
    ChecklistItem,
    ServiceOrder,
    ServiceOrderActivityLog,
    ServiceOrderPhoto,
    ServiceOrderStatus,
    StatusTransitionLog,
    ServiceOrderPart,
    ServiceOrderLabor,
)
from ..serializers import (
    BudgetSnapshotSerializer,
    ChecklistItemBulkSerializer,
    ChecklistItemSerializer,
    ComplementLaborCreateSerializer,
    ComplementPartCreateSerializer,
    DeliverOSSerializer,
    FinancialSummarySerializer,
    OverrideRequestCreateSerializer,
    OverrideRequestSerializer,
    OverrideResolveSerializer,
    PartCompraInputSerializer,
    PartEstoqueInputSerializer,
    PartSeguradoraInputSerializer,
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
    NotificationFeedSerializer,
    UploadPhotoSerializer,
    VersionDetailSerializer,
    VehicleHistoryItemSerializer,
)
from apps.accounts_receivable.models import ReceivableDocument
from ..billing import BillingService
from ..services import ServiceOrderDeliveryService, ServiceOrderService

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
    Transição de status: POST /service-orders/{number}/transition/
    Histórico de transições: GET /service-orders/{number}/transitions/
    Próximo número: GET /service-orders/next-number/
    """

    lookup_field = "pk"
    lookup_value_regex = r"[0-9a-f-]+"
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

    def get_object(self) -> ServiceOrder:
        """Aceita tanto UUID quanto número da OS na URL."""
        lookup = self.kwargs.get(self.lookup_field, "")
        qs = self.filter_queryset(self.get_queryset())
        if lookup.isdigit():
            obj = get_object_or_404(qs, number=int(lookup))
        else:
            obj = get_object_or_404(qs, pk=lookup)
        self.check_object_permissions(self.request, obj)
        return obj

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
            .order_by("-opened_at")
        )

        if self.action in ("retrieve", "update", "partial_update", "transition",
                           "deliver", "billing", "financial_summary"):
            from django.db.models import Prefetch
            qs = qs.prefetch_related(
                Prefetch(
                    "transition_logs",
                    queryset=StatusTransitionLog.objects.select_related("changed_by").order_by("-created_at"),
                ),
                "photos",
                "parts",
                "labor_items",
                "budget_snapshots",
                Prefetch(
                    "activities",
                    queryset=ServiceOrderActivityLog.objects.select_related("user").order_by("-created_at"),
                ),
            )

        qs = qs.annotate(
            _has_any_receivables=Exists(
                ReceivableDocument.objects.filter(
                    service_order_id=OuterRef("pk"),
                    is_active=True,
                )
            ),
            _has_pending_receivables=Exists(
                ReceivableDocument.objects.filter(
                    service_order_id=OuterRef("pk"),
                    is_active=True,
                ).exclude(status="received")
            ),
        )

        if self.request.query_params.get("exclude_closed") == "true":
            qs = qs.exclude(
                status__in=[ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELLED]
            )

        closure = self.request.query_params.get("closure")
        if closure == "closed":
            qs = qs.filter(
                status=ServiceOrderStatus.DELIVERED,
                invoice_issued=True,
                _has_any_receivables=True,
                _has_pending_receivables=False,
            )
        elif closure == "pending":
            qs = qs.filter(status=ServiceOrderStatus.DELIVERED).exclude(
                invoice_issued=True,
                _has_any_receivables=True,
                _has_pending_receivables=False,
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
        if not serializer.is_valid():
            logger.warning(
                "PATCH OS #%s falhou validação: %s (campos enviados: %s)",
                instance.number,
                serializer.errors,
                list(request.data.keys()),
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
        Body: {"new_status": "<status>", "force": false, "justification": "..."}
        """
        service_order: ServiceOrder = self.get_object()
        serializer = ServiceOrderStatusTransitionSerializer(
            data=request.data,
            context={"service_order": service_order, "request": request},
        )
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        new_status: str = data["new_status"]
        force: bool = data.get("force", False)

        # Se override presencial com credenciais do gerente, usar ID do gerente
        manager_user = data.get("_manager_user")
        changed_by_id = str(manager_user.id) if manager_user else str(request.user.id)

        # Capturar warnings ANTES da transição (depois o status muda e a validação não se aplica)
        from apps.service_orders.transition_validator import TransitionValidator
        pre_validation = TransitionValidator.validate(
            service_order, new_status, justification=data.get("justification", "")
        )

        order = ServiceOrderService.transition(
            order_id=str(service_order.id),
            new_status=new_status,
            changed_by_id=changed_by_id,
            force=force,
            override_id=str(data["override_id"]) if data.get("override_id") else None,
            justification=data.get("justification", ""),
        )

        # Fire push notification to the consultant (if they have a token registered)
        consultant = order.consultant
        if consultant is not None:
            from apps.authentication.models import GlobalUser
            from django_tenants.utils import get_tenant
            from ..tasks import task_notify_status_change
            from ..models import ServiceOrderStatus as SOS

            status_label = dict(SOS.choices).get(new_status, new_status)
            try:
                from django.db import connection
                schema = getattr(connection.tenant, "schema_name", "public")
            except Exception:
                schema = "public"

            task_notify_status_change.delay(
                tenant_schema=schema,
                user_id=str(consultant.pk),
                os_number=order.number,
                plate=order.plate or "",
                new_status_label=status_label,
            )

        detail = ServiceOrderDetailSerializer(order, context={"request": request}).data

        # Incluir warnings da validação pré-transição no response
        if pre_validation.warnings:
            detail["_warnings"] = [w.to_dict() for w in pre_validation.warnings]

        return Response(detail)

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

    @extend_schema(summary="Feed de notificações — últimas transições de status")
    @action(detail=False, methods=["get"], url_path="notifications")
    def notifications(self, request: Request) -> Response:
        """GET /service-orders/notifications/ — últimas 50 transições no tenant."""
        logs = (
            StatusTransitionLog.objects.filter(service_order__is_active=True)
            .select_related("service_order", "changed_by")
            .order_by("-created_at")[:50]
        )
        return Response(NotificationFeedSerializer(logs, many=True).data)

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
        from django.db.models import Prefetch
        from django.utils.dateparse import parse_datetime

        since_str = request.query_params.get("since")
        since_dt = parse_datetime(since_str) if since_str else None

        # Prefetch foto de frente (cover) para evitar N+1 no serializer
        cover_prefetch = Prefetch(
            "photos",
            queryset=ServiceOrderPhoto.objects.filter(
                slot="frente", checklist_type="entrada", is_active=True,
            ).order_by("-uploaded_at"),
        )

        if since_dt is None:
            # Primeiro sync: todos os registros ativos vão em created
            created_qs = (
                ServiceOrder.objects.filter(is_active=True)
                .select_related("consultant")
                .prefetch_related(cover_prefetch)
            )
            updated_qs = ServiceOrder.objects.none()
            deleted_ids: list[str] = []
        else:
            # Sync incremental: separa por data de criação vs atualização
            changed_qs = (
                ServiceOrder.objects.filter(updated_at__gte=since_dt)
                .select_related("consultant")
                .prefetch_related(cover_prefetch)
            )

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

            from ..models import ServiceOrderActivityLog
            log = ServiceOrderActivityLog.objects.create(
                service_order=service_order,
                user=request.user,
                activity_type=activity_type,
                description=message,
                metadata=metadata,
            )
            return Response(ServiceOrderActivityLogSerializer(log).data, status=status.HTTP_201_CREATED)

        # GET
        from ..models import ServiceOrderActivityLog
        logs = (
            ServiceOrderActivityLog.objects
            .filter(service_order=service_order)
            .select_related("user")
            .order_by("-created_at")
        )
        serializer = ServiceOrderActivityLogSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="billing/preview")
    def billing_preview(self, request: Request, pk: Optional[str] = None) -> Response:
        """GET /service-orders/{id}/billing/preview/ — breakdown de faturamento."""
        order = self.get_object()
        from apps.service_orders.billing import BillingService
        preview = BillingService.preview(order)
        return Response(preview)

    @action(detail=True, methods=["post"], url_path="billing")
    def billing(self, request: Request, pk: Optional[str] = None) -> Response:
        """POST /service-orders/{id}/billing/ — fatura OS atomicamente."""
        order = self.get_object()
        items = request.data.get("items", [])
        if not items:
            return Response(
                {"detail": "Nenhum item de faturamento informado."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from apps.service_orders.billing import BillingService
        try:
            result = BillingService.bill(
                order=order, items=items, user=request.user,
            )
        except ValueError as e:
            return Response(
                {"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST,
            )
        from apps.accounts_receivable.serializers import ReceivableDocumentSerializer
        from apps.fiscal.serializers import FiscalDocumentListSerializer
        return Response({
            "receivables": ReceivableDocumentSerializer(
                result["receivables"], many=True,
            ).data,
            "fiscal_documents": FiscalDocumentListSerializer(
                result["fiscal_documents"], many=True,
            ).data,
            "summary": result["summary"],
        }, status=status.HTTP_201_CREATED)

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
            return Response({"detail": "sinistro e orcamento são obrigatórios"}, status=400)

        if isinstance(orcamento, str) and "." in orcamento and not versao:
            parts = orcamento.split(".")
            orcamento = parts[0]
            versao = parts[1]

        from apps.cilia.client import buscar_orcamento
        try:
            dados = buscar_orcamento(str(sinistro), str(orcamento), str(versao) if versao else None)
        except httpx.HTTPError as e:
            logger.error(f"Erro Cilia API: {e}")
            return Response({"detail": "Erro ao comunicar com a API Cilia"}, status=502)
        except Exception as e:
            logger.error(f"Erro inesperado no import Cilia: {e}")
            return Response({"detail": "Erro interno ao processar importação."}, status=500)

        # Update ServiceOrder
        totals = dados.get("totals", {})
        service_order.parts_total = totals.get("total_pieces_cost", 0)
        service_order.services_total = totals.get("total_workforce_cost", 0)
        service_order.casualty_number = str(sinistro)

        # Opcional: Atualizar a seguradora se vier no json e quisermos forçar,
        # mas como é update, atualizamos apenas dados financeiros e o ID do sinistro.
        service_order.save(update_fields=["parts_total", "services_total", "casualty_number", "updated_at"])

        from ..models import ServiceOrderActivityLog
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
    @action(detail=True, methods=["patch", "delete"], url_path=r"parts/(?P<part_pk>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})")
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
            # PC-3: liberar estoque se bloqueada
            if part.unidade_fisica_id:
                try:
                    from apps.inventory.services.reserva import ReservaUnidadeService

                    ReservaUnidadeService.liberar(str(part.unidade_fisica_id))
                except Exception:
                    logger.warning("Não foi possível liberar unidade %s", part.unidade_fisica_id)

            desc = part.description
            part.delete()
            ServiceOrderActivityLog.objects.create(
                service_order=service_order,
                user=request.user,
                activity_type="part_removed",
                description=f"Peça '{desc}' removida da OS",
            )
            return Response(status=status.HTTP_204_NO_CONTENT)

        # PC-1: origem não pode ser alterada após criação
        if "origem" in request.data:
            return Response(
                {"detail": "Campo 'origem' não pode ser alterado (PC-1)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

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

    @extend_schema(summary="Adicionar peça do estoque à OS")
    @action(detail=True, methods=["post"], url_path="parts/estoque")
    def parts_estoque(self, request: Request, pk: Optional[str] = None) -> Response:
        """Adicionar peça do estoque — bloqueia imediatamente (PC-2)."""
        os = self.get_object()
        serializer = PartEstoqueInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        try:
            from apps.inventory.models_physical import UnidadeFisica
            from apps.inventory.services.reserva import ReservaUnidadeService

            unidade = UnidadeFisica.objects.get(
                pk=d["unidade_fisica_id"], is_active=True, status="available",
            )

            # Reservar (bloquear) — PC-2
            ReservaUnidadeService.reservar(
                peca_canonica_id=str(unidade.peca_canonica_id) if unidade.peca_canonica_id else None,
                quantidade=1,
                ordem_servico_id=str(os.id),
                user_id=request.user.id,
            )

            # Criar part
            description = d.get("description") or (
                unidade.produto_peca.nome_interno
                if unidade.produto_peca
                else f"Peça {unidade.codigo_barras}"
            )
            part = ServiceOrderPart.objects.create(
                service_order=os,
                description=description,
                unit_price=d["unit_price"],
                quantity=1,
                origem="estoque",
                tipo_qualidade=d["tipo_qualidade"],
                status_peca="bloqueada",
                unidade_fisica=unidade,
                custo_real=unidade.valor_nf,
                created_by=request.user,
            )
            return Response(ServiceOrderPartSerializer(part).data, status=status.HTTP_201_CREATED)
        except UnidadeFisica.DoesNotExist:
            return Response({"detail": "Peça não encontrada ou indisponível."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error("Erro ao adicionar peça do estoque: %s", e)
            return Response({"detail": "Erro ao adicionar peça do estoque."}, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(summary="Solicitar compra de peça para OS")
    @action(detail=True, methods=["post"], url_path="parts/compra")
    def parts_compra(self, request: Request, pk: Optional[str] = None) -> Response:
        """Solicitar compra — gera PedidoCompra automaticamente."""
        os = self.get_object()
        serializer = PartCompraInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        try:
            part = ServiceOrderPart.objects.create(
                service_order=os,
                description=d["description"],
                part_number=d.get("part_number", ""),
                unit_price=d["unit_price"],
                quantity=d.get("quantity", 1),
                origem="compra",
                tipo_qualidade=d["tipo_qualidade"],
                status_peca="aguardando_cotacao",
                created_by=request.user,
            )
            # Gerar pedido de compra
            from apps.purchasing.services import PedidoCompraService

            PedidoCompraService.solicitar(
                service_order_part_id=part.id,
                descricao=d["description"],
                codigo_referencia=d.get("part_number", ""),
                tipo_qualidade=d["tipo_qualidade"],
                quantidade=d.get("quantity", 1),
                valor_cobrado_cliente=d["unit_price"],
                observacoes=d.get("observacoes", ""),
                user_id=request.user.id,
            )
            part.refresh_from_db()
            return Response(ServiceOrderPartSerializer(part).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error("Erro ao solicitar compra: %s", e)
            return Response({"detail": "Erro ao solicitar compra."}, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(summary="Registrar peça de seguradora na OS")
    @action(detail=True, methods=["post"], url_path="parts/seguradora")
    def parts_seguradora(self, request: Request, pk: Optional[str] = None) -> Response:
        """Registrar peça de seguradora (complemento manual — PC-11)."""
        os = self.get_object()
        serializer = PartSeguradoraInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        try:
            part = ServiceOrderPart.objects.create(
                service_order=os,
                description=d["description"],
                unit_price=d["unit_price"],
                quantity=d.get("quantity", 1),
                origem="seguradora",
                tipo_qualidade=d["tipo_qualidade"],
                status_peca="aguardando_seguradora",
                created_by=request.user,
            )
            return Response(ServiceOrderPartSerializer(part).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error("Erro ao registrar peça seguradora: %s", e)
            return Response({"detail": "Erro ao registrar peça."}, status=status.HTTP_400_BAD_REQUEST)

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
    @action(detail=True, methods=["patch", "delete"], url_path=r"labor/(?P<labor_pk>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})")
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
        try:
            days_ahead = max(0, min(int(request.query_params.get("days_ahead", 0)), 365))
        except (ValueError, TypeError):
            days_ahead = 0
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
        from ..models import ActivityType, OSPhotoFolder

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
            from django.utils import timezone
            import datetime
            window = timezone.now() - datetime.timedelta(minutes=30)
            existing_log = ServiceOrderActivityLog.objects.filter(
                service_order=service_order,
                user=request.user,
                activity_type=ActivityType.FILE_UPLOAD,
                metadata__folder=folder,
                created_at__gte=window,
            ).order_by("-created_at").first()

            if existing_log:
                count = existing_log.metadata.get("count", 1) + 1
                existing_log.metadata["count"] = count
                existing_log.metadata.setdefault("s3_keys", [existing_log.metadata.get("s3_key", "")])
                existing_log.metadata["s3_keys"].append(saved_path)
                existing_log.description = f"{count} fotos adicionadas — {folder_label}"
                existing_log.save(update_fields=["description", "metadata"])
            else:
                ServiceOrderActivityLog.objects.create(
                    service_order=service_order,
                    user=request.user,
                    activity_type=ActivityType.FILE_UPLOAD,
                    description=f"1 foto adicionada — {folder_label}",
                    metadata={"folder": folder, "count": 1, "s3_key": saved_path},
                )

            logger.info(
                "Foto enviada para OS #%d — pasta=%s path=%s por user_id=%s",
                service_order.number,
                folder,
                saved_path,
                request.user.id,
            )
            return Response(
                ServiceOrderPhotoSerializer(photo, context={"request": request}).data,
                status=status.HTTP_201_CREATED,
            )

        active_photos = service_order.photos.filter(is_active=True).order_by("uploaded_at")
        return Response(
            ServiceOrderPhotoSerializer(active_photos, many=True, context={"request": request}).data
        )

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
    @action(detail=True, methods=["delete"], url_path=r"photos/(?P<photo_pk>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})")
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

    @action(detail=True, methods=["get"], url_path="versions")
    def versions(self, request: Request, pk: Optional[str] = None) -> Response:
        """Lista versões de uma OS específica (GET /service-orders/{id}/versions/)."""
        from ..serializers import ServiceOrderVersionSerializer
        os = self.get_object()
        qs = os.versions.prefetch_related("items").order_by("-version_number")
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(
                ServiceOrderVersionSerializer(page, many=True).data
            )
        return Response(ServiceOrderVersionSerializer(qs, many=True).data)

    @action(detail=True, methods=["get"], url_path="events")
    def events(self, request: Request, pk: Optional[str] = None) -> Response:
        """Lista timeline de eventos de uma OS (GET /service-orders/{id}/events/)."""
        from ..serializers import ServiceOrderEventSerializer
        os = self.get_object()
        qs = os.events.order_by("-created_at")
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(
                ServiceOrderEventSerializer(page, many=True).data
            )
        return Response(ServiceOrderEventSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"], url_path="import-budget")
    def import_budget(self, request: Request, pk: Optional[str] = None) -> Response:
        """Importa orçamento via Cilia (webservice), Soma (XML) ou Audatex (HTML).

        Para Cilia: faz fetch → parse → cria versão diretamente na OS atual.
        Para Soma/Audatex: TODO — upload de arquivo.
        """
        import logging
        order = self.get_object()
        source = request.data.get("source", "cilia")
        logger = logging.getLogger(__name__)

        if source == "cilia":
            casualty_number = request.data.get("casualty_number", order.casualty_number)
            budget_number = request.data.get("budget_number")
            version_number = request.data.get("version_number")

            if not casualty_number or not budget_number:
                return Response(
                    {"error": "casualty_number e budget_number são obrigatórios."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # 1. Fetch do Cilia (client → parse)
            from apps.cilia.client import CiliaClient, CiliaError
            from apps.cilia.sources.cilia_parser import CiliaParser

            client = CiliaClient()
            try:
                response = client.get_budget(
                    casualty_number=casualty_number,
                    budget_number=budget_number,
                    version_number=version_number,
                )
            except CiliaError as exc:
                logger.warning("Cilia network error: %s", exc)
                return Response(
                    {"detail": "Erro de conexão com a Cilia.", "error_type": "NetworkError"},
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )

            if response.status_code != 200:
                return Response(
                    {"error": f"Cilia retornou HTTP {response.status_code}", "error_type": f"HTTP{response.status_code}"},
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )

            # 2. Parse
            try:
                parsed = CiliaParser.parse(response.data)
            except Exception as exc:
                logger.exception("Cilia parse error: %s", exc)
                return Response(
                    {"detail": "Erro ao processar orçamento.", "error_type": "ParseError"},
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )

            # 3. Atualizar dados da OS com informações do Cilia (preenche campos vazios)
            update_fields: list[str] = []

            field_mapping = {
                "casualty_number": parsed.casualty_number,
                "plate": parsed.vehicle_plate,
                "make": parsed.vehicle_brand,
                "color": parsed.vehicle_color,
                "chassis": parsed.vehicle_chassis,
                "customer_name": parsed.segurado_name,
            }
            for field, value in field_mapping.items():
                if value and not getattr(order, field, None):
                    setattr(order, field, value)
                    update_fields.append(field)

            # Veículo: descrição pode conter marca + modelo
            if not order.model and parsed.vehicle_description:
                # vehicle_description = "brand model year color" — tentar extrair modelo
                desc_parts = parsed.vehicle_description.split()
                if len(desc_parts) >= 2:
                    order.model = " ".join(desc_parts[1:3])  # pega model + version
                    update_fields.append("model")

            if parsed.vehicle_year and not order.year:
                order.year = parsed.vehicle_year
                update_fields.append("year")

            # Seguradora: vincular se não tiver
            if not order.insurer_id and parsed.insurer_code:
                from apps.insurers.models import Insurer
                insurer = Insurer.objects.filter(code=parsed.insurer_code).first()
                if insurer:
                    order.insurer = insurer
                    order.customer_type = "insurer"
                    update_fields.extend(["insurer_id", "customer_type"])

            # Franquia: sempre atualizar (pode mudar entre versões)
            if parsed.franchise_amount:
                order.deductible_amount = parsed.franchise_amount
                update_fields.append("deductible_amount")

            if update_fields:
                order.save(update_fields=update_fields)

            # 4. Criar versão via ImportAttempt + ServiceOrderService
            from apps.cilia.models import ImportAttempt

            attempt = ImportAttempt.objects.create(
                source="cilia",
                trigger="user_requested",
                created_by=request.user.email or "user",
                casualty_number=casualty_number,
                budget_number=str(budget_number),
                version_number=version_number,
                http_status=response.status_code,
                duration_ms=response.duration_ms,
                raw_payload=response.data,
                raw_hash=parsed.raw_hash,
                parsed_ok=True,
                service_order=order,
            )

            # Dedup: se já existe versão com mesmo hash, não criar nova
            existing_version = order.versions.filter(content_hash=parsed.raw_hash).first()
            if existing_version:
                return Response({
                    "action": "applied",
                    "version": VersionDetailSerializer(existing_version).data,
                    "message": "Versão já importada (mesmo conteúdo).",
                })

            version = ServiceOrderService.create_new_version_from_import(
                service_order=order,
                parsed_budget=parsed,
                import_attempt=attempt,
            )
            ServiceOrderService.recalculate_version_totals(version)

            # 5. Se já existia versão anterior, retornar diff
            previous = order.versions.exclude(pk=version.pk).order_by("-version_number").first()
            if previous:
                diff = ServiceOrderService.compute_version_diff(
                    current_version=previous,
                    new_version=version,
                    service_order=order,
                )
                return Response({
                    "action": "diff",
                    "current_version": VersionDetailSerializer(previous).data,
                    "new_version": VersionDetailSerializer(version).data,
                    **diff,
                })

            # Primeira importação — aplicar direto
            ServiceOrderService.apply_version_override(
                service_order=order, new_version=version,
                applied_by=request.user.email or "user",
            )
            return Response({
                "action": "applied",
                "version": VersionDetailSerializer(version).data,
            }, status=status.HTTP_201_CREATED)

        elif source in ("soma", "audatex"):
            return Response(
                {"error": "Importação Soma/Audatex será implementada em breve."},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )

        return Response(
            {"error": f"Fonte '{source}' não suportada."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    @action(detail=True, methods=["post"], url_path="versions/(?P<version_pk>[^/.]+)/apply")
    def apply_version(self, request: Request, pk: Optional[str] = None, version_pk: Optional[str] = None) -> Response:
        """Aplica override de uma versão sobre a OS."""
        from django.shortcuts import get_object_or_404
        order = self.get_object()
        version = get_object_or_404(order.versions, pk=version_pk)
        ServiceOrderService.apply_version_override(
            service_order=order,
            new_version=version,
            applied_by=request.user.email or "user",
        )
        return Response({"status": "applied"})

    @action(detail=True, methods=["get"], url_path="versions/(?P<version_pk>[^/.]+)/diff")
    def version_diff(self, request: Request, pk: Optional[str] = None, version_pk: Optional[str] = None) -> Response:
        """Retorna diff entre versão ativa e versão especificada."""
        from django.shortcuts import get_object_or_404
        order = self.get_object()
        new_version = get_object_or_404(order.versions, pk=version_pk)
        current = order.versions.exclude(pk=new_version.pk).order_by("-version_number").first()
        if not current:
            return Response({"error": "Sem versão anterior para comparar."}, status=400)
        diff = ServiceOrderService.compute_version_diff(
            current_version=current, new_version=new_version, service_order=order,
        )
        return Response({
            "current_version": VersionDetailSerializer(current).data,
            "new_version": VersionDetailSerializer(new_version).data,
            **diff,
        })

    @action(detail=True, methods=["get", "post"], url_path="complement/parts")
    def complement_parts(self, request: Request, pk: Optional[str] = None) -> Response:
        """Lista ou adiciona peças do complemento particular."""
        order = self.get_object()
        if request.method == "GET":
            parts = order.parts.filter(source_type="complement")
            return Response(ServiceOrderPartSerializer(parts, many=True).data)

        serializer = ComplementPartCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        part = serializer.save(service_order=order)

        from apps.service_orders.events import OSEventLogger
        OSEventLogger.log_event(
            order, "COMPLEMENT_ADDED",
            actor=request.user.email or "user",
            payload={"item_type": "part", "description": part.description},
            swallow_errors=True,
        )
        return Response(ServiceOrderPartSerializer(part).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="complement/services")
    def complement_services(self, request: Request, pk: Optional[str] = None) -> Response:
        """Lista ou adiciona serviços do complemento particular."""
        order = self.get_object()
        if request.method == "GET":
            labor = order.labor_items.filter(source_type="complement")
            return Response(ServiceOrderLaborSerializer(labor, many=True).data)

        serializer = ComplementLaborCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        labor = serializer.save(service_order=order)

        from apps.service_orders.events import OSEventLogger
        OSEventLogger.log_event(
            order, "COMPLEMENT_ADDED",
            actor=request.user.email or "user",
            payload={"item_type": "service", "description": labor.description},
            swallow_errors=True,
        )
        return Response(ServiceOrderLaborSerializer(labor).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch", "delete"], url_path=r"complement/items/(?P<item_pk>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})")
    def complement_item(self, request: Request, pk: Optional[str] = None, item_pk: Optional[str] = None) -> Response:
        """Edita ou remove item do complemento."""
        order = self.get_object()

        part = order.parts.filter(pk=item_pk, source_type="complement").first()
        if part:
            if part.billing_status == "billed":
                return Response({"error": "Item já faturado."}, status=400)
            if request.method == "DELETE":
                part.delete()
                return Response(status=status.HTTP_204_NO_CONTENT)
            for field, value in request.data.items():
                if hasattr(part, field) and field not in ("id", "pk", "payer", "source_type"):
                    setattr(part, field, value)
            part.save()
            return Response(ServiceOrderPartSerializer(part).data)

        labor = order.labor_items.filter(pk=item_pk, source_type="complement").first()
        if labor:
            if labor.billing_status == "billed":
                return Response({"error": "Item já faturado."}, status=400)
            if request.method == "DELETE":
                labor.delete()
                return Response(status=status.HTTP_204_NO_CONTENT)
            for field, value in request.data.items():
                if hasattr(labor, field) and field not in ("id", "pk", "payer", "source_type"):
                    setattr(labor, field, value)
            labor.save()
            return Response(ServiceOrderLaborSerializer(labor).data)

        return Response({"error": "Item não encontrado."}, status=404)

    @action(detail=True, methods=["post"], url_path="complement/bill")
    def complement_bill(self, request: Request, pk: Optional[str] = None) -> Response:
        """Fatura itens pendentes do complemento particular."""
        order = self.get_object()
        result = BillingService.bill_complement(
            order, billed_by=request.user.email or "user",
        )
        return Response(result)

    @action(detail=True, methods=["get"], url_path="financial-summary")
    def financial_summary(self, request: Request, pk: Optional[str] = None) -> Response:
        """Resumo financeiro consolidado (seguradora + complemento)."""
        order = self.get_object()
        summary = ServiceOrderService.financial_summary(order)
        return Response(FinancialSummarySerializer(summary).data)

    @extend_schema(
        summary="Histórico de OS por placa do veículo",
        parameters=[
            OpenApiParameter("plate", description="Placa do veículo", required=True),
            OpenApiParameter("exclude_id", description="ID da OS a excluir", required=False),
        ],
    )
    @action(detail=False, methods=["get"], url_path="vehicle-history")
    def vehicle_history(self, request: Request) -> Response:
        """Retorna todas as OS de uma placa com resumo agregado."""
        plate = request.query_params.get("plate", "").strip().upper()
        if not plate:
            return Response(
                {"detail": "Parâmetro 'plate' é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = ServiceOrder.objects.filter(
            plate__iexact=plate, is_active=True
        ).order_by("-opened_at")

        exclude_id = request.query_params.get("exclude_id")
        if exclude_id:
            qs = qs.exclude(pk=exclude_id)

        # Agregações — total_spent só de OS entregues
        delivered_qs = qs.filter(status=ServiceOrderStatus.DELIVERED)
        agg = delivered_qs.aggregate(
            total_spent=Sum(
                F("parts_total") + F("services_total") - F("discount_total"),
                output_field=DecimalField(),
            ),
        )
        first_visit = qs.aggregate(first_visit=Min("entry_date"))

        summary = {
            "os_count": qs.count(),
            "total_spent": str(agg["total_spent"] or 0),
            "first_visit": first_visit["first_visit"],
        }

        serializer = VehicleHistoryItemSerializer(qs, many=True)
        return Response({"summary": summary, "results": serializer.data})

    # ── Override de Transição ─────────────────────────────────────────────────

    @extend_schema(summary="Solicitar override de transição bloqueada")
    @action(detail=True, methods=["post", "get"], url_path="override-request")
    def override_request(self, request: Request, pk: Optional[str] = None) -> Response:
        """POST para criar, GET para listar overrides da OS."""
        from ..models import TransitionOverrideRequest

        service_order = self.get_object()

        if request.method == "GET":
            overrides = TransitionOverrideRequest.objects.filter(
                service_order=service_order
            ).select_related("requested_by", "approved_by")
            return Response(OverrideRequestSerializer(overrides, many=True).data)

        serializer = OverrideRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from datetime import timedelta
        now = timezone.now()

        override = TransitionOverrideRequest.objects.create(
            service_order=service_order,
            from_status=service_order.status,
            to_status=serializer.validated_data["target_status"],
            requested_by=request.user,
            request_reason=serializer.validated_data["reason"],
            expires_at=now + timedelta(hours=24),
        )

        # Capturar blocks snapshot
        from ..transition_validator import TransitionValidator
        result = TransitionValidator.validate(
            service_order, serializer.validated_data["target_status"]
        )
        override.blocks_snapshot = [b.to_dict() for b in result.soft_blocks]
        override.save(update_fields=["blocks_snapshot"])

        # Log event
        from ..events import OSEventLogger
        OSEventLogger.log_event(
            service_order, "OVERRIDE_REQUESTED",
            actor=request.user.get_full_name() or request.user.email,
            payload={
                "override_id": str(override.pk),
                "target_status": override.to_status,
                "reason": override.request_reason,
            },
            swallow_errors=True,
        )

        # Notificar MANAGER+ via push
        from ..tasks import task_notify_override_request
        try:
            from django_tenants.utils import get_tenant
            schema = getattr(get_tenant(request), "schema_name", "public")
        except Exception:
            schema = "public"

        task_notify_override_request.delay(
            tenant_schema=schema,
            override_id=str(override.pk),
            os_number=service_order.number,
            plate=service_order.plate,
            requester_name=request.user.get_full_name() or request.user.email,
            target_status=override.to_status,
        )

        return Response(
            OverrideRequestSerializer(override).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(summary="Resolver override (aprovar/rejeitar)")
    @action(
        detail=True,
        methods=["post"],
        url_path=r"override-request/(?P<override_pk>[0-9a-f-]+)/resolve",
    )
    def override_resolve(self, request: Request, pk: Optional[str] = None, override_pk: Optional[str] = None) -> Response:
        """POST /service-orders/{id}/override-request/{override_id}/resolve/"""
        from ..models import TransitionOverrideRequest
        from apps.authentication.permissions import _has_min_role

        if not _has_min_role(request, "MANAGER"):
            return Response(
                {"detail": "Apenas gerentes podem aprovar/rejeitar overrides."},
                status=status.HTTP_403_FORBIDDEN,
            )

        service_order = self.get_object()
        override = get_object_or_404(
            TransitionOverrideRequest,
            pk=override_pk,
            service_order=service_order,
            status="pending",
        )

        serializer = OverrideResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action_taken = serializer.validated_data["action"]
        override.status = action_taken
        override.approved_by = request.user
        override.justification = serializer.validated_data["justification"]
        override.resolved_at = timezone.now()
        override.save(update_fields=["status", "approved_by", "justification", "resolved_at"])

        # Log event
        from ..events import OSEventLogger
        event_type = "OVERRIDE_APPROVED" if action_taken == "approved" else "OVERRIDE_REJECTED"
        OSEventLogger.log_event(
            service_order, event_type,
            actor=request.user.get_full_name() or request.user.email,
            payload={
                "override_id": str(override.pk),
                "justification": override.justification,
            },
            swallow_errors=True,
        )

        # Se aprovado, executar a transição automaticamente
        if action_taken == "approved":
            try:
                ServiceOrderService.transition(
                    order_id=str(service_order.id),
                    new_status=override.to_status,
                    changed_by_id=str(request.user.id),
                    override_id=str(override.pk),
                )
            except Exception as e:
                logger.error("Falha ao executar transição após override: %s", e)
                return Response(
                    {"detail": "Override aprovado, mas a transição falhou. Contate o suporte."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        # Notificar consultor do resultado
        from ..tasks import task_notify_override_resolved
        try:
            from django_tenants.utils import get_tenant
            schema = getattr(get_tenant(request), "schema_name", "public")
        except Exception:
            schema = "public"

        task_notify_override_resolved.delay(
            tenant_schema=schema,
            override_id=str(override.pk),
            requester_user_id=str(override.requested_by_id),
            os_number=service_order.number,
            plate=service_order.plate,
            action=action_taken,
            justification=override.justification,
        )

        return Response(OverrideRequestSerializer(override).data)

    @extend_schema(summary="Listar overrides pendentes (MANAGER+)")
    @action(detail=False, methods=["get"], url_path="pending-overrides")
    def pending_overrides(self, request: Request) -> Response:
        """GET /service-orders/pending-overrides/ — overrides pendentes no tenant."""
        from apps.authentication.permissions import _has_min_role
        from ..models import TransitionOverrideRequest

        if not _has_min_role(request, "MANAGER"):
            return Response(
                {"detail": "Apenas gerentes podem ver overrides pendentes."},
                status=status.HTTP_403_FORBIDDEN,
            )

        overrides = (
            TransitionOverrideRequest.objects
            .filter(status="pending", expires_at__gt=timezone.now())
            .select_related("service_order", "requested_by")
            .order_by("-created_at")[:50]
        )
        return Response(OverrideRequestSerializer(overrides, many=True).data)
