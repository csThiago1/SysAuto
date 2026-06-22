"""
Paddock Solutions — Experts Views (DEPRECATED)

Endpoint /api/v1/experts/ retorna 410 Gone — peritos agora em
/api/v1/persons/?role=EXPERT (consolidação 2026-06-22).
"""
import logging

from rest_framework import status, viewsets
from rest_framework.response import Response

logger = logging.getLogger(__name__)


class ExpertViewSet(viewsets.ViewSet):
    """Endpoint deprecated — use /api/v1/persons/?role=EXPERT."""

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
