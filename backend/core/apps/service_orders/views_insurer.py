from __future__ import annotations

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import serializers, viewsets
from rest_framework.filters import SearchFilter

from .models import Insurer


class InsurerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Insurer
        fields = ["id", "code", "name", "cnpj", "import_source", "is_active"]


class InsurerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Insurer.objects.filter(is_active=True)
    serializer_class = InsurerSerializer
    lookup_field = "code"
    filter_backends = [DjangoFilterBackend, SearchFilter]
    search_fields = ["code", "name"]
