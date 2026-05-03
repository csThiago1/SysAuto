"""
Paddock Solutions — Inventory — Views de Movimentacao
Endpoints para entrada, transferencia, perda, listagem e aprovacao.

RBAC:
  - Entrada/devolucao/transferencia/perda: STOREKEEPER+
  - Listagem movimentacoes: CONSULTANT+
  - Aprovacao/rejeicao: MANAGER+
"""
import logging

from decimal import Decimal

from django.db.models import Count, Q, Sum
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import (
    IsConsultantOrAbove,
    IsManagerOrAbove,
    IsStorekeeperOrAbove,
)
from apps.inventory.models_movement import MovimentacaoEstoque
from apps.inventory.models_physical import UnidadeFisica
from apps.inventory.serializers_movement import (
    DevolucaoInputSerializer,
    EntradaLoteInputSerializer,
    EntradaPecaInputSerializer,
    MovimentacaoEstoqueSerializer,
    PerdaInputSerializer,
    RejeicaoInputSerializer,
    TransferenciaInputSerializer,
)
from apps.inventory.services.aprovacao import AprovacaoEstoqueService
from apps.inventory.services.entrada import EntradaEstoqueService
from apps.inventory.services.localizacao import LocalizacaoService
from apps.inventory.services.saida import SaidaEstoqueService

logger = logging.getLogger(__name__)


