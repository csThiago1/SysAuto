"""
Paddock Solutions — Experts Views (DEPRECATED)

Endpoint /api/v1/experts/ retorna 410 Gone — peritos agora em
/api/v1/persons/?role=EXPERT (consolidação 2026-06-22).
"""
import logging

from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import serializers, status, viewsets
from rest_framework.response import Response

logger = logging.getLogger(__name__)


class _GoneSerializer(serializers.Serializer):
    """410 Gone — endpoint deprecated."""

    detail = serializers.CharField()


@extend_schema_view(
    list=extend_schema(responses={410: _GoneSerializer}, deprecated=True),
    retrieve=extend_schema(responses={410: _GoneSerializer}, deprecated=True),
    create=extend_schema(responses={410: _GoneSerializer}, deprecated=True),
    update=extend_schema(responses={410: _GoneSerializer}, deprecated=True),
    partial_update=extend_schema(responses={410: _GoneSerializer}, deprecated=True),
    destroy=extend_schema(responses={410: _GoneSerializer}, deprecated=True),
)
class ExpertViewSet(viewsets.ViewSet):
    """Endpoint deprecated — use /api/v1/persons/?role=EXPERT."""

    serializer_class = _GoneSerializer  # pra drf-spectacular parar de avisar
    authentication_classes: list = []
    permission_classes: list = []

    def list(self, request):
        return self._gone()

    def retrieve(self, request, pk=None):
        return self._gone()

    def create(self, request):
        return self._gone()

    def update(self, request, pk=None):
        return self._gone()

    def partial_update(self, request, pk=None):
        return self._gone()

    def destroy(self, request, pk=None):
        return self._gone()

    @staticmethod
    def _gone():
        return Response(
            {"detail": "Endpoint movido. Use /api/v1/persons/?role=EXPERT"},
            status=status.HTTP_410_GONE,
            headers={"Link": "</api/v1/persons/?role=EXPERT>; rel=successor-version"},
        )
