"""
Paddock Solutions — Purchasing — Views
"""
import datetime
import logging
from collections import defaultdict

from django.core.cache import cache
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import mixins, status, viewsets
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
from apps.purchasing.models import AprovacaoCotacao, CotacaoLog, ItemOrdemCompra, OrdemCompra, PedidoCompra, RespostaCotacao
from apps.purchasing.serializers import (
    AdicionarItemOCInputSerializer,
    AprovacaoCotacaoSerializer,
    CotacaoLogSerializer,
    DashboardComprasSerializer,
    ItemOrdemCompraSerializer,
    OrdemCompraDetailSerializer,
    OrdemCompraListSerializer,
    PedidoCompraSerializer,
    RespostaCotacaoSerializer,
)
from apps.purchasing.services import OrdemCompraService, PedidoCompraService

logger = logging.getLogger(__name__)


class PedidoCompraViewSet(viewsets.ReadOnlyModelViewSet):
    """Pedidos de compra — leitura + ações de fluxo."""

    serializer_class = PedidoCompraSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_queryset(self):  # type: ignore[override]
        qs = PedidoCompra.objects.filter(is_active=True).select_related(
            "service_order", "service_order__insurer", "service_order_part", "solicitado_por",
        )
        # Filtros opcionais
        status_filter = self.request.query_params.get("status")
        if status_filter:
            statuses = [s.strip() for s in status_filter.split(",")]
            qs = qs.filter(status__in=statuses)
        so_filter = self.request.query_params.get("service_order")
        if so_filter:
            qs = qs.filter(service_order_id=so_filter)
        return qs

    @action(
        detail=True,
        methods=["post"],
        url_path="iniciar-cotacao",
        permission_classes=[IsAuthenticated, IsStorekeeperOrAbove],
    )
    def iniciar_cotacao(self, request: Request, pk: str = None) -> Response:
        """Mover pedido para status em_cotacao."""
        try:
            pedido = PedidoCompraService.iniciar_cotacao(
                pedido_id=pk, user_id=request.user.pk,
            )
            return Response(
                PedidoCompraSerializer(pedido).data, status=status.HTTP_200_OK,
            )
        except PedidoCompra.DoesNotExist:
            return Response(
                {"detail": "Pedido de compra nao encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception:
            logger.exception("Erro ao iniciar cotacao do pedido %s", pk)
            return Response(
                {"detail": "Erro interno ao processar requisicao."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(
        detail=True,
        methods=["post"],
        url_path="cancelar",
        permission_classes=[IsAuthenticated, IsStorekeeperOrAbove],
    )
    def cancelar(self, request: Request, pk: str = None) -> Response:
        """Cancelar pedido de compra."""
        motivo = request.data.get("motivo", "")
        try:
            PedidoCompraService.cancelar(
                pedido_id=pk, user_id=request.user.pk, motivo=motivo,
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except PedidoCompra.DoesNotExist:
            return Response(
                {"detail": "Pedido de compra nao encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception:
            logger.exception("Erro ao cancelar pedido %s", pk)
            return Response(
                {"detail": "Erro interno ao processar requisicao."},
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
            statuses = [s.strip() for s in status_filter.split(",")]
            qs = qs.filter(status__in=statuses)
        so_filter = self.request.query_params.get("service_order")
        if so_filter:
            qs = qs.filter(service_order_id=so_filter)
        return qs

    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        """Cria OC via OrdemCompraService (PC-4: uma por OS)."""
        service_order_id = request.data.get("service_order")
        if not service_order_id:
            return Response(
                {"detail": "Campo service_order e obrigatorio."},
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
                {"detail": "Nao foi possivel criar a ordem de compra."},
                status=status.HTTP_409_CONFLICT,
            )
        except Exception:
            logger.exception("Erro ao criar OC para OS %s", service_order_id)
            return Response(
                {"detail": "Erro interno ao processar requisicao."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(
        detail=True,
        methods=["post"],
        url_path="enviar",
        permission_classes=[IsAuthenticated, IsStorekeeperOrAbove],
    )
    def enviar(self, request: Request, pk: str = None) -> Response:
        """Enviar OC para aprovacao."""
        try:
            oc = OrdemCompraService.enviar_para_aprovacao(
                oc_id=pk, user_id=request.user.pk,
            )
            return Response(
                OrdemCompraListSerializer(oc).data, status=status.HTTP_200_OK,
            )
        except OrdemCompra.DoesNotExist:
            return Response(
                {"detail": "Ordem de compra nao encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except ValueError:
            return Response(
                {"detail": "OC sem itens nao pode ser enviada para aprovacao."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            logger.exception("Erro ao enviar OC %s para aprovacao", pk)
            return Response(
                {"detail": "Erro interno ao processar requisicao."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(
        detail=True,
        methods=["post"],
        url_path="aprovar",
        permission_classes=[IsAuthenticated, IsManagerOrAbove],
    )
    def aprovar(self, request: Request, pk: str = None) -> Response:
        """Aprovar OC (MANAGER+)."""
        try:
            oc = OrdemCompraService.aprovar(oc_id=pk, user_id=request.user.pk)
            return Response(
                OrdemCompraListSerializer(oc).data, status=status.HTTP_200_OK,
            )
        except OrdemCompra.DoesNotExist:
            return Response(
                {"detail": "Ordem de compra nao encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except ValueError:
            return Response(
                {"detail": "OC nao esta pendente de aprovacao."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            logger.exception("Erro ao aprovar OC %s", pk)
            return Response(
                {"detail": "Erro interno ao processar requisicao."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(
        detail=True,
        methods=["post"],
        url_path="rejeitar",
        permission_classes=[IsAuthenticated, IsManagerOrAbove],
    )
    def rejeitar(self, request: Request, pk: str = None) -> Response:
        """Rejeitar OC (MANAGER+) com motivo obrigatorio."""
        motivo = request.data.get("motivo", "")
        if not motivo:
            return Response(
                {"detail": "Campo motivo e obrigatorio."},
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
                {"detail": "Ordem de compra nao encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception:
            logger.exception("Erro ao rejeitar OC %s", pk)
            return Response(
                {"detail": "Erro interno ao processar requisicao."},
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
                {"detail": "Ordem de compra nao encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception:
            logger.exception("Erro ao adicionar item a OC %s", oc_id)
            return Response(
                {"detail": "Erro interno ao processar requisicao."},
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
                {"detail": "Erro interno ao processar requisicao."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class RegistrarRecebimentoView(APIView):
    """POST /ordens-compra/<oc_id>/itens/<item_id>/receber/ — registra recebimento."""

    permission_classes = [IsAuthenticated, IsStorekeeperOrAbove]

    def post(self, request: Request, oc_id: str, item_id: str) -> Response:
        unidade_fisica_id = request.data.get("unidade_fisica_id")
        if not unidade_fisica_id:
            return Response(
                {"detail": "Campo unidade_fisica_id e obrigatorio."},
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
                {"detail": "Erro interno ao processar requisicao."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class CotacaoLogViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    serializer_class = CotacaoLogSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_queryset(self):  # type: ignore[override]
        qs = CotacaoLog.objects.filter(is_active=True).select_related(
            "supplier", "supplier_contact", "enviado_por"
        )
        so = self.request.query_params.get("service_order")
        if so:
            qs = qs.filter(service_order_id=so)
        pedido = self.request.query_params.get("pedido_compra")
        if pedido:
            qs = qs.filter(pedidos_incluidos=pedido)
        return qs

    def perform_create(self, serializer: CotacaoLogSerializer) -> None:
        log = serializer.save(enviado_por=self.request.user)
        pedido_ids = self.request.data.get("pedido_ids", [])
        if pedido_ids:
            log.pedidos_incluidos.set(pedido_ids)


class RespostaCotacaoViewSet(viewsets.ModelViewSet):
    serializer_class = RespostaCotacaoSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_queryset(self):  # type: ignore[override]
        qs = RespostaCotacao.objects.filter(is_active=True).select_related(
            "supplier", "registrado_por", "pedido_compra"
        )
        pedido = self.request.query_params.get("pedido_compra")
        if pedido:
            qs = qs.filter(pedido_compra_id=pedido)
        so = self.request.query_params.get("service_order")
        if so:
            qs = qs.filter(pedido_compra__service_order_id=so)
        return qs

    def perform_create(self, serializer: RespostaCotacaoSerializer) -> None:
        serializer.save(registrado_por=self.request.user)

    @action(detail=True, methods=["post"], url_path="selecionar")
    def selecionar(self, request: Request, pk: str | None = None) -> Response:
        resposta = self.get_object()
        RespostaCotacao.objects.filter(
            pedido_compra=resposta.pedido_compra, is_active=True
        ).update(selecionada=False)
        resposta.selecionada = True
        resposta.save(update_fields=["selecionada", "updated_at"])
        return Response(RespostaCotacaoSerializer(resposta).data)


class AprovacaoCotacaoViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Aprovações de cotação — financeiro aprova e gera OCs por fornecedor."""

    serializer_class = AprovacaoCotacaoSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_queryset(self):  # type: ignore[override]
        qs = AprovacaoCotacao.objects.filter(is_active=True).select_related(
            "service_order", "service_order__insurer", "enviado_por", "aprovado_por",
        )
        status_filter = self.request.query_params.get("status")
        if status_filter:
            statuses = [s.strip() for s in status_filter.split(",")]
            qs = qs.filter(status__in=statuses)
        return qs

    def perform_create(self, serializer: AprovacaoCotacaoSerializer) -> None:
        serializer.save(enviado_por=self.request.user)

    @action(
        detail=True,
        methods=["post"],
        url_path="aprovar",
        permission_classes=[IsAuthenticated, IsManagerOrAbove],
    )
    def aprovar(self, request: Request, pk: str | None = None) -> Response:
        """Financeiro seleciona fornecedores e aprova, gerando uma OC por fornecedor.

        Body JSON:
        {
            "selecoes": [
                {"pedido_compra_id": "uuid", "resposta_cotacao_id": "uuid"},
                ...
            ],
            "observacoes_financeiro": "opcional"
        }
        """
        aprovacao = self.get_object()
        if aprovacao.status != AprovacaoCotacao.Status.PENDENTE:
            return Response(
                {"detail": "Aprovação já processada."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        selecoes = request.data.get("selecoes", [])
        if not selecoes:
            return Response(
                {"detail": "Selecione ao menos uma resposta."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Reset todas as seleções da OS
        RespostaCotacao.objects.filter(
            pedido_compra__service_order=aprovacao.service_order,
            is_active=True,
        ).update(selecionada=False)

        # Marcar respostas selecionadas e agrupar por fornecedor
        supplier_groups: dict[str, list[RespostaCotacao]] = defaultdict(list)
        for sel in selecoes:
            try:
                resp = RespostaCotacao.objects.select_related(
                    "supplier", "pedido_compra"
                ).get(id=sel["resposta_cotacao_id"], is_active=True)
            except RespostaCotacao.DoesNotExist:
                continue
            resp.selecionada = True
            resp.save(update_fields=["selecionada", "updated_at"])
            supplier_groups[str(resp.supplier_id)].append(resp)

        # Criar uma OC por fornecedor
        created_ocs = []
        obs_financeiro = request.data.get("observacoes_financeiro", "")
        year = datetime.date.today().year

        for _supplier_id, respostas in supplier_groups.items():
            last_oc = OrdemCompra.objects.filter(
                numero__startswith=f"OC-{year}"
            ).order_by("-numero").first()
            seq = (int(last_oc.numero.split("-")[-1]) + 1) if last_oc else 1
            numero = f"OC-{year}-{seq:04d}"

            oc = OrdemCompra.objects.create(
                numero=numero,
                service_order=aprovacao.service_order,
                status=OrdemCompra.Status.APROVADA,
                criado_por=aprovacao.enviado_por,
                aprovado_por=request.user,
                aprovado_em=timezone.now(),
                observacoes=obs_financeiro,
            )

            for resp in respostas:
                ItemOrdemCompra.objects.create(
                    ordem_compra=oc,
                    pedido_compra=resp.pedido_compra,
                    fornecedor_nome=resp.supplier.name,
                    fornecedor_cnpj=getattr(resp.supplier, "cnpj", "") or "",
                    descricao=resp.pedido_compra.descricao,
                    codigo_referencia=resp.pedido_compra.codigo_referencia,
                    tipo_qualidade=resp.pedido_compra.tipo_qualidade,
                    quantidade=resp.pedido_compra.quantidade,
                    valor_unitario=resp.valor_unitario,
                    valor_total=resp.valor_unitario * resp.pedido_compra.quantidade,
                    prazo_entrega=resp.prazo_entrega,
                    observacoes=resp.observacoes,
                )
                resp.pedido_compra.status = PedidoCompra.Status.APROVADO
                resp.pedido_compra.save(update_fields=["status", "updated_at"])

            oc.recompute_total()
            created_ocs.append(oc)

        aprovacao.status = AprovacaoCotacao.Status.APROVADA
        aprovacao.aprovado_por = request.user
        aprovacao.aprovado_em = timezone.now()
        aprovacao.observacoes_financeiro = obs_financeiro
        aprovacao.save()

        return Response({
            "detail": f"{len(created_ocs)} ordem(ns) de compra gerada(s).",
            "ordens_compra": [{"id": str(oc.id), "numero": oc.numero} for oc in created_ocs],
        })

    @action(
        detail=True,
        methods=["post"],
        url_path="rejeitar",
        permission_classes=[IsAuthenticated, IsManagerOrAbove],
    )
    def rejeitar(self, request: Request, pk: str | None = None) -> Response:
        """Financeiro rejeita cotação e devolve para o comprador."""
        aprovacao = self.get_object()
        if aprovacao.status != AprovacaoCotacao.Status.PENDENTE:
            return Response(
                {"detail": "Aprovação já processada."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        aprovacao.status = AprovacaoCotacao.Status.REJEITADA
        aprovacao.aprovado_por = request.user
        aprovacao.aprovado_em = timezone.now()
        aprovacao.motivo_rejeicao = request.data.get("motivo_rejeicao", "")
        aprovacao.save()
        return Response(AprovacaoCotacaoSerializer(aprovacao).data)


class DashboardComprasView(APIView):
    """GET /dashboard-stats/ — contadores para o dashboard de compras."""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get(self, request: Request) -> Response:
        cached = cache.get("dashboard:compras")
        if cached:
            return Response(DashboardComprasSerializer(cached).data)

        pedido_counts = PedidoCompra.objects.filter(is_active=True).aggregate(
            solicitados=Count("id", filter=Q(status="solicitado")),
            em_cotacao=Count("id", filter=Q(status="em_cotacao")),
        )
        oc_counts = OrdemCompra.objects.filter(is_active=True).aggregate(
            aguardando_aprovacao=Count("id", filter=Q(status="pendente_aprovacao")),
            aprovadas_hoje=Count("id", filter=Q(
                status="aprovada",
                aprovado_em__date=timezone.now().date(),
            )),
        )
        data = {**pedido_counts, **oc_counts}
        cache.set("dashboard:compras", data, timeout=60)
        return Response(DashboardComprasSerializer(data).data, status=status.HTTP_200_OK)
