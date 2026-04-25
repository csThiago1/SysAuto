"""
Paddock Solutions — Vehicle Catalog Views
"""
import logging
import re

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


# ── Normalização de montadora ─────────────────────────────────────────────────

# Abreviações conhecidas usadas pela API → nome completo
_MAKE_ALIASES: dict[str, str] = {
    "CHEV":       "Chevrolet",
    "GM":         "Chevrolet",
    "VW":         "Volkswagen",
    "VOLKS":      "Volkswagen",
    "MB":         "Mercedes-Benz",
    "MERC":       "Mercedes-Benz",
    "MERCEDES":   "Mercedes-Benz",
    "BMW":        "BMW",
    "RENA":       "Renault",
    "RENAULT":    "Renault",
    "PEUG":       "Peugeot",
    "PEUGEOT":    "Peugeot",
    "CITR":       "Citroën",
    "CITRO":      "Citroën",
    "FORD":       "Ford",
    "FIAT":       "Fiat",
    "HONDA":      "Honda",
    "TOYOTA":     "Toyota",
    "HYUNDAI":    "Hyundai",
    "KIA":        "Kia",
    "NISSAN":     "Nissan",
    "MITSU":      "Mitsubishi",
    "MITSUBISHI": "Mitsubishi",
    "JEEP":       "Jeep",
    "DODGE":      "Dodge",
    "AUDI":       "Audi",
    "VOLVO":      "Volvo",
    "JAC":        "JAC",
    "CAOA":       "CAOA Chery",
    "CHERY":      "Chery",
    "GWM":        "GWM",
    "BYD":        "BYD",
    "SUBARU":     "Subaru",
    "LAND":       "Land Rover",
    "LANDROVER":  "Land Rover",
}

# Palavras técnicas de suffixo a ignorar ao detectar versão
_ENGINE_RE = re.compile(r"\b(\d+[.,]\d+)\s*(T\b|TURBO\b)?", re.IGNORECASE)


def _smart_cap(word: str) -> str:
    """Capitalização inteligente: preserva códigos curtos (HB20, LT1, EXL, HR-V)."""
    core = word.replace("-", "")  # ignora hífen ao checar tamanho/dígitos
    if any(c.isdigit() for c in core) and len(core) <= 5:
        return word.upper()   # HB20, LT1, GLA-45
    if core.isupper() and len(core) <= 3:
        return word.upper()   # EXL, GTS, GT, HR-V (core "HRV" = 3 chars)
    return word.capitalize()


def _parse_modelo(raw: str) -> tuple[str, str, str]:
    """
    Extrai (modelo_base, versao, motorizacao) do campo MODELO da API.

    Exemplos:
      "ONIX LT1 1.0 T 12V FLEX" → ("Onix", "LT1", "1.0T")
      "CIVIC EXL 2.0 FLEX"      → ("Civic", "EXL", "2.0")
      "HB20 S 1.6 PREMIUM FLEX" → ("HB20 S", "Premium", "1.6")
      "CELTA 1.0 MPFI 8V FLEX"  → ("Celta", "", "1.0")
    """
    text = raw.strip()
    if not text:
        return "", "", ""

    # 1. Encontra motorização (ex: "1.0 T", "2.0", "1.6")
    m = _ENGINE_RE.search(text)
    if m:
        displacement = m.group(1).replace(",", ".")
        turbo = "T" if m.group(2) else ""
        engine = displacement + turbo
        before_engine = text[: m.start()].strip()
    else:
        engine = ""
        before_engine = text

    # 2. Separa palavras antes da motorização
    parts = before_engine.split()
    if not parts:
        return _smart_cap(text), "", engine

    # 3. Modelo base: primeira palavra + opcional sufixo de 1 letra (HB20 S)
    model_parts = [parts[0]]
    i = 1
    if i < len(parts) and len(parts[i]) == 1 and parts[i].isalpha():
        model_parts.append(parts[i])
        i += 1

    model_base = " ".join(_smart_cap(p) for p in model_parts)
    version_parts = parts[i:]
    version = " ".join(_smart_cap(p) for p in version_parts)

    return model_base, version, engine


