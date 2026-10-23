"""
Paddock Solutions — Vehicle Catalog Views
"""

import logging

import django_filters
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view

from rest_framework import filters, mixins, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.authentication.permissions import IsAdminOrAbove, PermissionsByActionMixin
from apps.vehicle_catalog.models import VehicleFamily, VehicleMake, VehicleModel, VehicleYearVersion
from apps.vehicle_catalog.normalize import COR_HEX, CorVeiculo
from apps.vehicle_catalog.serializers import (
    VehicleFamilySerializer,
    VehicleMakeSerializer,
    VehicleModelOptionSerializer,
    VehicleYearOptionSerializer,
)

logger = logging.getLogger(__name__)


@extend_schema(
    summary="Cores do enum CorVeiculo com hex para o preview",
    responses={
        200: {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {k: {"type": "string"} for k in ("value", "label", "hex")},
            },
        }
    },
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def colors_list(request: Request) -> Response:
    """GET /vehicle-catalog/colors/ — lista fixa do enum, sem paginação."""
    return Response([{"value": c.value, "label": c.label, "hex": COR_HEX[c]} for c in CorVeiculo])


@extend_schema_view(list=extend_schema(parameters=[OpenApiParameter("include_inactive", bool)]))
class VehicleMakeViewSet(
    PermissionsByActionMixin, mixins.UpdateModelMixin, viewsets.ReadOnlyModelViewSet
):
    """Montadoras por tipo. Leitura para todos; PATCH {is_active} e logo só ADMIN+.

    GET   /vehicle-catalog/makes/?tipo=carro&search=chev[&include_inactive=true]
    PATCH /vehicle-catalog/makes/{id}/  e  /vehicle-catalog/makes/{id}/logo/
    """

    serializer_class = VehicleMakeSerializer
    read_permission = IsAuthenticated
    write_permission = IsAdminOrAbove
    write_actions = ("update", "partial_update", "logo")
    http_method_names = ["get", "patch", "head", "options"]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["tipo"]
    search_fields = ["display_name", "nome", "nome_normalizado"]

    def get_queryset(self):  # type: ignore[override]
        qs = VehicleMake.objects.order_by("display_name")
        if self.action in self.write_actions:
            return qs  # o ADMIN reativa uma montadora inativa
        include_inactive = self.request.query_params.get("include_inactive") == "true"
        if include_inactive and IsAdminOrAbove().has_permission(self.request, self):
            return qs
        return qs.filter(is_active=True)

    @action(detail=True, methods=["patch"], url_path="logo")
    def logo(self, request: Request, pk: str | None = None) -> Response:
        """PATCH /vehicle-catalog/makes/{id}/logo/ — atualiza só o logo_url.

        nome/tipo vêm da carga FIPE e não são editáveis por aqui — apenas
        o logo (URL colada manualmente) pode ser gerenciado no cadastro.
        """
        make = self.get_object()
        make.logo_url = request.data.get("logo_url", "")
        make.save(update_fields=["logo_url"])
        return Response(VehicleMakeSerializer(make).data)


class FamilyFilter(django_filters.FilterSet):
    marca = django_filters.NumberFilter(field_name="make")

    class Meta:
        model = VehicleFamily
        fields = ["marca"]


class VehicleFamilyViewSet(PermissionsByActionMixin, viewsets.ReadOnlyModelViewSet):
    """Famílias (o "Modelo" da tela). GET /vehicle-catalog/families/?marca=<id>&search="""

    queryset = VehicleFamily.objects.filter(is_active=True).order_by("nome")
    serializer_class = VehicleFamilySerializer
    read_permission = IsAuthenticated
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = FamilyFilter
    search_fields = ["nome", "nome_normalizado"]


@extend_schema_view(list=extend_schema(parameters=[OpenApiParameter("ano", int)]))
class VehicleModelViewSet(PermissionsByActionMixin, viewsets.ReadOnlyModelViewSet):
    """Versões FIPE de uma família.

    GET /vehicle-catalog/models/?familia=<id>&ano=2025&search=lt 1.0 turbo
    """

    serializer_class = VehicleModelOptionSerializer
    read_permission = IsAuthenticated
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["familia"]
    search_fields = ["nome", "nome_normalizado"]

    def get_queryset(self):  # type: ignore[override]
        qs = VehicleModel.objects.filter(is_active=True).order_by("nome")
        ano = self.request.query_params.get("ano", "")
        if ano.isdigit():
            qs = qs.filter(versoes__ano=int(ano), versoes__is_active=True).distinct()
        return qs


class VehicleYearViewSet(PermissionsByActionMixin, viewsets.ReadOnlyModelViewSet):
    """Anos/combustível de uma versão FIPE. GET /vehicle-catalog/years/?modelo=<id>"""

    queryset = VehicleYearVersion.objects.filter(is_active=True).order_by("-ano")
    serializer_class = VehicleYearOptionSerializer
    read_permission = IsAuthenticated
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["modelo"]
