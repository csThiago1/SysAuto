"""
Paddock Solutions — Pricing Engine — Views DRF
Motor de Orçamentos (MO) — Sprint 03: Adapters de Custo

ViewSets com RBAC via get_permissions():
  - Leitura: MANAGER+
  - Escrita: ADMIN+
  - Debug: ADMIN+ apenas
"""
import logging

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsAdminOrAbove, IsManagerOrAbove
from apps.pricing_engine.models import (
    CustoHoraFallback,
    ParametroCustoHora,
    ParametroRateio,
)
from apps.pricing_engine.serializers import (
    CustoHoraFallbackSerializer,
    DebugCustoHoraInputSerializer,
    DebugRateioInputSerializer,
    ParametroCustoHoraSerializer,
    ParametroRateioSerializer,
)
from apps.pricing_engine.services import (
    CustoHoraService,
    CustoNaoDefinido,
    DespesaRecorrenteService,
    ParametroRateioNaoDefinido,
    RateioService,
)
from apps.pricing_engine.services.custo_base import (
    CustoBaseIndisponivel,
    CustoInsumoService,
    CustoPecaService,
)

logger = logging.getLogger(__name__)


# ─── ViewSets de Parâmetros ───────────────────────────────────────────────────


class ParametroRateioViewSet(viewsets.ModelViewSet):
    """CRUD de ParametroRateio — parâmetros de rateio de despesas recorrentes."""

    serializer_class = ParametroRateioSerializer
    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    def get_queryset(self):  # type: ignore[override]
        """Retorna parâmetros ativos, mais recente primeiro."""
        return ParametroRateio.objects.filter(is_active=True).order_by(
            "-vigente_desde"
        )

    def get_permissions(self) -> list:  # type: ignore[override]
        """Leitura: MANAGER+ | Escrita: ADMIN+."""
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAdminOrAbove()]
        return [IsAuthenticated(), IsManagerOrAbove()]


class ParametroCustoHoraViewSet(viewsets.ModelViewSet):
    """CRUD de ParametroCustoHora — encargos para cálculo de custo/hora."""

    serializer_class = ParametroCustoHoraSerializer
    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    def get_queryset(self):  # type: ignore[override]
        """Retorna parâmetros ativos, mais recente primeiro."""
        return ParametroCustoHora.objects.filter(is_active=True).order_by(
            "-vigente_desde"
        )

    def get_permissions(self) -> list:  # type: ignore[override]
        """Leitura: MANAGER+ | Escrita: ADMIN+."""
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAdminOrAbove()]
        return [IsAuthenticated(), IsManagerOrAbove()]


class CustoHoraFallbackViewSet(viewsets.ModelViewSet):
    """CRUD de CustoHoraFallback — valor direto de custo/hora por categoria."""

    serializer_class = CustoHoraFallbackSerializer
    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    def get_queryset(self):  # type: ignore[override]
        """Retorna fallbacks ativos com categoria pré-carregada, mais recente primeiro."""
        return (
            CustoHoraFallback.objects.filter(is_active=True)
            .select_related("categoria")
            .order_by("-vigente_desde")
        )

    def get_permissions(self) -> list:  # type: ignore[override]
        """Leitura: MANAGER+ | Escrita: ADMIN+."""
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAdminOrAbove()]
        return [IsAuthenticated(), IsManagerOrAbove()]


# ─── APIViews de Debug ────────────────────────────────────────────────────────


class DebugCustoHoraView(APIView):
    """Calcula e retorna o custo/hora para uma categoria em uma data específica.

    Apenas ADMIN+ pode acessar. Útil para diagnosticar configurações e
    verificar qual origem (RH vs fallback) está sendo usada.
    """

    permission_classes = [IsAuthenticated, IsAdminOrAbove]

    def post(self, request: Request) -> Response:
        """POST /debug/custo-hora/ — retorna decomposição do custo/hora."""
        ser = DebugCustoHoraInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        categoria_codigo: str = ser.validated_data["categoria_codigo"]
        data = ser.validated_data["data"]
        empresa_id = str(ser.validated_data["empresa_id"])

        try:
            resultado = CustoHoraService.obter(
                categoria_codigo,
                data,
                empresa_id,
            )
            return Response(
                {
                    "valor": str(resultado.valor),
                    "origem": resultado.origem,
                    "decomposicao": resultado.decomposicao,
                    "calculado_em": resultado.calculado_em.isoformat(),
                }
            )
        except CustoNaoDefinido as exc:
            return Response({"erro": str(exc)}, status=404)
        except Exception as exc:
            logger.error("Erro em debug/custo-hora: %s", exc)
            return Response(
                {"erro": "Erro interno ao calcular custo/hora."}, status=500
            )


