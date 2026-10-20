"""
Paddock Solutions — Vehicle Catalog Views
"""
import logging
import re

import django_filters
import httpx
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view

from django.core.cache import cache
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.authentication.permissions import IsAdminOrAbove, PermissionsByActionMixin
from apps.vehicle_catalog.models import (
    PlateCache,
    VehicleColor,
    VehicleFamily,
    VehicleMake,
    VehicleModel,
    VehicleYearVersion,
)
from apps.vehicle_catalog.serializers import (
    VehicleColorSerializer,
    VehicleFamilySerializer,
    VehicleMakeSerializer,
    VehicleModelOptionSerializer,
    VehicleModelSerializer,
    VehicleYearOptionSerializer,
    VehicleYearVersionSerializer,
)

logger = logging.getLogger(__name__)


class VehicleColorViewSet(PermissionsByActionMixin, viewsets.ModelViewSet):
    """CRUD de cores de veículos com código hex para preview na UI.

    - list / retrieve: qualquer usuário autenticado
    - create / update / destroy: MANAGER+
    """

    read_permission = IsAuthenticated
    serializer_class = VehicleColorSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["name"]

    def get_queryset(self):  # type: ignore[override]
        return VehicleColor.objects.all()

    def list(self, request, *args, **kwargs):  # type: ignore[override]
        search = request.query_params.get("search", "")
        if not search:
            cached = cache.get("vehicle_colors:all")
            if cached is not None:
                return Response(cached)
            response = super().list(request, *args, **kwargs)
            cache.set("vehicle_colors:all", response.data, timeout=3600)
            return response
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer) -> None:  # type: ignore[override]
        serializer.save()
        cache.delete("vehicle_colors:all")

    def perform_update(self, serializer) -> None:  # type: ignore[override]
        serializer.save()
        cache.delete("vehicle_colors:all")

    def perform_destroy(self, instance) -> None:  # type: ignore[override]
        super().perform_destroy(instance)
        cache.delete("vehicle_colors:all")


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


def _parse_year(value: object) -> int | None:
    """Parse year from API response. Handles '2022', '2022/2023', '2022-2023'."""
    if not value:
        return None
    match = re.search(r"\d{4}", str(value))
    if match:
        year = int(match.group())
        if 1900 <= year <= 2100:
            return year
    return None


