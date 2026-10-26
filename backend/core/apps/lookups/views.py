"""
Paddock Solutions — Lookups Views
"""

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer

from django.db.models import QuerySet
from django.http import Http404
from rest_framework import generics, serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsConsultantOrAbove
from apps.lookups.models import Municipio
from apps.lookups.service import CHAINS, lookup
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


class LookupView(APIView):
    """POST /api/v1/lookups/<kind>/ {"key"} — sempre 200; chave ruim dá `found: false`.

    POST (e não GET com a chave no path) para a chave não cair em access log.
    """

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    @extend_schema(
        request=inline_serializer("Lookup", {"key": serializers.CharField()}),
        responses={200: OpenApiTypes.OBJECT},
    )
    def post(self, request: Request, kind: str) -> Response:
        if kind not in CHAINS:
            raise Http404
        data = request.data if isinstance(request.data, dict) else {}
        return Response(lookup(kind, str(data.get("key") or "")))