class DebugRateioView(APIView):
    """Calcula e retorna o rateio por hora para uma empresa em uma data específica.

    Apenas ADMIN+ pode acessar. Retorna o valor de rateio, a decomposição das
    despesas vigentes e os parâmetros utilizados.
    """

    permission_classes = [IsAuthenticated, IsAdminOrAbove]

    def post(self, request: Request) -> Response:
        """POST /debug/rateio/ — retorna rateio/hora e decomposição de despesas."""
        ser = DebugRateioInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        data = ser.validated_data["data"]
        empresa_id = str(ser.validated_data["empresa_id"])

        try:
            rateio_hora = RateioService.por_hora(data, empresa_id)
            decomposicao = DespesaRecorrenteService.decomposicao_vigente(
                data, empresa_id
            )
            total_despesas = DespesaRecorrenteService.total_vigente(data, empresa_id)

            return Response(
                {
                    "rateio_hora": str(rateio_hora),
                    "total_despesas": str(total_despesas),
                    "decomposicao_despesas": decomposicao,
                    "calculado_em": data.isoformat(),
                }
            )
        except ParametroRateioNaoDefinido as exc:
            return Response({"erro": str(exc)}, status=404)
        except ValueError as exc:
            return Response({"erro": str(exc)}, status=400)
        except Exception as exc:
            logger.error("Erro em debug/rateio: %s", exc)
            return Response(
                {"erro": "Erro interno ao calcular rateio."}, status=500
            )


class DebugCustoPecaView(APIView):
    """Retorna custo base de uma peça canônica (max valor_nf das unidades disponíveis/reservadas).

    ADMIN+ apenas. MO-5 / Armadilha A2.
    """

    permission_classes = [IsAuthenticated, IsAdminOrAbove]

    def post(self, request: Request) -> Response:
        """POST /debug/custo-peca/ body: {peca_canonica_id}."""
        peca_id = request.data.get("peca_canonica_id")
        if not peca_id:
            return Response({"erro": "peca_canonica_id é obrigatório."}, status=400)
        try:
            custo = CustoPecaService.custo_base(str(peca_id))
            decomposicao = CustoPecaService.decomposicao(str(peca_id))
            return Response({"custo_base": str(custo), "decomposicao": decomposicao})
        except CustoBaseIndisponivel as exc:
            return Response({"erro": str(exc)}, status=404)
        except Exception as exc:
            logger.error("Erro em debug/custo-peca: %s", exc)
            return Response({"erro": "Erro interno."}, status=500)


class DebugCustoInsumoView(APIView):
    """Retorna custo base de um material canônico (max valor_unitario_base dos lotes com saldo > 0).

    ADMIN+ apenas. MO-5.
    """

    permission_classes = [IsAuthenticated, IsAdminOrAbove]

    def post(self, request: Request) -> Response:
        """POST /debug/custo-insumo/ body: {material_canonico_id}."""
        material_id = request.data.get("material_canonico_id")
        if not material_id:
            return Response({"erro": "material_canonico_id é obrigatório."}, status=400)
        try:
            custo = CustoInsumoService.custo_base(str(material_id))
            saldo = CustoInsumoService.saldo_disponivel(str(material_id))
            decomposicao = CustoInsumoService.decomposicao(str(material_id))
            return Response(
                {"custo_base": str(custo), "saldo_disponivel": str(saldo), "decomposicao": decomposicao}
            )
        except CustoBaseIndisponivel as exc:
            return Response({"erro": str(exc)}, status=404)
        except Exception as exc:
            logger.error("Erro em debug/custo-insumo: %s", exc)
            return Response({"erro": "Erro interno."}, status=500)
