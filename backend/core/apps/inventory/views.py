"""
Paddock Solutions — Inventory — Views DRF
Motor de Orçamentos (MO) — Sprint MO-5: Estoque Físico + NF-e Entrada

RBAC:
  - List/get de unidades/lotes: CONSULTANT+
  - Reserva/baixa: CONSULTANT+ (operação do dia-a-dia)
  - Config impressora: MANAGER+
  - forcar_mais_caro=True: ADMIN+ (auditoria obrigatória — P7)
"""
import logging

from rest_framework import status, viewsets
from rest_framework.decorators import action
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
from apps.inventory.models import ImpressoraEtiqueta, LoteInsumo, UnidadeFisica
from apps.inventory.serializers import (
    BaixaInsumoInputSerializer,
    BipagemInputSerializer,
    ImpressoraEtiquetaSerializer,
    LoteInsumoListSerializer,
    ReservaInputSerializer,
    UnidadeFisicaDetailSerializer,
    UnidadeFisicaListSerializer,
)
from apps.inventory.services.reserva import BaixaInsumoService, ReservaIndisponivel, ReservaUnidadeService

logger = logging.getLogger(__name__)


class UnidadeFisicaViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Listagem e detalhe de UnidadeFisica.
    valor_nf só aparece no detalhe para MANAGER+.
    """

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_queryset(self):  # type: ignore[override]
        qs = UnidadeFisica.objects.filter(is_active=True).select_related(
            "peca_canonica", "nfe_entrada",
        ).order_by("-created_at")

        peca_id = self.request.query_params.get("peca")
        if peca_id:
            qs = qs.filter(peca_canonica_id=peca_id)

        st = self.request.query_params.get("status")
        if st:
            qs = qs.filter(status=st)

        return qs

    def get_serializer_class(self):  # type: ignore[override]
        role = _get_role(self.request)
        if self.action == "retrieve" and role in ("MANAGER", "ADMIN", "OWNER"):
            return UnidadeFisicaDetailSerializer
        return UnidadeFisicaListSerializer

    @action(detail=True, methods=["post"], url_path="reservar")
    def reservar(self, request: Request, pk: str | None = None) -> Response:
        """Reserva esta unidade para uma OS. ADMIN+ pode usar forcar_mais_caro (P7)."""
        unidade = self.get_object()
        ser = ReservaInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        forcar = ser.validated_data.get("forcar_mais_caro", False)
        role = _get_role(request)

        if forcar and role not in ("ADMIN", "OWNER"):
            return Response(
                {"detail": "forcar_mais_caro requer papel ADMIN ou OWNER."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if unidade.status != "available":
            return Response(
                {"detail": f"Unidade não está disponível (status={unidade.status})."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            ReservaUnidadeService.reservar(
                peca_canonica_id=str(unidade.peca_canonica_id),
                quantidade=1,
                ordem_servico_id=str(ser.validated_data["ordem_servico_id"]),
                forcar_mais_caro=forcar,
                user_id=str(request.user.pk) if request.user else None,
            )
        except ReservaIndisponivel as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        unidade.refresh_from_db()
        return Response(UnidadeFisicaListSerializer(unidade).data)

    @action(detail=False, methods=["post"], url_path="bipagem")
    def bipagem(self, request: Request) -> Response:
        """Resolve codigo_barras → UnidadeFisica e reserva para a OS."""
        ser = BipagemInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        try:
            unidade = ReservaUnidadeService.baixar_por_bipagem(
                codigo_barras=ser.validated_data["codigo_barras"],
                ordem_servico_id=str(ser.validated_data["ordem_servico_id"]),
            )
        except ReservaIndisponivel as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(UnidadeFisicaListSerializer(unidade).data, status=status.HTTP_200_OK)

    @action(
        detail=True, methods=["post"], url_path="imprimir-etiqueta",
        permission_classes=[IsAuthenticated, IsConsultantOrAbove],
    )
    def imprimir_etiqueta(self, request: Request, pk: str | None = None) -> Response:
        """Dispara impressão de etiqueta via Celery (P6)."""
        unidade = self.get_object()
        impressora = ImpressoraEtiqueta.objects.filter(is_active=True).first()
        if not impressora:
            return Response({"detail": "Sem impressora ativa."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        from apps.inventory.models import EtiquetaImpressa
        from apps.inventory.services.etiqueta import ZPLService
        try:
            zpl = ZPLService.gerar_zpl_peca(unidade)
            ZPLService.imprimir(zpl, impressora)
            EtiquetaImpressa.objects.create(
                unidade_fisica=unidade, impressora=impressora, zpl_payload=zpl,
            )
        except Exception as e:
            logger.error("Erro ao imprimir etiqueta unidade %s: %s", pk, type(e).__name__)
            return Response({"detail": "Erro ao imprimir etiqueta."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response({"detail": "Etiqueta impressa."})


class LoteInsumoViewSet(viewsets.ReadOnlyModelViewSet):
    """Listagem e detalhe de LoteInsumo."""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]
    serializer_class = LoteInsumoListSerializer

    def get_queryset(self):  # type: ignore[override]
        qs = LoteInsumo.objects.filter(is_active=True).select_related(
            "material_canonico",
        ).order_by("created_at")

        material_id = self.request.query_params.get("material")
        if material_id:
            qs = qs.filter(material_canonico_id=material_id)

        if self.request.query_params.get("saldo_gt") == "0":
            qs = qs.filter(saldo__gt=0)

        return qs

    @action(
        detail=True, methods=["post"], url_path="imprimir-etiqueta",
        permission_classes=[IsAuthenticated, IsConsultantOrAbove],
    )
    def imprimir_etiqueta(self, request: Request, pk: str | None = None) -> Response:
        lote = self.get_object()
        impressora = ImpressoraEtiqueta.objects.filter(is_active=True).first()
        if not impressora:
            return Response({"detail": "Sem impressora ativa."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        from apps.inventory.models import EtiquetaImpressa
        from apps.inventory.services.etiqueta import ZPLService
        try:
            zpl = ZPLService.gerar_zpl_lote(lote)
            ZPLService.imprimir(zpl, impressora)
            EtiquetaImpressa.objects.create(lote_insumo=lote, impressora=impressora, zpl_payload=zpl)
        except Exception as e:
            logger.error("Erro ao imprimir etiqueta lote %s: %s", pk, type(e).__name__)
            return Response({"detail": "Erro ao imprimir etiqueta."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response({"detail": "Etiqueta impressa."})


class BaixarInsumoView(APIView):
    """Baixa de insumo via FIFO em uma OS. CONSULTANT+."""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def post(self, request: Request) -> Response:
        ser = BaixaInsumoInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        try:
            consumos = BaixaInsumoService.baixar(
                material_canonico_id=str(ser.validated_data["material_canonico_id"]),
                quantidade_base=ser.validated_data["quantidade_base"],
                ordem_servico_id=str(ser.validated_data["ordem_servico_id"]),
                user_id=str(request.user.pk) if request.user else None,
            )
        except ReservaIndisponivel as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"consumos_criados": len(consumos)}, status=status.HTTP_201_CREATED)


class ImpressoraEtiquetaViewSet(viewsets.ModelViewSet):
    """CRUD de impressoras. MANAGER+."""

    serializer_class = ImpressoraEtiquetaSerializer

    def get_queryset(self):  # type: ignore[override]
        return ImpressoraEtiqueta.objects.filter(is_active=True)

    def get_permissions(self) -> list:  # type: ignore[override]
        return [IsAuthenticated(), IsManagerOrAbove()]

    @action(detail=True, methods=["post"], url_path="testar")
    def testar(self, request: Request, pk: str | None = None) -> Response:
        """Envia ZPL de teste para verificar conectividade."""
        impressora = self.get_object()
        zpl_teste = "^XA^FO50,50^A0N,40,40^FDTESTE PADDOCK^FS^XZ"

        from apps.inventory.services.etiqueta import ZPLService
        try:
            ZPLService.imprimir(zpl_teste, impressora)
        except Exception as e:
            logger.error("Teste impressora %s falhou: %s", impressora.nome, type(e).__name__)
            return Response({"detail": "Impressora não respondeu."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response({"detail": f"Impressora {impressora.nome} respondeu."})
