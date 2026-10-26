"""
Paddock Solutions — Followups Views
"""

import logging
from typing import Any, Optional

from django_filters.rest_framework import DjangoFilterBackend

from django.utils import timezone
from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.authentication.permissions import PermissionsByActionMixin
from apps.followups.models import FollowUp, FollowUpRule, FollowUpStatus
from apps.followups.serializers import (
    CompleteFollowUpSerializer,
    FollowUpRuleSerializer,
    FollowUpSerializer,
    RescheduleFollowUpSerializer,
)

logger = logging.getLogger(__name__)


class FollowUpRuleViewSet(PermissionsByActionMixin, ModelViewSet):
    """CRUD das regras de retorno. Escrita MANAGER+, leitura CONSULTANT+."""

    serializer_class = FollowUpRuleSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["is_active", "trigger_event", "channel"]
    ordering_fields = ["delay_hours", "name", "created_at"]

    def get_queryset(self) -> Any:
        """Regras ativas e inativas — o cadastro precisa ver as duas."""
        return FollowUpRule.objects.all().order_by("delay_hours")

    def perform_create(self, serializer: FollowUpRuleSerializer) -> None:
        serializer.save(created_by=self.request.user)


class FollowUpViewSet(PermissionsByActionMixin, ModelViewSet):
    """
    Fila de retornos ao cliente.

    list      GET  /followups/?status=&assigned_to_me=true&due_before=
    complete  POST /followups/{id}/complete/    {outcome, notes}
    reschedule POST /followups/{id}/reschedule/ {due_at}
    skip      POST /followups/{id}/skip/        {notes}
    """

    http_method_names = ["get", "post", "patch", "head", "options"]
    serializer_class = FollowUpSerializer
    write_actions = ("complete", "reschedule", "skip")
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["status", "rule", "assigned_to", "channel"]
    ordering_fields = ["due_at", "created_at"]
    ordering = ["due_at"]

    def get_queryset(self) -> Any:
        """Retornos ativos, com filtros de conveniência da fila."""
        qs = (
            FollowUp.objects.filter(is_active=True)
            .select_related("rule", "service_order", "assigned_to")
            .order_by("due_at")
        )

        if self.request.query_params.get("assigned_to_me") == "true":
            qs = qs.filter(assigned_to=self.request.user)

        due_before = self.request.query_params.get("due_before")
        if due_before:
            qs = qs.filter(due_at__lte=due_before)

        return qs

    @action(detail=True, methods=["post"])
    def complete(self, request: Request, pk: Optional[str] = None) -> Response:
        """Registra o resultado do retorno e o encerra."""
        followup = self.get_object()
        if followup.status in (FollowUpStatus.DONE, FollowUpStatus.SKIPPED):
            return Response(
                {"detail": "Retorno já encerrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CompleteFollowUpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        followup.outcome = serializer.validated_data["outcome"]
        followup.notes = serializer.validated_data.get("notes", "")
        followup.status = FollowUpStatus.DONE
        followup.completed_at = timezone.now()
        followup.save(
            update_fields=["outcome", "notes", "status", "completed_at", "updated_at"]
        )
        return Response(FollowUpSerializer(followup).data)

    @action(detail=True, methods=["post"])
    def reschedule(self, request: Request, pk: Optional[str] = None) -> Response:
        """Adia o retorno para uma nova data, devolvendo-o à fila."""
        followup = self.get_object()
        if followup.status in (FollowUpStatus.DONE, FollowUpStatus.SKIPPED):
            return Response(
                {"detail": "Retorno já encerrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RescheduleFollowUpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        followup.due_at = serializer.validated_data["due_at"]
        followup.status = FollowUpStatus.SCHEDULED
        followup.dispatched_at = None
        followup.save(update_fields=["due_at", "status", "dispatched_at", "updated_at"])
        return Response(FollowUpSerializer(followup).data)

    @action(detail=True, methods=["post"])
    def skip(self, request: Request, pk: Optional[str] = None) -> Response:
        """Dispensa o retorno sem executá-lo."""
        followup = self.get_object()
        if followup.status in (FollowUpStatus.DONE, FollowUpStatus.SKIPPED):
            return Response(
                {"detail": "Retorno já encerrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        followup.status = FollowUpStatus.SKIPPED
        followup.notes = request.data.get("notes", "")
        followup.completed_at = timezone.now()
        followup.save(update_fields=["status", "notes", "completed_at", "updated_at"])
        return Response(FollowUpSerializer(followup).data)
