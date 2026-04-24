"""
Paddock Solutions — Fiscal — Views DRF
Motor de Orçamentos (MO) — Sprint MO-5: NF-e Entrada
Ciclo 06B: FocusWebhookView
Ciclo 06C: NfseEmitView, NfseEmitManualView, FiscalDocumentViewSet

RBAC:
  - Leitura: CONSULTANT+
  - Criação/reconciliação: MANAGER+
  - Geração de estoque: MANAGER+
  - Emissão NFS-e automática: CONSULTANT+
  - Emissão NFS-e manual: ADMIN+
  - Cancelamento: MANAGER+
  - Webhook: AllowAny (autenticação via secret no path)
"""

import logging

from django.conf import settings
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import (
    IsAdminOrAbove,
    IsConsultantOrAbove,
    IsManagerOrAbove,
)
from apps.fiscal.clients.focus_nfe_client import FocusNFeClient
from apps.fiscal.models import FiscalDocument, FiscalEvent, NFeEntrada, NFeEntradaItem
from apps.fiscal.serializers import (
    FiscalDocumentListSerializer,
    FiscalDocumentSerializer,
    ManualNfseInputSerializer,
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

        # Buscar documento — 06C usa campo ref; fallback em key para registros legados
        doc = FiscalDocument.objects.filter(ref=ref).first()
        if doc is None:
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


# ─── 06C: Emissão NFS-e ──────────────────────────────────────────────────────


class NfseEmitView(APIView):
    """Emite NFS-e a partir de uma OS.

    Body: {"service_order_id": "uuid"}
    Retorna: FiscalDocumentSerializer
    RBAC: CONSULTANT+
    """

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def post(self, request: Request) -> Response:
        from apps.fiscal.exceptions import FiscalDocumentAlreadyAuthorized
        from apps.fiscal.services.fiscal_service import FiscalService
        from apps.service_orders.models import ServiceOrder

        service_order_id = request.data.get("service_order_id")
        if not service_order_id:
            return Response(
                {"detail": "service_order_id obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            order = ServiceOrder.objects.prefetch_related(
                "fiscal_documents"
            ).get(pk=service_order_id, is_active=True)
        except ServiceOrder.DoesNotExist:
            return Response({"detail": "OS não encontrada."}, status=status.HTTP_404_NOT_FOUND)

        if order.customer_type != "private":
            return Response(
                {"detail": "NFS-e só aplicável a OS de cliente particular."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            doc = FiscalService.emit_nfse(order)
        except FiscalDocumentAlreadyAuthorized:
            return Response(
                {"detail": "OS já possui NFS-e autorizada."},
                status=status.HTTP_409_CONFLICT,
            )
        except Exception as exc:
            from apps.fiscal.exceptions import FocusNFeError, NfseBuilderError, FiscalValidationError
            if isinstance(exc, (FocusNFeError, NfseBuilderError, FiscalValidationError)):
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            logger.error("NfseEmitView: erro ao emitir NFS-e para OS %s: %s", service_order_id, exc)
            return Response(
                {"detail": "Erro ao emitir NFS-e."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(FiscalDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)


class NfseEmitManualView(APIView):
    """Emite NFS-e manual (ad-hoc, sem OS vinculada).

    RBAC: ADMIN+
    """

    permission_classes = [IsAuthenticated, IsAdminOrAbove]

    def post(self, request: Request) -> Response:
        from apps.fiscal.exceptions import FiscalValidationError, NfseBuilderError
        from apps.fiscal.services.fiscal_service import FiscalService

        ser = ManualNfseInputSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            doc = FiscalService.emit_manual_nfse(ser.validated_data, user=request.user)
        except (NfseBuilderError, FiscalValidationError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            from apps.fiscal.exceptions import FocusNFeError
            if isinstance(exc, FocusNFeError):
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            logger.error("NfseEmitManualView: erro ao emitir NFS-e manual: %s", exc)
            return Response(
                {"detail": "Erro ao emitir NFS-e manual."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(FiscalDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)


class FiscalDocumentViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista e detalhe de documentos fiscais.

    DELETE (action cancel): MANAGER+ cancela documento autorizado.
    """

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_queryset(self):  # type: ignore[override]
        qs = FiscalDocument.objects.filter(is_active=True).order_by("-created_at")

        os_id = self.request.query_params.get("service_order")
        if os_id:
            qs = qs.filter(service_order_id=os_id)

        doc_type = self.request.query_params.get("document_type")
        if doc_type:
            qs = qs.filter(document_type=doc_type)

        doc_status = self.request.query_params.get("status")
        if doc_status:
            qs = qs.filter(status=doc_status)

        return qs

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == "retrieve":
            return FiscalDocumentSerializer
        return FiscalDocumentListSerializer

    def destroy(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[override]
        """Cancela documento fiscal autorizado (MANAGER+)."""
        if not IsManagerOrAbove().has_permission(request, self):
            return Response(status=status.HTTP_403_FORBIDDEN)

        from apps.fiscal.exceptions import FiscalInvalidStatus, FiscalValidationError
        from apps.fiscal.services.fiscal_service import FiscalService

        doc = self.get_object()
        justificativa = request.data.get("justificativa", "")

        try:
            doc = FiscalService.cancel(doc, justificativa)
        except FiscalInvalidStatus as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except FiscalValidationError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.error("FiscalDocumentViewSet.destroy: erro ao cancelar doc %s: %s", doc.pk, exc)
            return Response(
                {"detail": "Erro ao cancelar documento."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(FiscalDocumentSerializer(doc).data)


class NfeRecebidaListView(APIView):
    """Lista NF-e recebidas pelo CNPJ do emissor fiscal (pass-through Focus).

    GET  /fiscal/nfe-recebidas/?pagina=1
    RBAC: CONSULTANT+
    """

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get(self, request: Request) -> Response:
        from apps.fiscal.services.fiscal_service import FiscalService

        try:
            config = FiscalService.get_config()
        except Exception:
            return Response(
                {"detail": "Configuração fiscal não encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            pagina = max(1, int(request.query_params.get("pagina", 1)))
        except (ValueError, TypeError):
            pagina = 1

        with FocusNFeClient() as client:
            resp = client.listar_nfes_recebidas(config.cnpj, pagina=pagina)

        if resp.status_code == 200:
            return Response(resp.data or [])
        if resp.status_code == 404:
            return Response([])

        logger.error("NfeRecebidaListView: Focus retornou %s: %s", resp.status_code, resp.data)
        return Response(
            {"detail": "Erro ao consultar NF-e recebidas."},
            status=status.HTTP_502_BAD_GATEWAY,
        )


class NfeRecebidaManifestView(APIView):
    """Manifesta (ciência/confirmação/desconhecimento) de NF-e recebida.

    POST /fiscal/nfe-recebidas/{chave}/manifesto/
    Body: { "tipo_evento": "ciencia_operacao" | "confirmacao_operacao" | "desconhecimento_operacao" }
    RBAC: MANAGER+
    """

    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    def post(self, request: Request, chave: str) -> Response:
        tipo_evento = request.data.get("tipo_evento", "")
        if tipo_evento not in (
            "ciencia_operacao",
            "confirmacao_operacao",
            "desconhecimento_operacao",
            "operacao_nao_realizada",
        ):
            return Response(
                {"detail": "tipo_evento inválido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        justificativa: str = request.data.get("justificativa", "")

        with FocusNFeClient() as client:
            resp = client.manifestar(chave, tipo_evento, justificativa)

        if 200 <= resp.status_code < 300:
            return Response(resp.data or {}, status=status.HTTP_200_OK)

        logger.error(
            "NfeRecebidaManifestView: Focus %s para chave %s: %s",
            resp.status_code,
            chave,
            resp.data,
        )
        return Response(
            resp.data or {"detail": "Erro ao manifestar NF-e."},
            status=status.HTTP_400_BAD_REQUEST,
        )
