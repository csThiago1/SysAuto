"""
Paddock Solutions — Inventory — Views de Movimentacao
Endpoints para entrada, transferencia, perda, listagem e aprovacao.

RBAC:
  - Entrada/devolucao/transferencia/perda: STOREKEEPER+
  - Listagem movimentacoes: CONSULTANT+
  - Aprovacao/rejeicao: MANAGER+
"""
import logging

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

        try:
            unidade = EntradaEstoqueService.entrada_manual_peca(
                peca_canonica_id=data["peca_canonica_id"],
                valor_nf=data["valor_nf"],
                nivel_id=data["nivel_id"],
                user_id=request.user.id,
                motivo=data["motivo"],
                produto_peca_id=data.get("produto_peca_id"),
                numero_serie=data.get("numero_serie", ""),
            )
        except Exception as e:
            logger.error("Erro na entrada manual de peca: %s", e)
            return Response(
                {"erro": "Erro ao registrar entrada de peca."},
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

        try:
            lote = EntradaEstoqueService.entrada_manual_lote(
                material_canonico_id=data["material_canonico_id"],
                quantidade_compra=data["quantidade_compra"],
                unidade_compra=data["unidade_compra"],
                fator_conversao=data["fator_conversao"],
                valor_total_nf=data["valor_total_nf"],
                nivel_id=data["nivel_id"],
                user_id=request.user.id,
                motivo=data["motivo"],
                produto_insumo_id=data.get("produto_insumo_id"),
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
