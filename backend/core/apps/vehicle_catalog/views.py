"""
Paddock Solutions — Vehicle Catalog Views
"""
import logging

import httpx
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.authentication.permissions import IsConsultantOrAbove
from apps.vehicle_catalog.models import VehicleColor, VehicleMake, VehicleModel, VehicleYearVersion
from apps.vehicle_catalog.serializers import (
    VehicleColorSerializer,
    VehicleMakeSerializer,
    VehicleModelSerializer,
    VehicleYearVersionSerializer,
)

logger = logging.getLogger(__name__)

PLACA_FIPE_URL = "https://placa-fipe.apibrasil.com.br/placa/consulta"


class VehicleColorViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Lista de cores de veículos com código hex para preview na UI."""

    permission_classes = [IsAuthenticated]
    serializer_class = VehicleColorSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["name"]

    def get_queryset(self):  # type: ignore[override]
        return VehicleColor.objects.all()


@extend_schema(
    summary="Consulta dados do veículo pela placa",
    parameters=[OpenApiParameter("plate", location="path", description="Placa do veículo (7-8 chars)")],
    responses={
        200: {
            "type": "object",
            "properties": {
                "plate": {"type": "string"},
                "make": {"type": "string"},
                "model": {"type": "string"},
                "year": {"type": "integer"},
                "chassis": {"type": "string"},
                "renavam": {"type": "string"},
                "city": {"type": "string"},
            },
        },
        404: {"description": "Placa não encontrada"},
    },
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def plate_lookup(request: Request, plate: str) -> Response:
    """
    GET /vehicle-catalog/plate/<plate>/

    Consulta a API gratuita placa-fipe.apibrasil.com.br para obter dados do veículo.
    Não requer chave de API.
    """
    plate = plate.upper().strip()
    if not (7 <= len(plate) <= 8):
        return Response({"detail": "Placa inválida."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                PLACA_FIPE_URL,
                json={"placa": plate},
                headers={
                    "Content-Type": "application/json",
                    "Accept": "*/*",
                    "User-Agent": "Paddock-ERP/1.0",
                },
            )

        if resp.status_code >= 400:
            logger.info("plate_lookup: placa %s não encontrada (status %d)", plate, resp.status_code)
            return Response({"detail": "Placa não encontrada."}, status=status.HTTP_404_NOT_FOUND)

        data = resp.json()
        logger.info("plate_lookup: resposta para %s: %s", plate, data)

        return Response(
            {
                "plate": plate,
                "make": data.get("marca") or "",
                "model": data.get("modelo") or "",
                "year": data.get("ano"),
                "chassis": data.get("chassi") or "",
                "renavam": data.get("renavam") or "",
                "city": data.get("municipio") or "",
                # Campos não fornecidos por esta API
                "color": "",
                "fuel_type": "",
                "fipe_value": None,
            }
        )

    except httpx.TimeoutException:
        logger.warning("plate_lookup: timeout ao consultar placa %s", plate)
        return Response({"detail": "Timeout na consulta da placa."}, status=status.HTTP_504_GATEWAY_TIMEOUT)
    except httpx.ConnectError as exc:
        logger.error("plate_lookup: falha de conexão para %s: %s", plate, exc)
        return Response(
            {"detail": "Serviço de consulta de placa indisponível."},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    except Exception as exc:
        logger.exception("plate_lookup: erro inesperado para placa %s", plate, exc)
        return Response(
            {"detail": "Erro interno ao processar consulta de placa."},
            status=status.HTTP_502_BAD_GATEWAY,
        )


class VehicleMakeViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista marcas FIPE cacheadas localmente.

    GET /vehicle-catalog/makes/
    GET /vehicle-catalog/makes/{id}/models/
    """

    queryset = VehicleMake.objects.all().order_by("nome")
    serializer_class = VehicleMakeSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]
    filter_backends = [filters.SearchFilter]
    search_fields = ["nome", "nome_normalizado"]

    @action(detail=True, methods=["get"], url_path="models")
    def models(self, request: Request, pk: str | None = None) -> Response:
        """Lista modelos de uma marca específica.

        GET /vehicle-catalog/makes/{id}/models/
        """
        make = self.get_object()
        qs = (
            VehicleModel.objects.filter(marca=make)
            .select_related("marca")
            .order_by("nome")
        )
        serializer = VehicleModelSerializer(qs, many=True)
        return Response(serializer.data)


class VehicleModelViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista modelos FIPE com action de anos/versões.

    GET /vehicle-catalog/models/
    GET /vehicle-catalog/models/{id}/years/
    """

    queryset = VehicleModel.objects.all().select_related("marca").order_by("nome")
    serializer_class = VehicleModelSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]
    filter_backends = [filters.SearchFilter]
    search_fields = ["nome", "nome_normalizado", "marca__nome"]

    @action(detail=True, methods=["get"], url_path="years")
    def years(self, request: Request, pk: str | None = None) -> Response:
        """Lista anos/versões de um modelo específico.

        GET /vehicle-catalog/models/{id}/years/
        """
        model = self.get_object()
        qs = (
            VehicleYearVersion.objects.filter(modelo=model)
            .select_related("modelo")
            .order_by("-ano")
        )
        serializer = VehicleYearVersionSerializer(qs, many=True)
        return Response(serializer.data)
