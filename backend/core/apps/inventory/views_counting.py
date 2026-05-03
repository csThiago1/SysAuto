"""
Paddock Solutions — Inventory — Views de Contagem de Inventario
Endpoints para abertura, registro de itens, finalizacao e cancelamento.

RBAC:
  - Abertura/registro de itens: STOREKEEPER+
  - Listagem/detalhe: CONSULTANT+
  - Finalizacao/cancelamento: MANAGER+
"""
import logging

from django.db.models import Count, Q
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
from apps.inventory.models_counting import ContagemInventario, ItemContagem
from apps.inventory.serializers_counting import (
    AbrirContagemInputSerializer,
    ContagemInventarioDetailSerializer,
    ContagemInventarioSerializer,
    ItemContagemSerializer,
    RegistrarItemInputSerializer,
)
from apps.inventory.services.contagem import ContagemService

logger = logging.getLogger(__name__)


class ContagemViewSet(viewsets.ModelViewSet):
    """
    CRUD de contagens de inventario.
    - list/retrieve: CONSULTANT+
    - create: STOREKEEPER+
    - finalizar/cancelar: MANAGER+
    """

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action == "create":
            return [IsAuthenticated(), IsStorekeeperOrAbove()]
        if self.action in ("finalizar", "cancelar"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == "retrieve":
            return ContagemInventarioDetailSerializer
        return ContagemInventarioSerializer

    def get_queryset(self):  # type: ignore[override]
        return (
            ContagemInventario.objects.filter(is_active=True)
            .select_related("armazem", "rua", "iniciado_por", "fechado_por")
            .annotate(
                total_itens=Count("itens"),
                total_contados=Count(
                    "itens",
                    filter=Q(itens__quantidade_contada__isnull=False),
                ),
                total_divergencias=Count(
                    "itens",
                    filter=~Q(itens__divergencia=0)
                    & Q(itens__quantidade_contada__isnull=False),
                ),
            )
            .order_by("-data_abertura")
        )

    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        """Abre nova contagem via ContagemService."""
        serializer = AbrirContagemInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            contagem = ContagemService.abrir_contagem(
                tipo=data["tipo"],
                user_id=request.user.id,
                armazem_id=data.get("armazem_id"),
                rua_id=data.get("rua_id"),
            )
        except Exception as e:
            logger.error("Erro ao abrir contagem: %s", e)
            return Response(
                {"erro": "Erro ao abrir contagem."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Re-fetch with annotations
        contagem_qs = self.get_queryset().filter(pk=contagem.pk).first()
        return Response(
            ContagemInventarioSerializer(contagem_qs).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="finalizar")
    def finalizar(self, request: Request, pk: str = None) -> Response:
        """MANAGER+: finaliza contagem e gera ajustes."""
        try:
            contagem = ContagemService.finalizar_contagem(
                contagem_id=pk,
                user_id=request.user.id,
            )
        except ValueError as e:
            return Response(
                {"erro": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error("Erro ao finalizar contagem: %s", e)
            return Response(
                {"erro": "Erro ao finalizar contagem."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        contagem_qs = self.get_queryset().filter(pk=contagem.pk).first()
        return Response(ContagemInventarioSerializer(contagem_qs).data)

    @action(detail=True, methods=["post"], url_path="cancelar")
    def cancelar(self, request: Request, pk: str = None) -> Response:
        """MANAGER+: cancela contagem aberta/em andamento."""
        motivo = request.data.get("motivo", "")
        try:
            contagem = ContagemService.cancelar_contagem(
                contagem_id=pk,
                user_id=request.user.id,
                motivo=motivo,
            )
        except ValueError as e:
            return Response(
                {"erro": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error("Erro ao cancelar contagem: %s", e)
            return Response(
                {"erro": "Erro ao cancelar contagem."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        contagem_qs = self.get_queryset().filter(pk=contagem.pk).first()
        return Response(ContagemInventarioSerializer(contagem_qs).data)


class RegistrarItemView(APIView):
    """PATCH contagens/{contagem_id}/itens/{item_id}/ — Registra quantidade contada. STOREKEEPER+."""

    permission_classes = [IsAuthenticated, IsStorekeeperOrAbove]

    def patch(self, request: Request, contagem_id: str, item_id: str) -> Response:
        # Validate item belongs to contagem and contagem is active
        try:
            item = ItemContagem.objects.select_related(
                "contagem",
            ).get(
                pk=item_id,
                contagem_id=contagem_id,
                contagem__is_active=True,
            )
        except ItemContagem.DoesNotExist:
            return Response(
                {"erro": "Item de contagem nao encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if item.contagem.status in (
            ContagemInventario.Status.FINALIZADA,
            ContagemInventario.Status.CANCELADA,
        ):
            return Response(
                {"erro": "Contagem ja finalizada ou cancelada."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RegistrarItemInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            item = ContagemService.registrar_item(
                item_id=item.pk,
                quantidade_contada=data["quantidade_contada"],
                user_id=request.user.id,
                observacao=data.get("observacao", ""),
            )
        except Exception as e:
            logger.error("Erro ao registrar item de contagem: %s", e)
            return Response(
                {"erro": "Erro ao registrar item."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(ItemContagemSerializer(item).data)
