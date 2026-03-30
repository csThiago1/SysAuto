"""
Paddock Solutions — Service Orders Views
ViewSet completo para OS + endpoint de dashboard stats.
"""
import logging
from typing import Any

from django.db.models import Count, Q, QuerySet
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ServiceOrder, ServiceOrderStatus
from .serializers import (
    ServiceOrderCreateSerializer,
    ServiceOrderDetailSerializer,
    ServiceOrderListSerializer,
    ServiceOrderStatusTransitionSerializer,
)

logger = logging.getLogger(__name__)


@extend_schema_view(
    list=extend_schema(
        summary="Listar ordens de serviço",
        parameters=[
            OpenApiParameter("status", description="Filtrar por status", required=False),
            OpenApiParameter("search", description="Busca por placa ou nome do cliente", required=False),
            OpenApiParameter("ordering", description="Ordenar por campo (ex: opened_at, -opened_at)", required=False),
        ],
    ),
    retrieve=extend_schema(summary="Detalhar ordem de serviço"),
    create=extend_schema(summary="Abrir nova ordem de serviço"),
    update=extend_schema(summary="Atualizar ordem de serviço"),
    partial_update=extend_schema(summary="Atualizar parcialmente uma OS"),
    transition=extend_schema(summary="Transitar status da OS (Kanban)"),
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
    Transição de status feita via action /transition/.
    """

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "is_active"]
    search_fields = ["plate", "customer_name"]
    ordering_fields = ["opened_at", "number", "estimated_delivery"]
    ordering = ["-opened_at"]

    def get_queryset(self) -> QuerySet[ServiceOrder]:
        """Retorna apenas OS ativas do tenant atual, com select_related."""
        return (
            ServiceOrder.objects.filter(is_active=True)
            .select_related("created_by")
            .order_by("-opened_at")
        )

    def get_serializer_class(self):  # type: ignore[override]
        """Seleciona serializer conforme a ação."""
        if self.action == "list":
            return ServiceOrderListSerializer
        if self.action == "create":
            return ServiceOrderCreateSerializer
        return ServiceOrderDetailSerializer

    def perform_create(self, serializer: ServiceOrderCreateSerializer) -> None:
        """Vincula o usuário autenticado como criador da OS."""
        user = self.request.user
        logger.info(
            "Abrindo OS para placa=%s por user_id=%s",
            serializer.validated_data.get("plate"),
            user.id,
        )
        serializer.save(created_by=user)

    def perform_update(self, serializer: ServiceOrderDetailSerializer) -> None:
        """Log de auditoria ao atualizar OS."""
        logger.info(
            "Atualizando OS id=%s por user_id=%s",
            self.get_object().id,
            self.request.user.id,
        )
        serializer.save()

    @action(detail=True, methods=["post"], url_path="transition")
    def transition(self, request: Request, pk: Any = None) -> Response:
        """
        Transita o status de uma OS seguindo as regras do Kanban DS Car.

        Body: {"new_status": "<status>"}
        """
        service_order: ServiceOrder = self.get_object()
        serializer = ServiceOrderStatusTransitionSerializer(
            data=request.data,
            context={"service_order": service_order, "request": request},
        )
        serializer.is_valid(raise_exception=True)

        old_status = service_order.status
        new_status: str = serializer.validated_data["new_status"]
        service_order.status = new_status

        if new_status == ServiceOrderStatus.DELIVERED:
            service_order.delivered_at = timezone.now()

        service_order.save(update_fields=["status", "delivered_at", "updated_at"])

        logger.info(
            "OS id=%s: transição %s → %s por user_id=%s",
            service_order.id,
            old_status,
            new_status,
            request.user.id,
        )

        return Response(
            ServiceOrderDetailSerializer(service_order, context={"request": request}).data
        )


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
        # OS ativas (não entregues e não canceladas)
        open_statuses = [
            s
            for s in ServiceOrderStatus.values
            if s not in (ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELLED)
        ]

        active_qs = ServiceOrder.objects.filter(
            is_active=True, status__in=open_statuses
        )

        total_open: int = active_qs.count()

        # Agrupamento por status
        by_status_qs = (
            active_qs.values("status")
            .annotate(count=Count("id"))
            .order_by("status")
        )
        by_status: dict[str, int] = {row["status"]: row["count"] for row in by_status_qs}

        # Entregas previstas para hoje (estimated_delivery no dia corrente)
        today = timezone.localdate()
        today_deliveries: int = (
            ServiceOrder.objects.filter(
                is_active=True,
                estimated_delivery__date=today,
                status__in=open_statuses,
            ).count()
        )

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
