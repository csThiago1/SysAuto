"""
Paddock Solutions — Fiscal — Views DRF
Motor de Orçamentos (MO) — Sprint MO-5: NF-e Entrada
Ciclo 06B: FocusWebhookView

RBAC:
  - Leitura: CONSULTANT+
  - Criação/reconciliação: MANAGER+
  - Geração de estoque: MANAGER+
  - Webhook: AllowAny (autenticação via secret no path)
"""

import logging

from django.conf import settings
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove
from apps.fiscal.models import FiscalDocument, FiscalEvent, NFeEntrada, NFeEntradaItem
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
        qs = (
            NFeEntrada.objects.filter(is_active=True)
            .prefetch_related("itens")
            .order_by("-created_at")
        )

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
        if self.action in (
            "create",
            "update",
            "partial_update",
            "destroy",
            "reconciliar_item",
            "gerar_estoque",
        ):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    @action(detail=True, methods=["post"], url_path=r"itens/(?P<item_pk>[^/.]+)/reconciliar")
    def reconciliar_item(
        self, request: Request, pk: str | None = None, item_pk: str | None = None
    ) -> Response:
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


# ─── 06B: Webhook Focus NF-e ────────────────────────────────────────────────


class FocusWebhookView(APIView):
    """Receiver de webhooks da Focus NF-e v2.

    Autenticação via secret no path (sem JWT — Focus envia sem header de auth).
    Idempotência: (document, event_type, payload.evento) já processado → 200 imediato.
    Princípio: aceitar rápido, processar de forma assíncrona via Celery.

    URL: POST /api/v1/fiscal/webhooks/focus/{secret}/
    """

    permission_classes = [AllowAny]
    authentication_classes: list = []  # Autenticação via secret no path

    def post(self, request: Request, secret: str) -> Response:
        """Processa evento de webhook da Focus.

        Valida secret, registra FiscalEvent e agenda poll_fiscal_document.

        Returns:
            200 em qualquer caso válido (Focus reprocessa se não receber 2xx).
            403 se secret inválido.
        """
        # Validar secret no path
        if secret != settings.FOCUS_NFE_WEBHOOK_SECRET:
            logger.warning("FocusWebhookView: secret inválido recebido.")
            return Response(status=status.HTTP_403_FORBIDDEN)

        payload = request.data
        ref: str | None = payload.get("ref")
        evento: str | None = payload.get("evento")

        if not ref or not evento:
            logger.warning("FocusWebhookView: payload sem ref/evento: %s", list(payload.keys()))
            return Response(
                {"error": "Campos obrigatórios ausentes: ref, evento"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Buscar documento
        doc = FiscalDocument.objects.filter(key=ref).first()

        if doc is None:
            # Documento não encontrado — registrar evento orphan e retornar OK
            # (pode ser documento de outro sistema ou emissão antiga)
            logger.info("FocusWebhookView: documento não encontrado para ref=%s", ref)
            FiscalEvent.objects.create(
                document=None,
                event_type="WEBHOOK",
                payload=payload,
                triggered_by="WEBHOOK",
            )
            return Response(status=status.HTTP_200_OK)

        # Idempotência: verificar se já processamos este evento
        already_processed = FiscalEvent.objects.filter(
            document=doc,
            event_type="WEBHOOK",
            payload__evento=evento,
        ).exists()

        if already_processed:
            logger.debug(
                "FocusWebhookView: evento duplicado para doc=%s, evento=%s — skip.",
                doc.pk,
                evento,
            )
            return Response(status=status.HTTP_200_OK)

        # Registrar evento
        FiscalEvent.objects.create(
            document=doc,
            event_type="WEBHOOK",
            payload=payload,
            triggered_by="WEBHOOK",
        )

        # Agendar consulta (consulta autoritativa — não confiar 100% no payload do webhook)
        from apps.fiscal.tasks import poll_fiscal_document  # lazy import

        poll_fiscal_document.apply_async(args=[str(doc.pk)], countdown=2)

        logger.info(
            "FocusWebhookView: evento %s processado para doc=%s — poll agendado.",
            evento,
            doc.pk,
        )
        return Response(status=status.HTTP_200_OK)
