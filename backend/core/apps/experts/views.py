"""
Paddock Solutions — Experts Views
"""
import logging

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.experts.models import Expert
from apps.experts.serializers import ExpertCreateUpdateSerializer, ExpertSerializer

logger = logging.getLogger(__name__)


class ExpertViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Peritos.

    Não expõe destroy — soft delete via is_active.
    Filtro por seguradora: ?insurers=<uuid>
    """

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = {"insurers": ["exact"], "is_active": ["exact"]}
    search_fields = ["name", "registration_number"]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):  # type: ignore[override]
        return (
            Expert.objects.filter(is_active=True)
            .prefetch_related("insurers")
            .select_related("created_by")
        )

    def get_serializer_class(self):  # type: ignore[override]
        if self.action in ["create", "partial_update", "update"]:
            return ExpertCreateUpdateSerializer
        return ExpertSerializer

    def perform_create(self, serializer: ExpertCreateUpdateSerializer) -> None:
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer: ExpertCreateUpdateSerializer) -> None:
        logger.info(
            "Atualizando Perito id=%s por user_id=%s",
            self.get_object().id,
            self.request.user.id,
        )
        serializer.save()
