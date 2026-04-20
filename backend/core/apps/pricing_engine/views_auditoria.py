"""
Paddock Solutions — Pricing Engine — Views de Auditoria e Healthcheck
MO-9: Endpoints de auditoria do motor e healthcheck.
"""
import logging

from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsAdminOrAbove, IsManagerOrAbove
from apps.pricing_engine.models import AuditoriaMotor
from apps.pricing_engine.services.auditoria import AuditoriaService

logger = logging.getLogger(__name__)


class AuditoriaMotorSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditoriaMotor
        fields = [
            "id", "operacao", "chamado_por", "empresa_id",
            "contexto_input", "resultado_output",
            "sucesso", "erro_msg", "tempo_ms", "snapshot_id",
            "created_at",
        ]
        read_only_fields = fields


class AuditoriaMotorViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Lista e detalha auditorias do motor de precificação.
    Filtros: ?operacao=<str>, ?sucesso=true|false, ?empresa_id=<uuid>.
    MANAGER+ para list/retrieve.
    """

    serializer_class = AuditoriaMotorSerializer
    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    def get_queryset(self):
        qs = AuditoriaMotor.objects.order_by("-created_at")
        operacao = self.request.query_params.get("operacao", "")
        sucesso = self.request.query_params.get("sucesso", "")
        empresa_id = self.request.query_params.get("empresa_id", "")

        if operacao:
            qs = qs.filter(operacao=operacao)
        if sucesso.lower() in ("true", "false"):
            qs = qs.filter(sucesso=sucesso.lower() == "true")
        if empresa_id:
            qs = qs.filter(empresa_id=empresa_id)

        return qs[:500]  # limite de 500 para não explodir memória


class HealthcheckMotorView(APIView):
    """
    GET /api/v1/pricing/engine/healthcheck/
    Retorna saúde do motor: tabelas acessíveis, taxa de erro, tempo médio.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        resultado = AuditoriaService.healthcheck()
        http_status = 200 if resultado.get("status") == "ok" else 503
        return Response(resultado, status=http_status)
