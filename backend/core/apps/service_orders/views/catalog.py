"""
Paddock Solutions — Service Orders: ServiceCatalog + Holiday ViewSets
"""
from typing import Any

from django.core.cache import cache
from django.db.models import QuerySet
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove

from ..models import Holiday, ServiceCatalog
from ..serializers import (
    HolidaySerializer,
    ServiceCatalogListSerializer,
    ServiceCatalogSerializer,
)


class ServiceCatalogViewSet(viewsets.ModelViewSet):
    """
    CRUD do catálogo de serviços.
    Leitura: CONSULTANT+. Escrita: MANAGER+.
    DELETE faz soft delete (is_active=False).
    """

    serializer_class = ServiceCatalogSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_queryset(self) -> QuerySet:
        """Retorna catálogo ativo, com filtros opcionais de busca e categoria."""
        search = self.request.query_params.get("search", "")
        category = self.request.query_params.get("category", "")
        if not search and not category:
            cached = cache.get("service_catalog:active")
            if cached is not None:
                return cached
            qs = list(ServiceCatalog.objects.filter(is_active=True))
            cache.set("service_catalog:active", qs, timeout=300)
            return qs
        qs = ServiceCatalog.objects.filter(is_active=True)
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
        cache.delete("service_catalog:active")
        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_create(self, serializer) -> None:  # type: ignore[override]
        serializer.save()
        cache.delete("service_catalog:active")

    def perform_update(self, serializer) -> None:  # type: ignore[override]
        serializer.save()
        cache.delete("service_catalog:active")


class HolidayViewSet(viewsets.ModelViewSet):
    """
    CRUD de feriados.
    Leitura: CONSULTANT+. Escrita: MANAGER+.
    DELETE faz soft delete (is_active=False).
    """

    serializer_class = HolidaySerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_queryset(self) -> QuerySet:
        qs = Holiday.objects.filter(is_active=True).order_by("date")
        year = self.request.query_params.get("year")
        if year:
            try:
                qs = qs.filter(date__year=int(year))
            except (ValueError, TypeError):
                pass
        return qs

    def perform_destroy(self, instance: Holiday) -> None:
        instance.is_active = False
        instance.save(update_fields=["is_active"])