def _normalize_make(raw: str, fipe_dados: list) -> str:  # type: ignore[type-arg]
    """
    Resolve o nome completo da montadora.
    Prioridade:
      1. FIPE texto_marca — ex: "GM - Chevrolet" → "Chevrolet"
      2. Mapa de abreviações sobre o raw da API
      3. Raw capitalizado como fallback
    """
    # 1. FIPE
    if fipe_dados:
        texto_marca = fipe_dados[0].get("texto_marca", "")
        if texto_marca:
            parts = [p.strip() for p in texto_marca.split("-")]
            candidate = parts[-1].strip().title() if len(parts) > 1 else parts[0].strip().title()
            if candidate:
                return candidate

    # 2. Mapa de abreviações
    key = raw.upper().strip()
    if key in _MAKE_ALIASES:
        return _MAKE_ALIASES[key]

    # 3. Fallback capitalizado
    return raw.strip().title()


def _normalize_plate_response(plate: str, data: dict) -> dict:  # type: ignore[type-arg]
    """Normaliza a resposta da wdapi2.com.br para o formato interno."""
    fipe_dados = data.get("fipe", {}).get("dados", [])
    fipe_value = None
    if fipe_dados:
        texto = fipe_dados[0].get("texto_valor", "")
        try:
            fipe_value = float(
                texto.replace("R$", "").replace(".", "").replace(",", ".").strip()
            )
        except (ValueError, AttributeError):
            pass

    extra = data.get("extra", {})
    fuel_type = extra.get("combustivel", "") if isinstance(extra, dict) else ""

    raw_make  = data.get("MARCA") or data.get("marca") or ""
    raw_model = data.get("MODELO") or data.get("modelo") or ""

    # API retorna VERSAO e SUBMODELO separados — usar diretamente quando disponíveis
    api_versao    = (data.get("VERSAO") or "").strip()
    api_submodelo = (data.get("SUBMODELO") or "").strip()

    if api_submodelo and api_versao:
        # Caso ideal: API já separou modelo e versão
        model_base = _smart_cap(api_submodelo) if " " not in api_submodelo else " ".join(_smart_cap(w) for w in api_submodelo.split())
        version = api_versao.title()
        # Extrai motorização via regex no MODELO completo como fallback
        m = _ENGINE_RE.search(raw_model)
        if m:
            displacement = m.group(1).replace(",", ".")
            engine = displacement + ("T" if m.group(2) else "")
        else:
            engine = ""
    else:
        # Fallback: parsear do campo MODELO concatenado
        model_base, version, engine = _parse_modelo(raw_model)

    # Chassi vem mascarado da API (ex: *****04197) — armazenar vazio para não enganar
    raw_chassis = data.get("chassi") or ""
    chassis = raw_chassis if raw_chassis and "*" not in raw_chassis else ""

    # Situação do veículo: 0 = sem restrição, >0 = tem restrição (roubo, bloqueio, etc.)
    situation_code = int(data.get("codigoSituacao") or 0)
    situation_text = (data.get("situacao") or "").strip()

    return {
        "plate":           plate,
        "make":            _normalize_make(raw_make, fipe_dados),
        "model":           model_base,
        "version":         version,
        "engine":          engine,
        "year":            data.get("anoModelo") or data.get("ano"),
        "chassis":         chassis,
        "renavam":         data.get("renavam") or "",
        "city":            data.get("municipio") or "",
        "color":           (data.get("cor") or "").title(),
        "fuel_type":       fuel_type,
        "fipe_value":      fipe_value,
        "situation":       situation_text,
        "situation_code":  situation_code,
    }


@extend_schema(
    summary="Consulta dados do veículo pela placa",
    parameters=[OpenApiParameter("plate", location="path", description="Placa do veículo (7-8 chars)")],
    responses={
        200: {
            "type": "object",
            "properties": {
                "plate":   {"type": "string"},
                "make":    {"type": "string"},
                "model":   {"type": "string"},
                "version": {"type": "string"},
                "engine":  {"type": "string"},
                "year":    {"type": "integer"},
                "chassis": {"type": "string"},
                "renavam": {"type": "string"},
                "city":    {"type": "string"},
                "color":   {"type": "string"},
                "fuel_type": {"type": "string"},
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
            "plate":          cached.plate,
            "make":           cached.make,
            "model":          cached.model,
            "version":        cached.version,
            "engine":         cached.engine,
            "year":           cached.year,
            "chassis":        cached.chassis,
            "renavam":        cached.renavam,
            "city":           cached.city,
            "color":          cached.color,
            "fuel_type":      cached.fuel_type,
            "fipe_value":     None,
            "situation":      "",
            "situation_code": 0,
            "cached":         True,
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
            "version":      normalized["version"],
            "engine":       normalized["engine"],
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
