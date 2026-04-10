"""
Paddock Solutions — Vehicle Catalog Views
"""
import logging

import httpx
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.vehicle_catalog.models import VehicleColor
from apps.vehicle_catalog.serializers import VehicleColorSerializer

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
        with httpx.Client(timeout=10.0, verify=False) as client:
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
            {"detail": f"Falha de conexão com a API de placa: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    except Exception as exc:
        logger.exception("plate_lookup: erro inesperado para placa %s: %s", plate, exc)
        return Response(
            {"detail": f"Erro ao consultar placa: {type(exc).__name__}: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )
