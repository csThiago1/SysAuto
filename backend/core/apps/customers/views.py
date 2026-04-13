"""
Paddock Solutions — Customers Views
Somente-leitura: clientes são gerenciados via processo de consentimento LGPD.
"""
import hashlib
import logging

from django.db.models import Q, QuerySet
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.authentication.permissions import IsConsultantOrAbove

from .models import UnifiedCustomer
from .serializers import (
    UnifiedCustomerCreateSerializer,
    UnifiedCustomerDetailSerializer,
    UnifiedCustomerListSerializer,
    UnifiedCustomerUpdateSerializer,
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
    partial_update=extend_schema(
        summary="Atualizar cliente (parcial)",
        description=(
            "Atualiza campos do cliente via PATCH. "
            "CPF não é editável. "
            "phone é normalizado para apenas dígitos antes de salvar."
        ),
    ),
)
class UnifiedCustomerViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    ViewSet para clientes unificados.

    Suporta criação, consulta, listagem e atualização parcial (PATCH).
    PUT não está disponível — usar PATCH para atualizações.
    """

    http_method_names = ["get", "post", "patch", "head", "options"]
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]
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
        if self.action == "partial_update":
            return UnifiedCustomerUpdateSerializer
        return UnifiedCustomerDetailSerializer

    def create(self, request, *args, **kwargs):  # type: ignore[override]
        """
        Cria o cliente usando UnifiedCustomerCreateSerializer para validação,
        mas retorna UnifiedCustomerListSerializer (inclui id, cpf_masked, phone_masked).
        """
        serializer = UnifiedCustomerCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        response_data = UnifiedCustomerListSerializer(instance).data
        return Response(response_data, status=status.HTTP_201_CREATED)

    def partial_update(self, request: Request, *args: object, **kwargs: object) -> Response:
        """
        PATCH /customers/{id}/
        Atualiza parcialmente o cliente e retorna o detalhe atualizado.
        """
        instance = self.get_object()
        serializer = UnifiedCustomerUpdateSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(UnifiedCustomerDetailSerializer(instance).data)

    @extend_schema(
        summary="Buscar clientes por nome, CPF ou telefone",
        parameters=[OpenApiParameter("q", description="Termo de busca (mín. 3 chars)", required=True)],
    )
    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request: Request) -> Response:
        """
        GET /customers/search/?q=<termo>

        Busca por nome (icontains) e por hash de CPF/telefone (apenas dígitos).
        Retorna até 20 resultados no formato { count, results }.
        """
        q = request.query_params.get("q", "").strip()
        if len(q) < 3:
            return Response({"count": 0, "results": []})

        # Hash do termo normalizado para CPF/telefone
        digits = "".join(filter(str.isdigit, q))
        digits_hash = hashlib.sha256(digits.encode()).hexdigest() if digits else None

        lookup = Q(name__icontains=q)
        if digits_hash:
            lookup |= Q(cpf_hash=digits_hash) | Q(phone_hash=digits_hash)

        qs = (
            UnifiedCustomer.objects.filter(is_active=True)
            .filter(lookup)
            .order_by("name")[:20]
        )
        serializer = UnifiedCustomerListSerializer(qs, many=True)
        logger.debug("Customer search q=%r → %d resultado(s)", q, len(serializer.data))
        return Response({"count": len(serializer.data), "results": serializer.data})
