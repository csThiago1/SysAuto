from __future__ import annotations

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.filters import SearchFilter

from .models import ItemOperationType, LaborCategory
from .serializers import ItemOperationTypeSerializer, LaborCategorySerializer


class ItemOperationTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista/detalhe dos tipos de operação (TROCA/RECUPERACAO/etc)."""

    queryset = ItemOperationType.objects.filter(is_active=True)
    serializer_class = ItemOperationTypeSerializer
    lookup_field = "code"
    filter_backends = [DjangoFilterBackend, SearchFilter]
    search_fields = ["code", "label"]


class LaborCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista/detalhe das categorias de MO (FUNILARIA/PINTURA/etc)."""

    queryset = LaborCategory.objects.filter(is_active=True)
    serializer_class = LaborCategorySerializer
    lookup_field = "code"
    filter_backends = [DjangoFilterBackend, SearchFilter]
    search_fields = ["code", "label"]
