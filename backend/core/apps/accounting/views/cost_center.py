"""
Paddock Solutions — Accounting: ViewSet de Centro de Custo
"""
import logging
from typing import Any

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from apps.accounting.models.chart_of_accounts import CostCenter
from apps.accounting.serializers.cost_center import (
    CostCenterCreateSerializer,
    CostCenterDetailSerializer,
    CostCenterListSerializer,
)

logger = logging.getLogger(__name__)


class CostCenterViewSet(ModelViewSet):
    """
    CRUD de centros de custo.

    list     GET  /accounting/cost-centers/
    retrieve GET  /accounting/cost-centers/{id}/
    create   POST /accounting/cost-centers/
    update   PATCH /accounting/cost-centers/{id}/
    """

    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {"is_active": ["exact"]}
    search_fields = ["code", "name"]
    ordering_fields = ["code", "name"]

    def get_queryset(self) -> Any:
        return (
            CostCenter.objects.select_related("parent")
            .filter(is_active=True)
            .order_by("code")
        )

    def get_serializer_class(self) -> Any:
        if self.action in ("create", "update", "partial_update"):
            return CostCenterCreateSerializer
        if self.action == "retrieve":
            return CostCenterDetailSerializer
        return CostCenterListSerializer

    def perform_create(self, serializer: CostCenterCreateSerializer) -> None:
        serializer.save(created_by=self.request.user)
