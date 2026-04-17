"""
Paddock Solutions — Accounting: ViewSet de Despesas Recorrentes
"""
import logging
from typing import Any

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from apps.accounting.models.despesa_recorrente import DespesaRecorrente
from apps.accounting.serializers.despesa_recorrente import (
    DespesaRecorrenteListSerializer,
    DespesaRecorrenteSerializer,
)
from apps.authentication.permissions import IsAdminOrAbove, IsManagerOrAbove

logger = logging.getLogger(__name__)


class DespesaRecorrenteViewSet(ModelViewSet):
    """
    CRUD de despesas recorrentes.

    Leitura:  MANAGER+
    Escrita:  ADMIN+

    list      GET    /accounting/despesas-recorrentes/
    retrieve  GET    /accounting/despesas-recorrentes/{id}/
    create    POST   /accounting/despesas-recorrentes/
    update    PUT    /accounting/despesas-recorrentes/{id}/
    partial   PATCH  /accounting/despesas-recorrentes/{id}/
    destroy   DELETE /accounting/despesas-recorrentes/{id}/
    """

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "empresa": ["exact"],
        "tipo": ["exact", "in"],
        "vigente_ate": ["isnull"],
        "is_active": ["exact"],
    }
    search_fields = ["descricao", "observacoes"]
    ordering_fields = ["vigente_desde", "valor_mensal", "tipo"]

    def get_queryset(self) -> Any:
        """Retorna despesas ativas com select_related para empresa e conta_contabil."""
        return (
            DespesaRecorrente.objects.filter(is_active=True)
            .select_related("empresa", "conta_contabil")
            .order_by("-vigente_desde")
        )

    def get_serializer_class(self) -> Any:
        if self.action in ("retrieve", "create", "update", "partial_update"):
            return DespesaRecorrenteSerializer
        return DespesaRecorrenteListSerializer

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAdminOrAbove()]
        return [IsAuthenticated(), IsManagerOrAbove()]

    def perform_create(self, serializer: DespesaRecorrenteSerializer) -> None:  # type: ignore[override]
        serializer.save(created_by=self.request.user)
