"""Health check endpoint for load balancer / ECS readiness."""
import logging

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

logger = logging.getLogger(__name__)


class _HealthzResponseSerializer(serializers.Serializer):
    """Retorno de /healthz — mapa serviço → status."""

    database = serializers.CharField()
    cache = serializers.CharField()
    placas_api = serializers.CharField(required=False)
    email = serializers.CharField(required=False)


@extend_schema(responses={200: _HealthzResponseSerializer})
@api_view(["GET"])
@permission_classes([AllowAny])
def healthz(request: Request) -> Response:
    """Health check — verifica DB, Redis, API Placas e Email."""
    checks: dict[str, str] = {}

    # Database
    try:
        connection.ensure_connection()
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {type(e).__name__}"

    # Redis / Cache
    try:
        cache.set("_healthz", "1", timeout=5)
        checks["cache"] = "ok" if cache.get("_healthz") == "1" else "error"
    except Exception:
        checks["cache"] = "error"

    # API Placas
    checks["api_placas"] = (
        "configured"
        if getattr(settings, "APIPLACAS_TOKEN", "")
        else "not_configured"
    )

    # Email (Resend)
    checks["email"] = (
        "configured"
        if getattr(settings, "RESEND_API_KEY", "")
        else "not_configured"
    )

    all_ok = all(v in ("ok", "configured") for v in checks.values())
    return Response(
        {"status": "healthy" if all_ok else "degraded", "checks": checks},
        status=200 if all_ok else 503,
    )
