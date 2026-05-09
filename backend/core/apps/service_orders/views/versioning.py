"""
Paddock Solutions — Service Orders: Versioning ViewSets
ServiceOrderVersionViewSet, ServiceOrderEventViewSet, ServiceOrderParecerViewSet
"""
from typing import Optional

from django.db.models import QuerySet
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove
from ..services import ServiceOrderService


class ServiceOrderVersionViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista/detalhe de versões de OS + action approve."""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_serializer_class(self) -> type:
        from ..serializers import ServiceOrderVersionSerializer
        return ServiceOrderVersionSerializer

    def get_queryset(self) -> "QuerySet":
        from ..models import ServiceOrderVersion
        return (
            ServiceOrderVersion.objects
            .filter(service_order__is_active=True)
            .select_related("service_order", "import_attempt")
            .prefetch_related("items")
        )

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action == "approve":
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    @action(detail=True, methods=["post"])
    def approve(self, request: Request, pk: Optional[str] = None) -> Response:
        """POST /service-orders/versions/{id}/approve/"""
        from ..serializers import ServiceOrderVersionSerializer
        version = self.get_object()
        actor = request.user.email if hasattr(request.user, "email") else "Usuário"
        updated = ServiceOrderService.approve_version(version=version, approved_by=actor)
        return Response(ServiceOrderVersionSerializer(updated).data)


class ServiceOrderEventViewSet(viewsets.ReadOnlyModelViewSet):
    """Timeline de eventos de OS (somente leitura)."""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_serializer_class(self) -> type:
        from ..serializers import ServiceOrderEventSerializer
        return ServiceOrderEventSerializer

    def get_queryset(self) -> "QuerySet":
        from ..models import ServiceOrderEvent
        return ServiceOrderEvent.objects.filter(
            service_order__is_active=True,
        ).select_related("service_order")


class ServiceOrderParecerViewSet(viewsets.ModelViewSet):
    """CRUD de pareceres (internos). Pareceres importados são read-only."""

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self) -> type:
        from ..serializers import ServiceOrderParecerSerializer
        return ServiceOrderParecerSerializer

    def get_queryset(self) -> "QuerySet":
        from ..models import ServiceOrderParecer
        return ServiceOrderParecer.objects.filter(
            service_order__is_active=True,
        ).select_related("service_order", "version")

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("destroy",):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def _assert_internal(self, instance: "ServiceOrderParecer") -> None:
        """Garante que apenas pareceres internos podem ser modificados."""
        if instance.source != "internal":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Pareceres importados são somente leitura.")

    def perform_update(self, serializer: "BaseSerializer") -> None:  # type: ignore[override]
        self._assert_internal(serializer.instance)
        super().perform_update(serializer)

    def perform_destroy(self, instance: "ServiceOrderParecer") -> None:  # type: ignore[override]
        self._assert_internal(instance)
        super().perform_destroy(instance)
