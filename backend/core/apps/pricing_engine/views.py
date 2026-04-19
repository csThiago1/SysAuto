"""
Paddock Solutions — Pricing Engine — Views DRF
Motor de Orçamentos (MO) — Sprint 03+06: Adapters de Custo + Motor de Precificação

ViewSets com RBAC via get_permissions():
  - Leitura: MANAGER+
  - Escrita: ADMIN+
  - Debug: ADMIN+ apenas
  - Cálculo (motor): CONSULTANT+
"""
import logging

from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import (
    IsAdminOrAbove,
    IsConsultantOrAbove,
    IsManagerOrAbove,
    _get_role,
)
from apps.pricing_engine.models import (
    CalculoCustoSnapshot,
    CustoHoraFallback,
    MargemOperacao,
    MarkupPeca,
    ParametroCustoHora,
    ParametroRateio,
)
from apps.pricing_engine.serializers import (
    CalcularPecaInputSerializer,
    CalcularServicoInputSerializer,
    CustoHoraFallbackSerializer,
    DebugCustoHoraInputSerializer,
    DebugRateioInputSerializer,
    MargemOperacaoSerializer,
    MarkupPecaSerializer,
    ParametroCustoHoraSerializer,
    ParametroRateioSerializer,
    SimularInputSerializer,
    SnapshotFullSerializer,
    SnapshotMgrSerializer,
    SnapshotMinSerializer,
)
from apps.pricing_engine.services import (
    ContextoCalculo,
    CustoHoraService,
    CustoNaoDefinido,
    DespesaRecorrenteService,
    ErroMotorPrecificacao,
    MotorPrecificacaoService,
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


# ─── Motor MO-6: MargemOperacao + MarkupPeca ─────────────────────────────────


class MargemOperacaoViewSet(viewsets.ModelViewSet):
    """CRUD de MargemOperacao — margem base por segmento × tipo de operação."""

    serializer_class = MargemOperacaoSerializer

    def get_queryset(self):  # type: ignore[override]
        return (
            MargemOperacao.objects.filter(is_active=True)
            .select_related("segmento")
            .order_by("segmento__codigo", "tipo_operacao", "-vigente_desde")
        )

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAdminOrAbove()]
        return [IsAuthenticated(), IsManagerOrAbove()]


class MarkupPecaViewSet(viewsets.ModelViewSet):
    """CRUD de MarkupPeca — override fino de margem por peça ou faixa de custo."""

    serializer_class = MarkupPecaSerializer

    def get_queryset(self):  # type: ignore[override]
        return (
            MarkupPeca.objects.filter(is_active=True)
            .select_related("peca_canonica")
            .order_by("-vigente_desde")
        )

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAdminOrAbove()]
        return [IsAuthenticated(), IsManagerOrAbove()]


# ─── Motor MO-6: Snapshots ────────────────────────────────────────────────────


class CalculoCustoSnapshotViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista e detalhe de snapshots de custo — imutável (sem POST/PATCH/DELETE).

    RBAC em get_serializer_class() — serializer distinto por role (P10).
    """

    def get_queryset(self):  # type: ignore[override]
        qs = CalculoCustoSnapshot.objects.select_related(
            "servico_canonico", "peca_canonica", "calculado_por"
        ).order_by("-calculado_em")

        origem = self.request.query_params.get("origem")
        if origem:
            qs = qs.filter(origem=origem)
        servico = self.request.query_params.get("servico")
        if servico:
            qs = qs.filter(servico_canonico_id=servico)
        peca = self.request.query_params.get("peca")
        if peca:
            qs = qs.filter(peca_canonica_id=peca)
        desde = self.request.query_params.get("desde")
        if desde:
            qs = qs.filter(calculado_em__date__gte=desde)

        return qs

    def get_permissions(self) -> list:  # type: ignore[override]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_serializer_class(self):  # type: ignore[override]
        """Serializer distinto por role — dados sensíveis nunca vazam (P10)."""
        role = _get_role(self.request)
        if role in ("OWNER", "ADMIN"):
            return SnapshotFullSerializer
        if role == "MANAGER":
            return SnapshotMgrSerializer
        return SnapshotMinSerializer


# ─── Motor MO-6: Endpoints de cálculo ────────────────────────────────────────


def _contexto_from_validated(data: dict) -> ContextoCalculo:
    """Constrói ContextoCalculo a partir dos dados validados do serializer."""
    ctx_data = data["contexto"]
    return ContextoCalculo(
        empresa_id=str(ctx_data["empresa_id"]),
        veiculo_marca=ctx_data["veiculo_marca"],
        veiculo_modelo=ctx_data["veiculo_modelo"],
        veiculo_ano=ctx_data["veiculo_ano"],
        veiculo_versao=ctx_data.get("veiculo_versao"),
        tipo_pintura_codigo=ctx_data.get("tipo_pintura_codigo"),
        quem_paga=ctx_data.get("quem_paga", "cliente"),
        aplica_multiplicador_tamanho=ctx_data.get("aplica_multiplicador_tamanho", True),
    )


class CalcularServicoView(APIView):
    """POST /calcular-servico/ — calcula preço de um serviço e grava snapshot.

    CONSULTANT+ pode calcular (necessário para orçar durante abertura de OS).
    """

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def post(self, request: Request) -> Response:
        ser = CalcularServicoInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        ctx = _contexto_from_validated(ser.validated_data)
        servico_id = str(ser.validated_data["servico_canonico_id"])
        origem = ser.validated_data.get("origem", "simulacao")
        user_id = str(request.user.pk) if request.user and request.user.pk else None

        try:
            resultado = MotorPrecificacaoService.calcular_servico(
                ctx, servico_id, origem=origem, user_id=user_id
            )
        except ErroMotorPrecificacao as exc:
            return Response(
                {"erro": str(exc), "recurso_faltante": exc.recurso_faltante},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        except Exception as exc:
            logger.error("Erro interno em calcular-servico: %s", exc)
            return Response({"erro": "Erro interno ao calcular preço."}, status=500)

        return Response(
            {
                "snapshot_id": resultado.snapshot_id,
                "preco_final": str(resultado.preco_final),
                "custo_total_base": str(resultado.custo_total_base),
                "margem_ajustada": str(resultado.margem_ajustada),
                "teto_aplicado": resultado.teto_aplicado,
                "decomposicao": resultado.decomposicao,
            },
            status=status.HTTP_201_CREATED,
        )


class CalcularPecaView(APIView):
    """POST /calcular-peca/ — calcula preço de uma peça e grava snapshot.

    CONSULTANT+ pode calcular.
    """

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def post(self, request: Request) -> Response:
        ser = CalcularPecaInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        ctx = _contexto_from_validated(ser.validated_data)
        peca_id = str(ser.validated_data["peca_canonica_id"])
        quantidade = ser.validated_data.get("quantidade", 1)
        origem = ser.validated_data.get("origem", "simulacao")
        user_id = str(request.user.pk) if request.user and request.user.pk else None

        try:
            resultado = MotorPrecificacaoService.calcular_peca(
                ctx, peca_id, quantidade=quantidade, origem=origem, user_id=user_id
            )
        except ErroMotorPrecificacao as exc:
            return Response(
                {"erro": str(exc), "recurso_faltante": exc.recurso_faltante},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        except Exception as exc:
            logger.error("Erro interno em calcular-peca: %s", exc)
            return Response({"erro": "Erro interno ao calcular preço."}, status=500)

        return Response(
            {
                "snapshot_id": resultado.snapshot_id,
                "preco_final": str(resultado.preco_final),
                "custo_base": str(resultado.custo_base),
                "margem_ajustada": str(resultado.margem_ajustada),
                "decomposicao": resultado.decomposicao,
            },
            status=status.HTTP_201_CREATED,
        )


class SimularView(APIView):
    """POST /simular/ — simula múltiplos itens (serviços + peças) em lote.

    Gera lista de snapshots para pré-visualização de orçamento.
    CONSULTANT+ pode simular.
    """

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def post(self, request: Request) -> Response:
        ser = SimularInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        ctx = _contexto_from_validated(ser.validated_data)
        itens = ser.validated_data["itens"]
        user_id = str(request.user.pk) if request.user and request.user.pk else None

        resultados = []
        erros = []

        for item in itens:
            tipo = item["tipo"]
            item_id = str(item["id"])
            quantidade = item.get("quantidade", 1)

            try:
                if tipo == "servico":
                    r = MotorPrecificacaoService.calcular_servico(
                        ctx, item_id, origem="simulacao", user_id=user_id
                    )
                    resultados.append(
                        {
                            "tipo": "servico",
                            "id": item_id,
                            "snapshot_id": r.snapshot_id,
                            "preco_final": str(r.preco_final),
                            "custo_total_base": str(r.custo_total_base),
                            "teto_aplicado": r.teto_aplicado,
                        }
                    )
                else:
                    r = MotorPrecificacaoService.calcular_peca(
                        ctx, item_id, quantidade=quantidade, origem="simulacao", user_id=user_id
                    )
                    resultados.append(
                        {
                            "tipo": "peca",
                            "id": item_id,
                            "quantidade": quantidade,
                            "snapshot_id": r.snapshot_id,
                            "preco_final": str(r.preco_final),
                            "custo_base": str(r.custo_base),
                        }
                    )
            except ErroMotorPrecificacao as exc:
                erros.append(
                    {
                        "tipo": tipo,
                        "id": item_id,
                        "erro": str(exc),
                        "recurso_faltante": exc.recurso_faltante,
                    }
                )

        return Response(
            {"resultados": resultados, "erros": erros},
            status=status.HTTP_200_OK,
        )
