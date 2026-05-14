"""
Paddock Solutions — Parts Catalog Views
CRUD do catálogo cross-tenant de peças automotivas (schema público).
"""
import logging

from django.core.cache import cache
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.authentication.permissions import IsManagerOrAbove
from apps.parts_catalog.models import PartApplication, PartCategory, PartReference
from apps.parts_catalog.serializers import (
    PartApplicationSerializer,
    PartCategorySerializer,
    PartReferenceDetailSerializer,
    PartReferenceListSerializer,
)

logger = logging.getLogger(__name__)

_CATEGORIES_CACHE_KEY = "parts_catalog:categories:active"
_CATEGORIES_CACHE_TTL = 600  # 10 min


class PartCategoryViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    Lista de categorias de peças — somente leitura, cacheada.

    GET /parts-catalog/categories/
    """

    permission_classes = [IsAuthenticated]
    serializer_class = PartCategorySerializer

    def get_queryset(self):  # type: ignore[override]
        return PartCategory.objects.filter(is_active=True)

    def list(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[override]
        cached = cache.get(_CATEGORIES_CACHE_KEY)
        if cached is not None:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        cache.set(_CATEGORIES_CACHE_KEY, response.data, timeout=_CATEGORIES_CACHE_TTL)
        return response


class PartReferenceViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """
    Catálogo de referências de peças.

    - list / retrieve: qualquer usuário autenticado
    - create / update / partial_update: MANAGER+

    GET    /parts-catalog/references/
    GET    /parts-catalog/references/{id}/
    POST   /parts-catalog/references/
    PUT    /parts-catalog/references/{id}/
    PATCH  /parts-catalog/references/{id}/
    """

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["category", "is_active", "unit"]
    search_fields = ["manufacturer_code", "description", "description_original", "ean"]
    ordering_fields = ["description", "manufacturer_code", "updated_at"]
    ordering = ["description"]

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated()]

    def get_queryset(self):  # type: ignore[override]
        if self.action == "retrieve":
            return (
                PartReference.objects.select_related("category")
                .prefetch_related("applications__make", "applications__model", "suppliers")
            )
        return PartReference.objects.select_related("category").filter(is_active=True)

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == "retrieve":
            return PartReferenceDetailSerializer
        return PartReferenceListSerializer

    def perform_create(self, serializer) -> None:  # type: ignore[override]
        serializer.save()
        logger.info(
            "PartReference criada: %s por usuário %s",
            serializer.instance.manufacturer_code,
            self.request.user,
        )

    def perform_update(self, serializer) -> None:  # type: ignore[override]
        serializer.save()
        logger.info(
            "PartReference atualizada: %s por usuário %s",
            serializer.instance.manufacturer_code,
            self.request.user,
        )


class PartApplicationViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """
    Aplicações veiculares de peças — filtrável por part_ref, make e model.

    - list:   qualquer usuário autenticado
    - create: MANAGER+

    GET  /parts-catalog/applications/
    POST /parts-catalog/applications/
    """

    permission_classes = [IsAuthenticated]
    serializer_class = PartApplicationSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["part_ref", "make", "model", "source"]
    ordering_fields = ["confidence_score", "created_at"]
    ordering = ["-confidence_score"]

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action == "create":
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated()]

    def get_queryset(self):  # type: ignore[override]
        return (
            PartApplication.objects.select_related(
                "part_ref__category",
                "make",
                "model",
            )
        )

    def create(self, request: Request, *args, **kwargs) -> Response:
        """
        Cria nova aplicação veicular.

        Retorna 409 se a combinação (part_ref, make, model, source) já existir,
        evitando erro 500 por IntegrityError no UniqueConstraint.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        part_ref = serializer.validated_data["part_ref"]
        make = serializer.validated_data["make"]
        model = serializer.validated_data.get("model")
        source = serializer.validated_data.get("source", PartApplication.Source.MANUAL)

        if PartApplication.objects.filter(
            part_ref=part_ref, make=make, model=model, source=source
        ).exists():
            return Response(
                {"detail": "Aplicação já cadastrada para esta combinação peça/marca/modelo/origem."},
                status=status.HTTP_409_CONFLICT,
            )

        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer) -> None:  # type: ignore[override]
        serializer.save()
        logger.info(
            "PartApplication criada: %s → make=%s por usuário %s",
            serializer.instance.part_ref.manufacturer_code,
            serializer.instance.make.nome,
            self.request.user,
        )
