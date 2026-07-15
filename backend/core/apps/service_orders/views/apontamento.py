"""Apontamento de Horas — ViewSet."""
from __future__ import annotations

import logging
from decimal import Decimal

from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from apps.authentication.permissions import IsConsultantOrAbove
from apps.service_orders.models.capacity import ApontamentoHoras
from apps.service_orders.offline import find_by_client_uuid
from apps.service_orders.serializers.apontamento import (
    ApontamentoCreateSerializer,
    ApontamentoGlobalSerializer,
    ApontamentoSerializer,
)

logger = logging.getLogger(__name__)


class ApontamentoGlobalListView(APIView):
    """
    GET /service-orders/apontamentos/ — lista global de apontamentos (cross-OS).

    Filtros: ?tecnico=<uuid>  ?status=iniciado|encerrado|validado  ?hoje=1
    Usada pela tela mobile de apontamento (reidratar timer aberto + lista "Hoje").
    """

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    @extend_schema(
        summary="Lista global de apontamentos",
        parameters=[
            OpenApiParameter("tecnico", description="UUID do técnico", required=False),
            OpenApiParameter(
                "status", description="iniciado | encerrado | validado", required=False
            ),
            OpenApiParameter("hoje", description="1 = apenas de hoje", required=False),
        ],
        responses=ApontamentoGlobalSerializer(many=True),
    )
    def get(self, request: Request) -> Response:
        qs = (
            ApontamentoHoras.objects.filter(is_active=True)
            .select_related("tecnico", "service_order")
            .order_by("-iniciado_em")
        )
        tecnico = request.query_params.get("tecnico")
        if tecnico:
            qs = qs.filter(tecnico_id=tecnico)
        status_param = request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        if request.query_params.get("hoje"):
            hoje = timezone.localdate()
            qs = qs.filter(iniciado_em__date=hoje)
        return Response(ApontamentoGlobalSerializer(qs[:100], many=True).data)


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
        already_synced = find_by_client_uuid(ApontamentoHoras, request)
        if already_synced:
            return Response(ApontamentoSerializer(already_synced).data)
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
            client_uuid=request.data.get("client_uuid") or None,
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
