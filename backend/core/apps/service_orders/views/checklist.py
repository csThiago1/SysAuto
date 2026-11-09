"""
Checklist de entrada 3D — danos e pertences (aninhados na OS).

GET/POST /service-orders/{os}/checklist-damages/            · PATCH …/{id}/ · POST …/{id}/deactivate/
GET/POST /service-orders/{os}/belongings/                   · PATCH …/{id}/ · POST …/{id}/return/
Sem DELETE: desativar é soft delete.
"""

from __future__ import annotations

import logging

from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.authentication.permissions import HasTenantPermission

from ..models import ChecklistDamage, CustomerBelonging, ServiceOrder
from ..serializers.checklist import ChecklistDamageSerializer, CustomerBelongingSerializer
from ..services import checklist_service as svc

logger = logging.getLogger(__name__)


class _ChecklistChildViewSet(GenericViewSet):
    """Base: escopo pela OS da URL, leitura os.view, escrita os.edit."""

    def get_permissions(self) -> list:  # type: ignore[override]
        code = "os.view" if self.action == "list" else "os.edit"
        return [IsAuthenticated(), HasTenantPermission(code)]

    def get_order(self) -> ServiceOrder:
        return get_object_or_404(ServiceOrder, pk=self.kwargs["service_order_pk"])

    def _respond(self, instance: object, created: bool = False) -> Response:
        code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(self.get_serializer(instance).data, status=code)

    def list(self, request: Request, **kwargs: object) -> Response:
        return Response(self.get_serializer(self.get_queryset(), many=True).data)


class ChecklistDamageViewSet(_ChecklistChildViewSet):
    serializer_class = ChecklistDamageSerializer

    def get_queryset(self) -> QuerySet[ChecklistDamage]:  # type: ignore[override]
        return (
            ChecklistDamage.objects.filter(
                service_order_id=self.kwargs["service_order_pk"], is_active=True
            )
            .prefetch_related("photos")
            .order_by("number")
        )

    def create(self, request: Request, **kwargs: object) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        damage, created = svc.create_damage(
            self.get_order(), serializer.validated_data, request.user
        )
        return self._respond(damage, created)

    def partial_update(self, request: Request, **kwargs: object) -> Response:
        damage = self.get_object()
        serializer = self.get_serializer(damage, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return self._respond(svc.update_damage(damage, serializer.validated_data))

    @action(detail=True, methods=["post"])
    def deactivate(self, request: Request, **kwargs: object) -> Response:
        damage = self.get_object()
        svc.assert_editable(damage.service_order)
        damage.soft_delete()
        return self._respond(damage)


class CustomerBelongingViewSet(_ChecklistChildViewSet):
    serializer_class = CustomerBelongingSerializer

    def get_queryset(self) -> QuerySet[CustomerBelonging]:  # type: ignore[override]
        return (
            CustomerBelonging.objects.filter(
                service_order_id=self.kwargs["service_order_pk"], is_active=True
            )
            .select_related("photo")
            .order_by("created_at")
        )

    def create(self, request: Request, **kwargs: object) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        belonging, created = svc.create_belonging(
            self.get_order(), serializer.validated_data, request.user
        )
        return self._respond(belonging, created)

    def partial_update(self, request: Request, **kwargs: object) -> Response:
        belonging = self.get_object()
        serializer = self.get_serializer(belonging, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return self._respond(svc.update_belonging(belonging, serializer.validated_data))

    @action(detail=True, methods=["post"], url_path="return", url_name="return")
    def return_(self, request: Request, **kwargs: object) -> Response:
        return self._respond(svc.return_belonging(self.get_object(), request.user))