def _validate_chassis(value: object) -> str:
    """Validate chassis is 17 alphanumeric chars, no masking."""
    if not value:
        return ""
    raw = str(value).strip().upper()
    if re.fullmatch(r"[A-Z0-9]{17}", raw):
        return raw
    return ""


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

    # Chassi: aceita apenas 17 chars alfanuméricos sem mascaramento
    chassis = _validate_chassis(data.get("chassi"))

    # Situação do veículo: 0 = sem restrição, >0 = tem restrição (roubo, bloqueio, etc.)
    situation_code = int(data.get("codigoSituacao") or 0)
    situation_text = (data.get("situacao") or "").strip()

    return {
        "plate":           plate,
        "make":            _normalize_make(raw_make, fipe_dados),
        "model":           model_base,
        "version":         version,
        "engine":          engine,
        "year":            _parse_year(data.get("anoModelo") or data.get("ano")),
        "chassis":         chassis,
        "renavam":         data.get("renavam") or "",
        "city":            data.get("municipio") or "",
        "color":           (data.get("cor") or "").title(),
        "fuel_type":       fuel_type,
        "fipe_value":      fipe_value,
        "situation":       situation_text,
        "situation_code":  situation_code,
        "make_logo":       data.get("logo") or "",
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

    from apps.vehicles.models import Vehicle

    plate = plate.upper().strip().replace("-", "").replace(" ", "")
    if not (7 <= len(plate) <= 8):
        return Response({"detail": "Placa inválida."}, status=status.HTTP_400_BAD_REQUEST)

    # ── 0. Veículo já cadastrado no tenant ─────────────────────────────────
    existing = (
        Vehicle.objects.filter(plate=plate, is_active=True)
        .select_related("version__modelo__marca")
        .first()
    )
    if existing:
        if existing.version:
            make = existing.version.modelo.marca.nome
            model = existing.version.modelo.nome
            version_name = existing.version.descricao
        else:
            parts = existing.description.split(" ", 1)
            make = parts[0] if parts else ""
            model = parts[1] if len(parts) > 1 else ""
            version_name = ""
        logger.info("plate_lookup: veículo cadastrado para %s", plate)
        return Response({
            "plate":          existing.plate,
            "make":           make,
            "model":          model,
            "version":        version_name,
            "engine":         "",
            "year":           existing.year_manufacture,
            "chassis":        existing.chassis,
            "renavam":        existing.renavam,
            "city":           "",
            "color":          existing.color,
            "fuel_type":      "",
            "fipe_value":     None,
            "situation":      "",
            "situation_code": 0,
            "make_logo":      "",
            "source":         "db",
        })

    # ── 1. Cache de consulta de placa ──────────────────────────────────────
    cached = PlateCache.objects.filter(plate=plate).first()
    if cached:
        cache_details = (
            _normalize_plate_response(cached.plate, cached.raw_response)
            if cached.raw_response
            else {}
        )
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
            "fipe_value":     cache_details.get("fipe_value"),
            "situation":      cache_details.get("situation", ""),
            "situation_code": cache_details.get("situation_code", 0),
            "make_logo":      cache_details.get("make_logo", ""),
            "cached":         True,
            "source":         "cache",
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

    # ── 3. Salva no cache (somente se resposta tem make e model) ────────────
    normalized = _normalize_plate_response(plate, data)
    if normalized["make"] and normalized["model"]:
        PlateCache.objects.update_or_create(
            plate=plate,
            defaults={
                "make":         normalized["make"],
                "model":        normalized["model"],
                "version":      normalized["version"],
                "engine":       normalized["engine"],
                "year":         normalized["year"],
                "chassis":      normalized["chassis"],
                "renavam":      normalized["renavam"],
                "city":         normalized["city"],
                "color":        normalized["color"],
                "fuel_type":    normalized["fuel_type"],
                "raw_response": data,
            },
        )
    else:
        logger.warning(
            "plate_lookup: resposta incompleta para %s (make=%r, model=%r) — nao cacheada",
            plate,
            normalized["make"],
            normalized["model"],
        )

    normalized["cached"] = False
    normalized["source"] = "api"
    return Response(normalized)


@extend_schema_view(list=extend_schema(parameters=[OpenApiParameter("include_inactive", bool)]))
class VehicleMakeViewSet(
    PermissionsByActionMixin, mixins.UpdateModelMixin, viewsets.ReadOnlyModelViewSet
):
    """Montadoras por tipo. Leitura para todos; PATCH {is_active} e logo só ADMIN+.

    GET   /vehicle-catalog/makes/?tipo=carro&search=chev[&include_inactive=true]
    PATCH /vehicle-catalog/makes/{id}/  e  /vehicle-catalog/makes/{id}/logo/
    GET   /vehicle-catalog/makes/{id}/models/  (legado, sai na Task 18)
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

    @extend_schema(responses=VehicleModelSerializer(many=True))
    @action(detail=True, methods=["get"], url_path="models")
    def models(self, request: Request, pk: str | None = None) -> Response:
        """Legado: lista modelos de uma marca (GET /vehicle-catalog/makes/{id}/models/)."""
        make = self.get_object()
        qs = VehicleModel.objects.filter(marca=make).select_related("marca").order_by("nome")
        return Response(VehicleModelSerializer(qs, many=True).data)

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
    GET /vehicle-catalog/models/{id}/years/  (legado, sai na Task 18)
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

    @extend_schema(responses=VehicleYearVersionSerializer(many=True))
    @action(detail=True, methods=["get"], url_path="years")
    def years(self, request: Request, pk: str | None = None) -> Response:
        """Legado: anos/versões de um modelo (GET /vehicle-catalog/models/{id}/years/)."""
        model = self.get_object()
        qs = VehicleYearVersion.objects.filter(modelo=model).order_by("-ano")
        return Response(VehicleYearVersionSerializer(qs, many=True).data)


class VehicleYearViewSet(PermissionsByActionMixin, viewsets.ReadOnlyModelViewSet):
    """Anos/combustível de uma versão FIPE. GET /vehicle-catalog/years/?modelo=<id>"""

    queryset = VehicleYearVersion.objects.filter(is_active=True).order_by("-ano")
    serializer_class = VehicleYearOptionSerializer
    read_permission = IsAuthenticated
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["modelo"]
