"""
Paddock Solutions — Insurers Views
Lista de seguradoras (read-only, schema público).
"""
import logging

from rest_framework import filters, mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.insurers.models import Insurer
from apps.insurers.serializers import InsurerSerializer

logger = logging.getLogger(__name__)


class InsurerViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    Lista de seguradoras cadastradas no sistema.

    Endpoint read-only — seguradoras são gerenciadas via admin ou management command.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = InsurerSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "trade_name", "abbreviation"]

    def get_queryset(self):  # type: ignore[override]
        return Insurer.objects.filter(is_active=True)
