"""
Paddock Solutions — Accounting: ViewSets de Exercicio e Periodo Fiscal
"""
import logging
from typing import Any

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet, ModelViewSet

from apps.accounting.models.fiscal_period import FiscalPeriod, FiscalYear
from apps.accounting.serializers.fiscal_period import (
    FiscalPeriodDetailSerializer,
    FiscalPeriodListSerializer,
    FiscalYearSerializer,
)
from apps.accounting.services.fiscal_period_service import FiscalPeriodService

logger = logging.getLogger(__name__)


class FiscalYearViewSet(ModelViewSet):
    """
    CRUD de exercicios fiscais.

    list     GET  /accounting/fiscal-years/
    retrieve GET  /accounting/fiscal-years/{id}/
    create   POST /accounting/fiscal-years/
    """

    permission_classes = [IsAuthenticated]
    serializer_class = FiscalYearSerializer
    http_method_names = ["get", "post", "head", "options"]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = {"is_closed": ["exact"]}
    ordering_fields = ["year"]

    def get_queryset(self) -> Any:
        return FiscalYear.objects.filter(is_active=True).order_by("-year")

    def perform_create(self, serializer: FiscalYearSerializer) -> None:
        serializer.save(created_by=self.request.user)


class FiscalPeriodViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    GenericViewSet,
):
    """
    Gerenciamento de periodos fiscais.

    list     GET  /accounting/fiscal-periods/
    retrieve GET  /accounting/fiscal-periods/{id}/
    create   POST /accounting/fiscal-periods/
    close    POST /accounting/fiscal-periods/{id}/close/
    current  GET  /accounting/fiscal-periods/current/
    """

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = {"is_closed": ["exact"], "fiscal_year": ["exact"]}
    ordering_fields = ["fiscal_year__year", "number"]

    def get_queryset(self) -> Any:
        return (
            FiscalPeriod.objects.select_related("fiscal_year")
            .filter(is_active=True)
            .order_by("-fiscal_year__year", "number")
        )

    def get_serializer_class(self) -> Any:
        if self.action == "retrieve" or self.action == "current":
            return FiscalPeriodDetailSerializer
        return FiscalPeriodListSerializer

    def perform_create(self, serializer: FiscalPeriodListSerializer) -> None:
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request: Request, pk: str | None = None) -> Response:
        """
        Fecha o periodo fiscal.

        Valida que nao ha lancamentos pendentes de aprovacao.
        """
        period = self.get_object()
        try:
            period = FiscalPeriodService.close_period(period, user=request.user)
        except Exception as exc:
            logger.warning("FiscalPeriodViewSet.close: %s", exc)
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = FiscalPeriodDetailSerializer(period, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="current")
    def current(self, request: Request) -> Response:
        """Retorna o periodo fiscal do mes atual (cria se nao existir)."""
        period = FiscalPeriodService.get_current_period()
        if period is None:
            return Response(
                {"detail": "Não foi possível obter o período atual."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        serializer = FiscalPeriodDetailSerializer(period, context={"request": request})
        return Response(serializer.data)
