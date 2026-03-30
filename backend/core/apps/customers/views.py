"""
Paddock Solutions — Customers Views
Somente-leitura: clientes são gerenciados via processo de consentimento LGPD.
"""
import logging

from django.db.models import QuerySet
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import filters, mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from .models import UnifiedCustomer
from .serializers import (
    UnifiedCustomerCreateSerializer,
    UnifiedCustomerDetailSerializer,
    UnifiedCustomerListSerializer,
)

logger = logging.getLogger(__name__)


@extend_schema_view(
    list=extend_schema(
        summary="Listar clientes",
        parameters=[
            OpenApiParameter("search", description="Busca por nome", required=False),
            OpenApiParameter("is_active", description="Filtrar por ativo/inativo", required=False),
        ],
    ),
    retrieve=extend_schema(summary="Detalhar cliente"),
    create=extend_schema(
        summary="Criar cliente",
        description=(
            "Cria um novo cliente unificado. "
            "Consentimento LGPD (lgpd_consent=true) é obrigatório. "
            "CPF e telefone são normalizados para apenas dígitos antes do armazenamento."
        ),
    ),
)
class UnifiedCustomerViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    ViewSet somente-leitura para clientes unificados.

    Criação/edição de clientes ocorre via fluxo de consentimento LGPD —
    não exposto diretamente nesta API por enquanto.
    """

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "is_active": ["exact"],
        "group_sharing_consent": ["exact"],
        "created_at": ["date"],
    }
    search_fields = ["name"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    def get_queryset(self) -> QuerySet[UnifiedCustomer]:
        """Retorna clientes ativos com select_related do criador."""
        return (
            UnifiedCustomer.objects.filter(is_active=True)
            .select_related("created_by")
            .order_by("name")
        )

    def get_serializer_class(self):  # type: ignore[override]
        """Seleciona serializer conforme a ação."""
        if self.action == "create":
            return UnifiedCustomerCreateSerializer
        if self.action == "list":
            return UnifiedCustomerListSerializer
        return UnifiedCustomerDetailSerializer
