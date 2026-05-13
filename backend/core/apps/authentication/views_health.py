"""Health check endpoint for load balancer / ECS readiness."""
import logging

from django.core.cache import cache
from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([AllowAny])
def healthz(request: Request) -> Response:
    """Health check — verifica DB e Redis."""
    checks: dict[str, str] = {}

    try:
        connection.ensure_connection()
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"

    try:
        cache.set("_healthz", "1", timeout=5)
        checks["redis"] = "ok" if cache.get("_healthz") == "1" else "error"
    except Exception:
        checks["redis"] = "error"

    healthy = all(v == "ok" for v in checks.values())
    return Response(checks, status=200 if healthy else 503)
