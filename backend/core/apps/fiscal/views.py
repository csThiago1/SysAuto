"""
Paddock Solutions — Fiscal — Views DRF
Motor de Orçamentos (MO) — Sprint MO-5: NF-e Entrada

RBAC:
  - Leitura: CONSULTANT+
  - Criação/reconciliação: MANAGER+
  - Geração de estoque: MANAGER+
"""
import logging

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove
from apps.fiscal.models import NFeEntrada, NFeEntradaItem
from apps.fiscal.serializers import (
    NFeEntradaCreateSerializer,
    NFeEntradaDetailSerializer,
    NFeEntradaItemReconciliarSerializer,
    NFeEntradaItemSerializer,
    NFeEntradaListSerializer,
)
from apps.fiscal.services.ingestao import EstoqueJaGerado, NFeIngestaoService

logger = logging.getLogger(__name__)


class NFeEntradaViewSet(viewsets.ModelViewSet):
    """CRUD de NF-e de Entrada + ações: reconciliar item e gerar estoque."""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_queryset(self):  # type: ignore[override]
        qs = NFeEntrada.objects.filter(is_active=True).prefetch_related("itens").order_by("-created_at")

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        emitente = self.request.query_params.get("emitente")
        if emitente:
            qs = qs.filter(emitente_nome__icontains=emitente)

        return qs

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == "retrieve":
            return NFeEntradaDetailSerializer
        if self.action in ("create",):
            return NFeEntradaCreateSerializer
        return NFeEntradaListSerializer

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy",
                           "reconciliar_item", "gerar_estoque"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    @action(detail=True, methods=["post"], url_path=r"itens/(?P<item_pk>[^/.]+)/reconciliar")
    def reconciliar_item(self, request: Request, pk: str | None = None, item_pk: str | None = None) -> Response:
        """Reconcilia um NFeEntradaItem com peça ou material canônico."""
        nfe = self.get_object()
        try:
            item = nfe.itens.get(pk=item_pk)
        except NFeEntradaItem.DoesNotExist:
            return Response({"detail": "Item não encontrado."}, status=status.HTTP_404_NOT_FOUND)

        ser = NFeEntradaItemReconciliarSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        item.status_reconciliacao = ser.validated_data["status_reconciliacao"]
        if "peca_canonica_id" in ser.validated_data:
            item.peca_canonica_id = ser.validated_data.get("peca_canonica_id")
        if "material_canonico_id" in ser.validated_data:
            item.material_canonico_id = ser.validated_data.get("material_canonico_id")
        if "codigo_fornecedor_id" in ser.validated_data:
            item.codigo_fornecedor_id = ser.validated_data.get("codigo_fornecedor_id")
        item.save()

        return Response(NFeEntradaItemSerializer(item).data)

    @action(detail=True, methods=["post"], url_path="gerar-estoque")
    def gerar_estoque(self, request: Request, pk: str | None = None) -> Response:
        """Gera registros de estoque (UnidadeFisica / LoteInsumo) para a NF-e.

        Idempotente: retorna erro se estoque já foi gerado (P10).
        """
        nfe = self.get_object()
        try:
            resultado = NFeIngestaoService.criar_registros_estoque(str(nfe.pk))
        except EstoqueJaGerado:
            return Response(
                {"detail": "Estoque já gerado para esta NF-e."},
                status=status.HTTP_409_CONFLICT,
            )
        except Exception as exc:
            logger.error("Erro ao gerar estoque para NF-e %s: %s", pk, type(exc).__name__)
            return Response(
                {"detail": "Erro ao gerar estoque."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(resultado, status=status.HTTP_201_CREATED)
