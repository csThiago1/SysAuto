"""
Paddock Solutions — Lookups Views
"""

from drf_spectacular.utils import OpenApiParameter, extend_schema

from django.db.models import QuerySet
from rest_framework import generics, serializers
from rest_framework.permissions import IsAuthenticated

from apps.lookups.models import Municipio
from apps.vehicle_catalog.normalize import normalize_name


class MunicipioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Municipio
        fields = ["codigo_ibge", "nome", "uf"]


@extend_schema(parameters=[OpenApiParameter("uf", str, description="Sigla da UF, ex.: AM.")])
class MunicipioListView(generics.ListAPIView):
    """GET /api/v1/lookups/municipios/?uf=AM&search=man — busca sem acento dentro da UF."""

    permission_classes = [IsAuthenticated]
    serializer_class = MunicipioSerializer

    def get_queryset(self) -> QuerySet[Municipio]:
        qs = Municipio.objects.all()
        uf = self.request.query_params.get("uf", "").strip().upper()
        search = normalize_name(self.request.query_params.get("search", ""))
        if uf:
            qs = qs.filter(uf=uf)
        if search:
            qs = qs.filter(nome_normalizado__contains=search)
        return qs
