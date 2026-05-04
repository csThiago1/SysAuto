"""
Paddock Solutions — Purchasing — Views
"""
import logging

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import (
    IsConsultantOrAbove,
    IsManagerOrAbove,
    IsStorekeeperOrAbove,
)
from apps.purchasing.models import OrdemCompra, PedidoCompra
from apps.purchasing.serializers import (
    AdicionarItemOCInputSerializer,
    DashboardComprasSerializer,
    ItemOrdemCompraSerializer,
    OrdemCompraDetailSerializer,
    OrdemCompraListSerializer,
    PedidoCompraSerializer,
)
from apps.purchasing.services import OrdemCompraService, PedidoCompraService

logger = logging.getLogger(__name__)


class PedidoCompraViewSet(viewsets.ReadOnlyModelViewSet):
    """Pedidos de compra — leitura + ações de fluxo."""

    serializer_class = PedidoCompraSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_queryset(self):  # type: ignore[override]
        qs = PedidoCompra.objects.filter(is_active=True).select_related(
            "service_order", "service_order_part", "solicitado_por",
        )
        # Filtros opcionais
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        so_filter = self.request.query_params.get("service_order")
        if so_filter:
            qs = qs.filter(service_order_id=so_filter)
        return qs

    @action(detail=True, methods=["post"], url_path="iniciar-cotacao")
    def iniciar_cotacao(self, request: Request, pk: str = None) -> Response:
        """Mover pedido para status em_cotacao."""
        self.permission_classes = [IsAuthenticated, IsStorekeeperOrAbove]
        self.check_permissions(request)
        try:
            pedido = PedidoCompraService.iniciar_cotacao(
                pedido_id=pk, user_id=request.user.pk,
            )
            return Response(
                PedidoCompraSerializer(pedido).data, status=status.HTTP_200_OK,
            )
        except PedidoCompra.DoesNotExist:
            return Response(
                {"erro": "Pedido de compra nao encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception:
            logger.exception("Erro ao iniciar cotacao do pedido %s", pk)
            return Response(
                {"erro": "Erro interno ao processar requisicao."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"], url_path="cancelar")
    def cancelar(self, request: Request, pk: str = None) -> Response:
        """Cancelar pedido de compra."""
        self.permission_classes = [IsAuthenticated, IsStorekeeperOrAbove]
        self.check_permissions(request)
        motivo = request.data.get("motivo", "")
        try:
            PedidoCompraService.cancelar(
                pedido_id=pk, user_id=request.user.pk, motivo=motivo,
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except PedidoCompra.DoesNotExist:
            return Response(
                {"erro": "Pedido de compra nao encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception:
            logger.exception("Erro ao cancelar pedido %s", pk)
            return Response(
                {"erro": "Erro interno ao processar requisicao."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class OrdemCompraViewSet(viewsets.ModelViewSet):
    """Ordens de compra — CRUD + ações de fluxo."""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsStorekeeperOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == "retrieve":
            return OrdemCompraDetailSerializer
        return OrdemCompraListSerializer

    def get_queryset(self):  # type: ignore[override]
        qs = OrdemCompra.objects.filter(is_active=True).select_related(
            "service_order", "criado_por", "aprovado_por",
        ).annotate(total_itens=Count("itens", filter=Q(itens__is_active=True)))

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        so_filter = self.request.query_params.get("service_order")
        if so_filter:
            qs = qs.filter(service_order_id=so_filter)
        return qs

    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        """Cria OC via OrdemCompraService (PC-4: uma por OS)."""
        service_order_id = request.data.get("service_order")
        if not service_order_id:
            return Response(
                {"erro": "Campo service_order e obrigatorio."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            oc = OrdemCompraService.criar_oc(
                service_order_id=service_order_id, user_id=request.user.pk,
            )
            serializer = OrdemCompraListSerializer(oc)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            logger.warning("Erro ao criar OC: %s", e)
            return Response(
                {"erro": "Nao foi possivel criar a ordem de compra."},
                status=status.HTTP_409_CONFLICT,
            )
        except Exception:
            logger.exception("Erro ao criar OC para OS %s", service_order_id)
            return Response(
                {"erro": "Erro interno ao processar requisicao."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"], url_path="enviar")
    def enviar(self, request: Request, pk: str = None) -> Response:
        """Enviar OC para aprovacao."""
        self.permission_classes = [IsAuthenticated, IsStorekeeperOrAbove]
        self.check_permissions(request)
        try:
            oc = OrdemCompraService.enviar_para_aprovacao(
                oc_id=pk, user_id=request.user.pk,
            )
            return Response(
                OrdemCompraListSerializer(oc).data, status=status.HTTP_200_OK,
            )
        except OrdemCompra.DoesNotExist:
            return Response(
                {"erro": "Ordem de compra nao encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except ValueError:
            return Response(
                {"erro": "OC sem itens nao pode ser enviada para aprovacao."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            logger.exception("Erro ao enviar OC %s para aprovacao", pk)
            return Response(
                {"erro": "Erro interno ao processar requisicao."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"], url_path="aprovar")
    def aprovar(self, request: Request, pk: str = None) -> Response:
        """Aprovar OC (MANAGER+)."""
        self.permission_classes = [IsAuthenticated, IsManagerOrAbove]
        self.check_permissions(request)
        try:
            oc = OrdemCompraService.aprovar(oc_id=pk, user_id=request.user.pk)
            return Response(
                OrdemCompraListSerializer(oc).data, status=status.HTTP_200_OK,
            )
        except OrdemCompra.DoesNotExist:
            return Response(
                {"erro": "Ordem de compra nao encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except ValueError:
            return Response(
                {"erro": "OC nao esta pendente de aprovacao."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            logger.exception("Erro ao aprovar OC %s", pk)
            return Response(
                {"erro": "Erro interno ao processar requisicao."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"], url_path="rejeitar")
    def rejeitar(self, request: Request, pk: str = None) -> Response:
        """Rejeitar OC (MANAGER+) com motivo obrigatorio."""
        self.permission_classes = [IsAuthenticated, IsManagerOrAbove]
        self.check_permissions(request)
        motivo = request.data.get("motivo", "")
        if not motivo:
            return Response(
                {"erro": "Campo motivo e obrigatorio."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            oc = OrdemCompraService.rejeitar(
                oc_id=pk, user_id=request.user.pk, motivo=motivo,
            )
            return Response(
                OrdemCompraListSerializer(oc).data, status=status.HTTP_200_OK,
            )
        except OrdemCompra.DoesNotExist:
            return Response(
                {"erro": "Ordem de compra nao encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception:
            logger.exception("Erro ao rejeitar OC %s", pk)
            return Response(
                {"erro": "Erro interno ao processar requisicao."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AdicionarItemOCView(APIView):
    """POST /ordens-compra/<oc_id>/itens/ — adiciona item a uma OC."""

    permission_classes = [IsAuthenticated, IsStorekeeperOrAbove]

    def post(self, request: Request, oc_id: str) -> Response:
        serializer = AdicionarItemOCInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            item = OrdemCompraService.adicionar_item(
                oc_id=oc_id,
                pedido_compra_id=data.get("pedido_compra_id"),
                fornecedor_id=data.get("fornecedor_id"),
                fornecedor_nome=data["fornecedor_nome"],
                fornecedor_cnpj=data.get("fornecedor_cnpj", ""),
                fornecedor_contato=data.get("fornecedor_contato", ""),
                descricao=data["descricao"],
                codigo_referencia=data.get("codigo_referencia", ""),
                tipo_qualidade=data["tipo_qualidade"],
                quantidade=data["quantidade"],
                valor_unitario=data["valor_unitario"],
                prazo_entrega=data.get("prazo_entrega", ""),
                observacoes=data.get("observacoes", ""),
            )
            return Response(
                ItemOrdemCompraSerializer(item).data,
                status=status.HTTP_201_CREATED,
            )
        except OrdemCompra.DoesNotExist:
            return Response(
                {"erro": "Ordem de compra nao encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception:
            logger.exception("Erro ao adicionar item a OC %s", oc_id)
            return Response(
                {"erro": "Erro interno ao processar requisicao."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class RemoverItemOCView(APIView):
    """DELETE /ordens-compra/<oc_id>/itens/<item_id>/ — remove item da OC."""

    permission_classes = [IsAuthenticated, IsStorekeeperOrAbove]

    def delete(self, request: Request, oc_id: str, item_id: str) -> Response:
        try:
            OrdemCompraService.remover_item(item_id=item_id)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception:
            logger.exception("Erro ao remover item %s da OC %s", item_id, oc_id)
            return Response(
                {"erro": "Erro interno ao processar requisicao."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class RegistrarRecebimentoView(APIView):
    """POST /ordens-compra/<oc_id>/itens/<item_id>/receber/ — registra recebimento."""

    permission_classes = [IsAuthenticated, IsStorekeeperOrAbove]

    def post(self, request: Request, oc_id: str, item_id: str) -> Response:
        unidade_fisica_id = request.data.get("unidade_fisica_id")
        if not unidade_fisica_id:
            return Response(
                {"erro": "Campo unidade_fisica_id e obrigatorio."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            item = OrdemCompraService.registrar_recebimento_item(
                item_id=item_id,
                unidade_fisica_id=unidade_fisica_id,
                user_id=request.user.pk,
            )
            return Response(
                ItemOrdemCompraSerializer(item).data, status=status.HTTP_200_OK,
            )
        except Exception:
            logger.exception(
                "Erro ao registrar recebimento do item %s (OC %s)", item_id, oc_id,
            )
            return Response(
                {"erro": "Erro interno ao processar requisicao."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class DashboardComprasView(APIView):
    """GET /dashboard-stats/ — contadores para o dashboard de compras."""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get(self, request: Request) -> Response:
        hoje = timezone.now().date()
        data = {
            "solicitados": PedidoCompra.objects.filter(
                is_active=True, status="solicitado",
            ).count(),
            "em_cotacao": PedidoCompra.objects.filter(
                is_active=True, status="em_cotacao",
            ).count(),
            "aguardando_aprovacao": OrdemCompra.objects.filter(
                is_active=True, status="pendente_aprovacao",
            ).count(),
            "aprovadas_hoje": OrdemCompra.objects.filter(
                is_active=True, status="aprovada", aprovado_em__date=hoje,
            ).count(),
        }
        serializer = DashboardComprasSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)
