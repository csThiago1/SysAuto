"""
Paddock Solutions — Pricing Tech — Views de Variância
MO-9: Endpoints de variância de ficha técnica e custo de peças.
"""
import logging
from datetime import date

from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsManagerOrAbove
from apps.pricing_tech.models import VarianciaFicha, VarianciaPecaCusto

logger = logging.getLogger(__name__)


class VarianciaFichaSerializer(serializers.ModelSerializer):
    class Meta:
        model = VarianciaFicha
        fields = [
            "id", "servico_canonico_id", "mes_referencia", "qtd_os",
            "horas_estimadas_total", "horas_realizadas_total", "variancia_horas_pct",
            "custo_insumo_estimado", "custo_insumo_realizado", "variancia_insumo_pct",
            "created_at",
        ]
        read_only_fields = fields


class VarianciaPecaCustoSerializer(serializers.ModelSerializer):
    class Meta:
        model = VarianciaPecaCusto
        fields = [
            "id", "peca_canonica_id", "mes_referencia", "qtd_amostras",
            "custo_snapshot_medio", "custo_nfe_medio", "variancia_pct", "alerta",
            "created_at",
        ]
        read_only_fields = fields


class VarianciaFichaViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Lista e detalha variâncias de ficha técnica.
    Filtra por ?mes=YYYY-MM e ?servico_id=<uuid>.
    """

    serializer_class = VarianciaFichaSerializer
    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    def get_queryset(self):
        qs = VarianciaFicha.objects.order_by("-mes_referencia")
        mes = self.request.query_params.get("mes", "")
        servico_id = self.request.query_params.get("servico_id", "")
        if mes:
            try:
                dt = date.fromisoformat(f"{mes}-01")
                qs = qs.filter(mes_referencia__year=dt.year, mes_referencia__month=dt.month)
            except ValueError:
                pass
        if servico_id:
            qs = qs.filter(servico_canonico_id=servico_id)
        return qs

    @action(detail=False, methods=["post"], url_path="gerar")
    def gerar(self, request: Request) -> Response:
        """POST /variancias/fichas/gerar/ — dispara geração manual (ADMIN+)."""
        from apps.authentication.permissions import IsAdminOrAbove
        if not IsAdminOrAbove().has_permission(request, self):
            return Response({"erro": "Requer ADMIN."}, status=403)

        mes_str = request.data.get("mes_referencia", "")
        try:
            mes_ref = date.fromisoformat(mes_str) if mes_str else date.today().replace(day=1)
        except ValueError:
            return Response({"erro": "mes_referencia inválido (YYYY-MM-DD)."}, status=400)

        from django.db import connection
        from apps.pricing_tech.tasks import task_gerar_variancias_mensais
        task_gerar_variancias_mensais.delay(
            tenant_schema=connection.schema_name,
            mes_referencia_iso=mes_ref.isoformat(),
        )
        return Response({"status": "enfileirado", "mes_referencia": mes_ref.isoformat()})


class VarianciaPecaCustoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Lista e detalha variâncias de custo de peças.
    Filtra por ?mes=YYYY-MM, ?peca_id=<uuid>, ?alerta=true.
    """

    serializer_class = VarianciaPecaCustoSerializer
    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    def get_queryset(self):
        qs = VarianciaPecaCusto.objects.order_by("-mes_referencia")
        mes = self.request.query_params.get("mes", "")
        peca_id = self.request.query_params.get("peca_id", "")
        alerta = self.request.query_params.get("alerta", "")
        if mes:
            try:
                dt = date.fromisoformat(f"{mes}-01")
                qs = qs.filter(mes_referencia__year=dt.year, mes_referencia__month=dt.month)
            except ValueError:
                pass
        if peca_id:
            qs = qs.filter(peca_canonica_id=peca_id)
        if alerta.lower() == "true":
            qs = qs.filter(alerta=True)
        return qs
