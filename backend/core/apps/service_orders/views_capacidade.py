"""
Paddock Solutions — Service Orders — Views de Capacidade
MO-9: Endpoints de capacidade técnica e bloqueios.
"""
import logging
from datetime import date, timedelta

from django.db import transaction
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from apps.authentication.permissions import IsManagerOrAbove

from apps.service_orders.models import BloqueioCapacidade, CapacidadeTecnico
from apps.service_orders.services_capacidade import CapacidadeService

logger = logging.getLogger(__name__)


# ── Serializers inline ────────────────────────────────────────────────────────


class CapacidadeTecnicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CapacidadeTecnico
        fields = [
            "id", "tecnico", "categoria_mao_obra", "horas_dia_util",
            "dias_semana", "vigente_desde", "vigente_ate",
        ]


class BloqueioCapacidadeSerializer(serializers.ModelSerializer):
    class Meta:
        model = BloqueioCapacidade
        fields = ["id", "tecnico", "data_inicio", "data_fim", "motivo", "is_active"]


# ── ViewSets ──────────────────────────────────────────────────────────────────


class CapacidadeTecnicoViewSet(ModelViewSet):
    """CRUD de capacidade produtiva por técnico + categoria."""

    serializer_class = CapacidadeTecnicoSerializer
    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    def get_queryset(self):
        return CapacidadeTecnico.objects.filter(
            is_active=True
        ).select_related("tecnico", "categoria_mao_obra").order_by("tecnico", "vigente_desde")

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsManagerOrAbove()]


class BloqueioCapacidadeViewSet(ModelViewSet):
    """CRUD de bloqueios de capacidade (férias, licença, etc.)."""

    serializer_class = BloqueioCapacidadeSerializer
    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    def get_queryset(self):
        return BloqueioCapacidade.objects.filter(is_active=True).order_by("data_inicio")

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsManagerOrAbove()]


# ── APIViews de cálculo ───────────────────────────────────────────────────────


class UtilizacaoView(APIView):
    """
    GET /api/v1/capacidade/utilizacao/?categoria=<id>&inicio=YYYY-MM-DD&fim=YYYY-MM-DD
    Retorna horas disponíveis, comprometidas e % de utilização.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        categoria_id = request.query_params.get("categoria", "")
        inicio_str = request.query_params.get("inicio", "")
        fim_str = request.query_params.get("fim", "")

        if not categoria_id:
            return Response({"erro": "Parâmetro 'categoria' obrigatório."}, status=400)

        try:
            inicio = date.fromisoformat(inicio_str) if inicio_str else date.today()
            fim = date.fromisoformat(fim_str) if fim_str else inicio + timedelta(days=6)
        except ValueError:
            return Response({"erro": "Formato de data inválido (YYYY-MM-DD)."}, status=400)

        empresa_id = str(request.user.active_company_id) if hasattr(request.user, "active_company_id") else ""

        resultado = CapacidadeService.utilizacao(
            empresa_id=empresa_id,
            categoria_mao_obra_id=categoria_id,
            data_inicio=inicio,
            data_fim=fim,
        )
        return Response(resultado)


class HeatmapSemanaView(APIView):
    """
    GET /api/v1/capacidade/heatmap-semana/?inicio=YYYY-MM-DD
    Retorna lista de 7 dias com utilização geral e por categoria.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        inicio_str = request.query_params.get("inicio", "")
        try:
            semana_inicio = date.fromisoformat(inicio_str) if inicio_str else date.today()
        except ValueError:
            return Response({"erro": "Formato de data inválido (YYYY-MM-DD)."}, status=400)

        empresa_id = str(request.user.active_company_id) if hasattr(request.user, "active_company_id") else ""

        resultado = CapacidadeService.heatmap_semana(
            empresa_id=empresa_id,
            semana_inicio=semana_inicio,
        )
        return Response(resultado)


class ProximaDataDisponivelView(APIView):
    """
    GET /api/v1/capacidade/proxima-data/?categoria=<id>&horas=<decimal>
    Retorna a primeira data com capacidade suficiente.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        from decimal import Decimal, InvalidOperation

        categoria_id = request.query_params.get("categoria", "")
        horas_str = request.query_params.get("horas", "1")

        if not categoria_id:
            return Response({"erro": "Parâmetro 'categoria' obrigatório."}, status=400)

        try:
            horas = Decimal(horas_str)
        except InvalidOperation:
            return Response({"erro": "Parâmetro 'horas' inválido."}, status=400)

        data = CapacidadeService.proxima_data_disponivel(
            categoria_mao_obra_id=categoria_id,
            horas_necessarias=horas,
        )
        return Response({"proxima_data": data.isoformat() if data else None})