class EntradaPecaView(APIView):
    """POST — Entrada manual de peca. STOREKEEPER+."""

    permission_classes = [IsAuthenticated, IsStorekeeperOrAbove]

    def post(self, request: Request) -> Response:
        serializer = EntradaPecaInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Resolver peca_canonica_id a partir do produto se não informado
        peca_canonica_id = data.get("peca_canonica_id")
        produto_peca_id = data.get("produto_peca_id")

        if not peca_canonica_id and produto_peca_id:
            from apps.inventory.models_product import ProdutoComercialPeca
            try:
                produto = ProdutoComercialPeca.objects.get(pk=produto_peca_id, is_active=True)
                peca_canonica_id = produto.peca_canonica_id
            except ProdutoComercialPeca.DoesNotExist:
                return Response(
                    {"erro": "Produto comercial não encontrado."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            unidade = EntradaEstoqueService.entrada_manual_peca(
                peca_canonica_id=peca_canonica_id,
                valor_nf=data["valor_nf"],
                nivel_id=data["nivel_id"],
                user_id=request.user.id,
                motivo=data["motivo"],
                produto_peca_id=produto_peca_id,
                numero_serie=data.get("numero_serie", ""),
            )
        except Exception as e:
            logger.error("Erro na entrada manual de peca: %s", e)
            return Response(
                {"erro": "Erro ao registrar entrada de peça."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {"id": str(unidade.id), "codigo_barras": unidade.codigo_barras},
            status=status.HTTP_201_CREATED,
        )


class EntradaLoteView(APIView):
    """POST — Entrada manual de lote de insumo. STOREKEEPER+."""

    permission_classes = [IsAuthenticated, IsStorekeeperOrAbove]

    def post(self, request: Request) -> Response:
        serializer = EntradaLoteInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Resolver material_canonico_id a partir do produto se não informado
        material_canonico_id = data.get("material_canonico_id")
        produto_insumo_id = data.get("produto_insumo_id")

        if not material_canonico_id and produto_insumo_id:
            from apps.inventory.models_product import ProdutoComercialInsumo
            try:
                produto = ProdutoComercialInsumo.objects.get(pk=produto_insumo_id, is_active=True)
                material_canonico_id = produto.material_canonico_id
            except ProdutoComercialInsumo.DoesNotExist:
                return Response(
                    {"erro": "Produto comercial insumo não encontrado."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            lote = EntradaEstoqueService.entrada_manual_lote(
                material_canonico_id=material_canonico_id,
                quantidade_compra=data["quantidade_compra"],
                unidade_compra=data["unidade_compra"],
                fator_conversao=data["fator_conversao"],
                valor_total_nf=data["valor_total_nf"],
                nivel_id=data["nivel_id"],
                user_id=request.user.id,
                motivo=data["motivo"],
                produto_insumo_id=produto_insumo_id,
                validade=data.get("validade"),
            )
        except Exception as e:
            logger.error("Erro na entrada manual de lote: %s", e)
            return Response(
                {"erro": "Erro ao registrar entrada de lote."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {"id": str(lote.id), "codigo_barras": lote.codigo_barras},
            status=status.HTTP_201_CREATED,
        )


class DevolucaoView(APIView):
    """POST /{unidade_id}/ — Devolucao de peca consumida. STOREKEEPER+."""

    permission_classes = [IsAuthenticated, IsStorekeeperOrAbove]

    def post(self, request: Request, unidade_id: str) -> Response:
        serializer = DevolucaoInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            mov = EntradaEstoqueService.registrar_devolucao(
                unidade_fisica_id=unidade_id,
                nivel_destino_id=data["nivel_destino_id"],
                user_id=request.user.id,
                motivo=data["motivo"],
            )
        except ValueError as e:
            return Response(
                {"erro": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error("Erro ao registrar devolucao: %s", e)
            return Response(
                {"erro": "Erro ao registrar devolucao."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            MovimentacaoEstoqueSerializer(mov).data,
            status=status.HTTP_201_CREATED,
        )


class TransferenciaView(APIView):
    """POST — Transferencia de item entre niveis. STOREKEEPER+."""

    permission_classes = [IsAuthenticated, IsStorekeeperOrAbove]

    def post(self, request: Request) -> Response:
        serializer = TransferenciaInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            if data["item_tipo"] == "unidade":
                mov = LocalizacaoService.mover_unidade(
                    unidade_fisica_id=data["item_id"],
                    nivel_destino_id=data["nivel_destino_id"],
                    user_id=request.user.id,
                )
            else:
                mov = LocalizacaoService.mover_lote(
                    lote_insumo_id=data["item_id"],
                    nivel_destino_id=data["nivel_destino_id"],
                    user_id=request.user.id,
                )
        except Exception as e:
            logger.error("Erro na transferencia: %s", e)
            return Response(
                {"erro": "Erro ao transferir item."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            MovimentacaoEstoqueSerializer(mov).data,
            status=status.HTTP_201_CREATED,
        )


class PerdaView(APIView):
    """POST — Registro de perda/avaria. STOREKEEPER+."""

    permission_classes = [IsAuthenticated, IsStorekeeperOrAbove]

    def post(self, request: Request) -> Response:
        serializer = PerdaInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            if data["item_tipo"] == "unidade":
                mov = SaidaEstoqueService.registrar_perda_unidade(
                    unidade_fisica_id=data["item_id"],
                    motivo=data["motivo"],
                    user_id=request.user.id,
                )
            else:
                quantidade = data.get("quantidade")
                if quantidade is None:
                    return Response(
                        {"erro": "Campo 'quantidade' obrigatorio para lotes."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                mov = SaidaEstoqueService.registrar_perda_lote(
                    lote_insumo_id=data["item_id"],
                    quantidade_perdida=quantidade,
                    motivo=data["motivo"],
                    user_id=request.user.id,
                )
        except ValueError as e:
            return Response(
                {"erro": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error("Erro ao registrar perda: %s", e)
            return Response(
                {"erro": "Erro ao registrar perda."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            MovimentacaoEstoqueSerializer(mov).data,
            status=status.HTTP_201_CREATED,
        )


class MovimentacaoViewSet(viewsets.ReadOnlyModelViewSet):
    """Listagem de movimentacoes. CONSULTANT+. Filtravel por tipo, OS, user, data."""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]
    serializer_class = MovimentacaoEstoqueSerializer

    def get_queryset(self):  # type: ignore[override]
        qs = MovimentacaoEstoque.objects.filter(is_active=True).select_related(
            "unidade_fisica",
            "lote_insumo",
            "nivel_origem",
            "nivel_destino",
            "realizado_por",
            "aprovado_por",
        ).order_by("-created_at")

        # Filtros opcionais
        tipo = self.request.query_params.get("tipo")
        if tipo:
            qs = qs.filter(tipo=tipo)

        ordem_servico = self.request.query_params.get("ordem_servico")
        if ordem_servico:
            qs = qs.filter(ordem_servico_id=ordem_servico)

        realizado_por = self.request.query_params.get("realizado_por")
        if realizado_por:
            qs = qs.filter(realizado_por_id=realizado_por)

        data_inicio = self.request.query_params.get("data_inicio")
        if data_inicio:
            qs = qs.filter(created_at__date__gte=data_inicio)

        data_fim = self.request.query_params.get("data_fim")
        if data_fim:
            qs = qs.filter(created_at__date__lte=data_fim)

        return qs


class AprovacoesPendentesView(APIView):
    """GET — Lista movimentacoes pendentes de aprovacao. MANAGER+."""

    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    def get(self, request: Request) -> Response:
        qs = AprovacaoEstoqueService.pendentes()
        serializer = MovimentacaoEstoqueSerializer(qs, many=True)
        return Response(serializer.data)


class AprovarView(APIView):
    """POST /{id}/aprovar/ — Aprova movimentacao pendente. MANAGER+."""

    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    def post(self, request: Request, pk: str) -> Response:
        try:
            mov = AprovacaoEstoqueService.aprovar(
                movimentacao_id=pk,
                user_id=request.user.id,
            )
        except ValueError as e:
            return Response(
                {"erro": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error("Erro ao aprovar movimentacao: %s", e)
            return Response(
                {"erro": "Erro ao aprovar movimentacao."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(MovimentacaoEstoqueSerializer(mov).data)


class RejeitarView(APIView):
    """POST /{id}/rejeitar/ — Rejeita movimentacao pendente. MANAGER+."""

    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    def post(self, request: Request, pk: str) -> Response:
        serializer = RejeicaoInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            AprovacaoEstoqueService.rejeitar(
                movimentacao_id=pk,
                user_id=request.user.id,
                motivo=serializer.validated_data["motivo"],
            )
        except ValueError as e:
            return Response(
                {"erro": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error("Erro ao rejeitar movimentacao: %s", e)
            return Response(
                {"erro": "Erro ao rejeitar movimentacao."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class MargemOSView(APIView):
    """GET /margem-os/{os_id}/ — Análise custo vs cobrado de uma OS. MANAGER+."""

    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    def get(self, request: Request, os_id: str) -> Response:
        from apps.inventory.models_physical import ConsumoInsumo
        from apps.service_orders.models import ServiceOrder

        try:
            os_obj = ServiceOrder.objects.get(pk=os_id, is_active=True)
        except ServiceOrder.DoesNotExist:
            return Response(
                {"erro": "Ordem de serviço não encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            itens = self._build_pecas(os_obj) + self._build_insumos(os_obj)

            custo_total = sum(float(i["custo"]) for i in itens)
            cobrado_total = sum(float(i["cobrado"]) for i in itens)
            margem_total_pct = (
                (cobrado_total - custo_total) / custo_total * 100
                if custo_total > 0
                else 0.0
            )

            return Response({
                "itens": itens,
                "resumo": {
                    "custo_total": f"{custo_total:.2f}",
                    "cobrado_total": f"{cobrado_total:.2f}",
                    "margem_total": f"{cobrado_total - custo_total:.2f}",
                    "margem_total_pct": f"{margem_total_pct:.1f}",
                },
            })
        except Exception as e:
            logger.error("Erro ao calcular margem da OS %s: %s", os_id, e)
            return Response(
                {"erro": "Erro interno ao processar requisição."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def _build_pecas(self, os_obj: object) -> list[dict]:
        """Monta itens de peças físicas reservadas/consumidas para a OS."""
        unidades = UnidadeFisica.objects.filter(
            ordem_servico=os_obj, is_active=True,
        ).select_related("peca_canonica", "produto_peca", "nivel")

        pecas_items: list[dict] = []
        for u in unidades:
            nome = (
                u.produto_peca.nome_interno
                if u.produto_peca
                else (
                    u.peca_canonica.nome
                    if u.peca_canonica
                    else u.codigo_barras
                )
            )
            sku = u.produto_peca.sku_interno if u.produto_peca else ""
            custo = float(u.valor_nf)

            # Valor cobrado: OSIntervencao (motor) tem prioridade
            cobrado = 0.0
            intervencao = os_obj.intervencoes_motor.filter(
                unidade_reservada=u, is_active=True,
            ).first()
            if intervencao:
                cobrado = float(intervencao.valor_peca)
            else:
                # Fallback: ServiceOrderPart com mesmo part_number/peca_canonica
                part = os_obj.parts.filter(is_active=True).first()
                if part:
                    cobrado = float(
                        part.quantity * part.unit_price - part.discount
                    )

            pecas_items.append({
                "tipo": "peca",
                "nome": nome,
                "sku": sku,
                "codigo_barras": u.codigo_barras,
                "posicao": u.nivel.endereco_completo if u.nivel else "",
                "custo": f"{custo:.2f}",
                "cobrado": f"{cobrado:.2f}",
                "margem_pct": (
                    f"{((cobrado - custo) / custo * 100):.1f}"
                    if custo > 0
                    else "0.0"
                ),
            })

        return pecas_items

    def _build_insumos(self, os_obj: object) -> list[dict]:
        """Monta itens de insumos consumidos para a OS."""
        from apps.inventory.models_physical import ConsumoInsumo

        consumos = ConsumoInsumo.objects.filter(
            ordem_servico=os_obj, is_active=True,
        ).select_related(
            "lote__material_canonico",
            "lote__produto_insumo",
            "lote__nivel",
        )

        insumos_items: list[dict] = []
        for c in consumos:
            nome = (
                c.lote.produto_insumo.nome_interno
                if c.lote.produto_insumo
                else (
                    c.lote.material_canonico.nome
                    if c.lote.material_canonico
                    else c.lote.codigo_barras
                )
            )
            sku = c.lote.produto_insumo.sku_interno if c.lote.produto_insumo else ""
            custo = float(c.quantidade_base * c.valor_unitario_na_baixa)
            cobrado = 0.0  # Custo de insumo embutido no preço do serviço

            insumos_items.append({
                "tipo": "insumo",
                "nome": nome,
                "sku": sku,
                "codigo_barras": c.lote.codigo_barras,
                "posicao": c.lote.nivel.endereco_completo if c.lote.nivel else "",
                "custo": f"{custo:.2f}",
                "cobrado": f"{cobrado:.2f}",
                "margem_pct": (
                    f"{((cobrado - custo) / custo * 100):.1f}"
                    if custo > 0
                    else "0.0"
                ),
            })

        return insumos_items


class DashboardStatsView(APIView):
    """GET — KPIs do dashboard de estoque. CONSULTANT+."""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get(self, request: Request) -> Response:
        unidades_qs = UnidadeFisica.objects.filter(is_active=True)

        disponiveis = unidades_qs.filter(status="available")
        agg = disponiveis.aggregate(
            pecas_disponiveis=Count("id"),
            valor_em_estoque=Sum("valor_nf"),
        )

        reservadas_os = unidades_qs.filter(status="reserved").count()

        aprovacoes_pendentes = MovimentacaoEstoque.objects.filter(
            is_active=True,
            tipo__in=["saida_perda", "ajuste_inventario"],
            aprovado_por__isnull=True,
        ).count()

        return Response({
            "pecas_disponiveis": agg["pecas_disponiveis"] or 0,
            "valor_em_estoque": str(agg["valor_em_estoque"] or Decimal("0.00")),
            "reservadas_os": reservadas_os,
            "aprovacoes_pendentes": aprovacoes_pendentes,
        })
