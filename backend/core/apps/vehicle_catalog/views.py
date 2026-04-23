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
from apps.vehicle_catalog.models import PlateCache, VehicleColor, VehicleMake, VehicleModel, VehicleYearVersion
from apps.vehicle_catalog.serializers import (
    VehicleColorSerializer,
    VehicleMakeSerializer,
    VehicleModelSerializer,
    VehicleYearVersionSerializer,
)

logger = logging.getLogger(__name__)


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
def _normalize_plate_response(plate: str, data: dict) -> dict:  # type: ignore[type-arg]
    """Normaliza a resposta da wdapi2.com.br para o formato interno."""
    fipe_dados = data.get("fipe", {}).get("dados", [])
    fipe_value = None
    if fipe_dados:
        texto = fipe_dados[0].get("texto_valor", "")
        # "R$ 28.799,00" → 28799.00
        try:
            fipe_value = float(
                texto.replace("R$", "").replace(".", "").replace(",", ".").strip()
            )
        except (ValueError, AttributeError):
            pass

    extra = data.get("extra", {})
    fuel_type = extra.get("combustivel", "") if isinstance(extra, dict) else ""

    return {
        "plate":      plate,
        "make":       data.get("MARCA") or data.get("marca") or "",
        "model":      data.get("MODELO") or data.get("modelo") or "",
        "year":       data.get("anoModelo") or data.get("ano"),
        "chassis":    data.get("chassi") or "",
        "renavam":    data.get("renavam") or "",
        "city":       data.get("municipio") or "",
        "color":      data.get("cor") or "",
        "fuel_type":  fuel_type,
        "fipe_value": fipe_value,
        "situation":  data.get("situacao") or "",
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def plate_lookup(request: Request, plate: str) -> Response:
    """
    GET /vehicle-catalog/plate/<plate>/

    1. Checa PlateCache — se existir, retorna sem consumir crédito da API.
    2. Consulta wdapi2.com.br com o token configurado em APIPLACAS_TOKEN.
    3. Salva resultado no PlateCache para consultas futuras.
    """
    from django.conf import settings

    plate = plate.upper().strip()
    if not (7 <= len(plate) <= 8):
        return Response({"detail": "Placa inválida."}, status=status.HTTP_400_BAD_REQUEST)

    # ── 1. Cache local ────────────────────────────────────────────────────────
    cached = PlateCache.objects.filter(plate=plate).first()
    if cached:
        logger.info("plate_lookup: cache hit para %s", plate)
        return Response({
            "plate":      cached.plate,
            "make":       cached.make,
            "model":      cached.model,
            "year":       cached.year,
            "chassis":    cached.chassis,
            "renavam":    cached.renavam,
            "city":       cached.city,
            "color":      cached.color,
            "fuel_type":  cached.fuel_type,
            "fipe_value": None,
            "situation":  "",
            "cached":     True,
        })

    # ── 2. Consulta API externa ───────────────────────────────────────────────
    token = settings.APIPLACAS_TOKEN
    if not token:
        logger.error("plate_lookup: APIPLACAS_TOKEN não configurado")
        return Response(
            {"detail": "Serviço de consulta de placa não configurado."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    url = f"{settings.APIPLACAS_URL}/{plate}/{token}"
    try:
        with httpx.Client(timeout=settings.APIPLACAS_TIMEOUT) as client:
            resp = client.get(url, headers={"Accept": "application/json"})

        if resp.status_code == 406:
            return Response({"detail": "Placa não encontrada."}, status=status.HTTP_404_NOT_FOUND)
        if resp.status_code == 429:
            logger.warning("plate_lookup: limite de consultas atingido")
            return Response({"detail": "Limite de consultas atingido."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        if resp.status_code >= 400:
            logger.info("plate_lookup: placa %s status %d", plate, resp.status_code)
            return Response({"detail": "Placa não encontrada."}, status=status.HTTP_404_NOT_FOUND)

        data = resp.json()
        logger.info("plate_lookup: API retornou dados para %s", plate)

    except httpx.TimeoutException:
        logger.warning("plate_lookup: timeout para %s", plate)
        return Response({"detail": "Timeout na consulta da placa."}, status=status.HTTP_504_GATEWAY_TIMEOUT)
    except httpx.ConnectError as exc:
        logger.error("plate_lookup: falha de conexão para %s: %s", plate, exc)
        return Response({"detail": "Serviço de placa indisponível."}, status=status.HTTP_502_BAD_GATEWAY)
    except Exception as exc:
        logger.exception("plate_lookup: erro inesperado para %s", plate)
        return Response({"detail": "Erro interno."}, status=status.HTTP_502_BAD_GATEWAY)

    # ── 3. Salva no cache ─────────────────────────────────────────────────────
    normalized = _normalize_plate_response(plate, data)
    PlateCache.objects.update_or_create(
        plate=plate,
        defaults={
            "make":         normalized["make"],
            "model":        normalized["model"],
            "year":         int(normalized["year"]) if normalized["year"] else None,
            "chassis":      normalized["chassis"],
            "renavam":      normalized["renavam"],
            "city":         normalized["city"],
            "color":        normalized["color"],
            "fuel_type":    normalized["fuel_type"],
            "raw_response": data,
        },
    )

    normalized["cached"] = False
    return Response(normalized)


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
