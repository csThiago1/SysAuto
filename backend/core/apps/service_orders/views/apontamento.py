"""Apontamento de Horas — ViewSet."""
from __future__ import annotations

import logging
from decimal import Decimal

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.authentication.permissions import IsConsultantOrAbove
from apps.service_orders.models.capacity import ApontamentoHoras
from apps.service_orders.serializers.apontamento import (
    ApontamentoCreateSerializer,
    ApontamentoSerializer,
)

logger = logging.getLogger(__name__)


class ApontamentoViewSet(GenericViewSet):
    """
    GET  /service-orders/{os_id}/apontamentos/              — lista
    POST /service-orders/{os_id}/apontamentos/              — cria (timer ou manual)
    POST /service-orders/{os_id}/apontamentos/{id}/encerrar/ — encerra timer
    """

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]
    serializer_class = ApontamentoSerializer

    def get_queryset(self):  # type: ignore[override]
        os_id = self.kwargs.get("service_order_pk")
        return (
            ApontamentoHoras.objects.filter(service_order_id=os_id, is_active=True)
            .select_related("tecnico")
            .order_by("-iniciado_em")
        )

    def list(self, request: Request, **kwargs: object) -> Response:
        """Lista apontamentos da OS."""
        qs = self.get_queryset()
        return Response(ApontamentoSerializer(qs, many=True).data)

    def create(self, request: Request, **kwargs: object) -> Response:
        """Cria apontamento — timer (so tecnico_id) ou manual (com horarios)."""
        os_id = self.kwargs["service_order_pk"]
        serializer = ApontamentoCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        tecnico_id = data["tecnico_id"]
        iniciado_em = data.get("iniciado_em")
        encerrado_em = data.get("encerrado_em")
        observacao = data.get("observacao", "")

        # Modo timer: verifica se ja tem timer aberto
        if not iniciado_em and not encerrado_em:
            existing = ApontamentoHoras.objects.filter(
                service_order_id=os_id,
                tecnico_id=tecnico_id,
                status="iniciado",
                is_active=True,
            ).exists()
            if existing:
                return Response(
                    {"detail": "Tecnico ja possui timer aberto nesta OS."},
                    status=status.HTTP_409_CONFLICT,
                )

        horas = Decimal("0")
        apto_status = "iniciado"
        now = timezone.now()

        if iniciado_em and encerrado_em:
            diff = encerrado_em - iniciado_em
            horas = Decimal(str(round(diff.total_seconds() / 3600, 2)))
            apto_status = "encerrado"
        elif not iniciado_em:
            iniciado_em = now

        apontamento = ApontamentoHoras.objects.create(
            service_order_id=os_id,
            tecnico_id=tecnico_id,
            iniciado_em=iniciado_em,
            encerrado_em=encerrado_em,
            horas_apontadas=horas,
            observacao=observacao,
            status=apto_status,
        )

        return Response(
            ApontamentoSerializer(apontamento).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="encerrar")
    def encerrar(self, request: Request, **kwargs: object) -> Response:
        """Encerra um timer aberto."""
        apontamento = self.get_object()

        if apontamento.status != "iniciado":
            return Response(
                {"detail": "Apontamento ja encerrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        diff = now - apontamento.iniciado_em
        horas = Decimal(str(round(diff.total_seconds() / 3600, 2)))

        apontamento.encerrado_em = now
        apontamento.horas_apontadas = horas
        apontamento.status = "encerrado"
        apontamento.save(update_fields=["encerrado_em", "horas_apontadas", "status", "updated_at"])

        return Response(ApontamentoSerializer(apontamento).data)
