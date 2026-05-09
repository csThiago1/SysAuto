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
            resultado = NFeIngestaoService.criar_registros_estoque(
                str(nfe.pk), realizado_por_id=str(request.user.pk)
            )
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
            if isinstance(exc, (NfseBuilderError, FiscalValidationError)):
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            if isinstance(exc, FocusNFeError):
                logger.error("NfseEmitView: erro Focus para OS %s: %s", service_order_id, exc)
                return Response({"detail": "Erro na comunicação com o serviço fiscal."}, status=status.HTTP_400_BAD_REQUEST)
            logger.error("NfseEmitView: erro ao emitir NFS-e para OS %s: %s", service_order_id, exc)
            return Response(
                {"detail": "Erro ao emitir NFS-e."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(FiscalDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)


class NfseSubstituirView(APIView):
    """Substitui uma NFS-e autorizada emitindo uma nova em seu lugar.

    POST /api/v1/fiscal/nfse/substituir/
    Body: {
        "chave_nfse_substituida": "<chave_acesso_da_nota_original>",
        "service_order_id": "<uuid>",           (obrigatório por ora)
        "codigo_justificativa": "01"–"05"|"99"  (default "01")
    }
    Códigos: 01-Erro cadastral, 02-Erro descrição, 03-Erro tributação,
             04-Erro valor, 05-Outros, 99-Não especificado.
    RBAC: ADMIN+
    """

    permission_classes = [IsAuthenticated, IsAdminOrAbove]

    def post(self, request: Request) -> Response:
        from apps.fiscal.exceptions import (
            FiscalDocumentAlreadyAuthorized,
            FocusNFeError,
            FiscalValidationError,
            NfseBuilderError,
        )
        from apps.fiscal.services.fiscal_service import FiscalService

        chave = request.data.get("chave_nfse_substituida")
        if not chave:
            raise ValidationError(
                {"chave_nfse_substituida": "Chave da NFS-e a substituir é obrigatória."}
            )

        codigo = request.data.get("codigo_justificativa", "01")
        if codigo not in ("01", "02", "03", "04", "05", "99"):
            raise ValidationError({"codigo_justificativa": "Código inválido. Use 01–05 ou 99."})

        # Localizar documento original
        try:
            original = FiscalDocument.objects.get(
                key=chave, status="authorized", document_type="nfse"
            )
        except FiscalDocument.DoesNotExist:
            raise ValidationError(
                {"detail": "NFS-e original não encontrada ou não está autorizada."}
            )

        service_order_id = request.data.get("service_order_id")
        if not service_order_id:
            raise ValidationError(
                {"detail": "Substituição manual ainda não implementada. Use service_order_id."}
            )

        try:
            from apps.service_orders.models import ServiceOrder

            so = ServiceOrder.objects.get(pk=service_order_id, is_active=True)
        except ServiceOrder.DoesNotExist:
            return Response({"detail": "OS não encontrada."}, status=status.HTTP_404_NOT_FOUND)

        try:
            result = FiscalService.emit_nfse(
                so,
                extra_payload={
                    "chave_nfse_substituida": chave,
                    "codigo_justificativa_substituicao": codigo,
                },
            )
        except FiscalDocumentAlreadyAuthorized as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)
        except (NfseBuilderError, FiscalValidationError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except FocusNFeError as exc:
            logger.error("NfseSubstituirView: erro Focus para OS %s: %s", service_order_id, exc)
            return Response(
                {"detail": "Erro na comunicação com o serviço fiscal."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            logger.error("NfseSubstituirView: erro inesperado: %s", exc)
            return Response(
                {"detail": "Erro ao substituir NFS-e."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Marcar original como substituída
        original.substituida_por = result
        original.save(update_fields=["substituida_por"])

        return Response(
            {"status": "ok", "nova_ref": result.ref},
            status=status.HTTP_201_CREATED,
        )


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
                logger.error("NfseEmitManualView: erro Focus: %s", exc)
                return Response({"detail": "Erro na comunicação com o serviço fiscal."}, status=status.HTTP_400_BAD_REQUEST)
            logger.error("NfseEmitManualView: erro ao emitir NFS-e manual: %s", exc)
            return Response(
                {"detail": "Erro ao emitir NFS-e manual."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(FiscalDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)


# ─── 07A: Emissão NF-e de Produto ────────────────────────────────────────────


class NfeEmitView(APIView):
    """Emite NF-e de produto a partir de uma OS.

    Body: {"service_order_id": "uuid", "forma_pagamento": "01"}
    Retorna: FiscalDocumentSerializer
    RBAC: CONSULTANT+
    """

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def post(self, request: Request) -> Response:
        from apps.fiscal.exceptions import (
            FiscalDocumentAlreadyAuthorized,
            NfeBuilderError,
        )
        from apps.fiscal.services.fiscal_service import FiscalService
        from apps.service_orders.models import ServiceOrder

        service_order_id = request.data.get("service_order_id")
        if not service_order_id:
            return Response(
                {"detail": "service_order_id obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            order = ServiceOrder.objects.get(pk=service_order_id, is_active=True)
        except ServiceOrder.DoesNotExist:
            return Response({"detail": "OS não encontrada."}, status=status.HTTP_404_NOT_FOUND)

        forma_pagamento = request.data.get("forma_pagamento", "01")

        try:
            doc = FiscalService.emit_nfe(order, forma_pagamento=forma_pagamento)
        except FiscalDocumentAlreadyAuthorized:
            return Response(
                {"detail": "OS já possui NF-e autorizada."},
                status=status.HTTP_409_CONFLICT,
            )
        except NfeBuilderError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            from apps.fiscal.exceptions import FocusNFeError, FiscalValidationError
            if isinstance(exc, FiscalValidationError):
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            if isinstance(exc, FocusNFeError):
                logger.error("NfeEmitView: erro Focus para OS %s: %s", service_order_id, exc)
                return Response({"detail": "Erro na comunicação com o serviço fiscal."}, status=status.HTTP_400_BAD_REQUEST)
            logger.error("NfeEmitView: erro ao emitir NF-e para OS %s: %s", service_order_id, exc)
            return Response(
                {"detail": "Erro ao emitir NF-e."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(FiscalDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)


class NfeEmitManualView(APIView):
    """Emite NF-e de produto manual (ad-hoc, sem OS vinculada).

    RBAC: ADMIN+
    """

    permission_classes = [IsAuthenticated, IsAdminOrAbove]

    def post(self, request: Request) -> Response:
        from apps.fiscal.exceptions import FiscalValidationError, NfeBuilderError
        from apps.fiscal.serializers import ManualNfeInputSerializer
        from apps.fiscal.services.fiscal_service import FiscalService

        ser = ManualNfeInputSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            doc = FiscalService.emit_manual_nfe(ser.validated_data, user=request.user)
        except (NfeBuilderError, FiscalValidationError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            from apps.fiscal.exceptions import FocusNFeError, FocusValidationError as FVE
            if isinstance(exc, FVE):
                # Erro de validação Focus (payload inválido) — detalhe útil para o usuário
                logger.warning("NfeEmitManualView: Focus validação: %s", exc)
                detail = exc.args[0] if exc.args else {}
                msg = detail.get("mensagem", str(detail)) if isinstance(detail, dict) else str(detail)
                return Response({"detail": f"Erro de validação fiscal: {msg}"}, status=status.HTTP_400_BAD_REQUEST)
            if isinstance(exc, FocusNFeError):
                logger.error("NfeEmitManualView: erro Focus: %s", exc)
                return Response({"detail": "Erro na comunicação com o serviço fiscal."}, status=status.HTTP_502_BAD_GATEWAY)
            logger.error("NfeEmitManualView: erro ao emitir NF-e manual: %s", exc)
            return Response(
                {"detail": "Erro ao emitir NF-e manual."},
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

    @action(
        detail=True,
        methods=["post"],
        url_path="send-email",
        permission_classes=[IsAuthenticated, IsConsultantOrAbove],
    )
    def send_email(self, request: Request, pk: str | None = None) -> Response:
        """POST /api/v1/fiscal/documents/{pk}/send-email/

        Body: { "emails": ["addr@example.com", ...] }
        Max 10 emails.
        """
        doc = self.get_object()
        emails = request.data.get("emails", [])
        if not emails or not isinstance(emails, list):
            raise ValidationError({"emails": "Informe ao menos um email."})
        if len(emails) > 10:
            raise ValidationError({"emails": "Máximo 10 emails por envio."})
        if doc.status != "authorized":
            raise ValidationError({"detail": "Só é possível enviar documentos autorizados."})

        from apps.fiscal.services.fiscal_service import FiscalService

        config = FiscalService.get_config()
        client = FocusNFeClient(config.focus_token, config.focus_base_url)
        try:
            if doc.document_type == "nfse":
                resp = client.send_nfse_email(doc.ref, emails)
            else:
                resp = client.send_nfe_email(doc.ref, emails)

            FiscalEvent.objects.create(
                document=doc,
                event_type="CONSULT",
                triggered_by="USER",
                payload={"emails": emails},
                response=resp.data or {},
                http_status=resp.status_code,
                duration_ms=resp.duration_ms,
            )

            if resp.status_code in (200, 201, 202):
                from django.utils import timezone

                if hasattr(doc, "email_sent_at"):
                    doc.email_sent_at = timezone.now()
                    doc.save(update_fields=["email_sent_at"])
                return Response({"status": "ok", "emails": emails})
            return Response(
                {"detail": "Erro ao enviar email."},
                status=resp.status_code,
            )
        finally:
            client.close()

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

    @action(
        detail=True,
        methods=["post"],
        url_path="cce",
        permission_classes=[IsAuthenticated, IsManagerOrAbove],
    )
    def carta_correcao(self, request: Request, pk: str | None = None) -> Response:
        """POST /api/v1/fiscal/documents/{pk}/cce/

        Body: { "correcao": "texto 15-1000 chars" }
        """
        doc = self.get_object()
        correcao = request.data.get("correcao", "")
        if not correcao or len(correcao) < 15 or len(correcao) > 1000:
            raise ValidationError({"correcao": "Texto deve ter entre 15 e 1000 caracteres."})
        if doc.status != "authorized":
            raise ValidationError({"detail": "Só é possível emitir CCe para NF-e autorizadas."})
        if doc.document_type != "nfe":
            raise ValidationError({"detail": "CCe só é permitida para NF-e (não NFS-e/NFC-e)."})
        if doc.cce_count >= 20:
            raise ValidationError({"detail": "Limite de 20 Cartas de Correção atingido."})

        from apps.fiscal.services.fiscal_service import FiscalService

        result = FiscalService.carta_correcao(doc, correcao)
        return Response(result, status=status.HTTP_200_OK)


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


class FiscalFileProxyView(APIView):
    """Proxy autenticado para PDF/XML da Focus NF-e.

    GET /fiscal/documents/{pk}/file/pdf/
    GET /fiscal/documents/{pk}/file/xml/

    A Focus exige HTTP Basic auth para acessar os arquivos.
    Este proxy faz o download com o token e retorna ao browser.
    """

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get(self, request: Request, pk: str, file_type: str) -> Response:
        from django.http import HttpResponse
        import httpx

        if file_type not in ("pdf", "xml"):
            return Response({"detail": "file_type deve ser 'pdf' ou 'xml'."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            doc = FiscalDocument.objects.get(pk=pk, is_active=True)
        except FiscalDocument.DoesNotExist:
            return Response({"detail": "Documento não encontrado."}, status=status.HTTP_404_NOT_FOUND)

        path = doc.caminho_pdf if file_type == "pdf" else doc.caminho_xml
        if not path:
            return Response({"detail": f"Documento sem {file_type.upper()} disponível."}, status=status.HTTP_404_NOT_FOUND)

        base_url = "https://homologacao.focusnfe.com.br"
        if doc.environment == "producao":
            base_url = "https://api.focusnfe.com.br"

        token = doc.config.focus_token if doc.config else ""
        if not token:
            from django.conf import settings
            token = settings.FOCUS_NFE_TOKEN

        try:
            resp = httpx.get(
                f"{base_url}{path}",
                auth=(token, ""),
                timeout=15.0,
            )
        except httpx.TimeoutException:
            return Response({"detail": "Timeout ao baixar arquivo."}, status=status.HTTP_504_GATEWAY_TIMEOUT)

        if resp.status_code != 200:
            logger.error("FiscalFileProxyView: Focus %s para %s%s", resp.status_code, base_url, path)
            return Response({"detail": "Arquivo não encontrado na Focus."}, status=status.HTTP_404_NOT_FOUND)

        content_type = "application/pdf" if file_type == "pdf" else "application/xml"
        filename = path.rsplit("/", 1)[-1] if "/" in path else f"documento.{file_type}"

        http_resp = HttpResponse(resp.content, content_type=content_type)
        http_resp["Content-Disposition"] = f'inline; filename="{filename}"'
        return http_resp


# ─── S3-T3: Inutilização de Numeração NF-e ──────────────────────────────────


class NfeInutilizacaoView(APIView):
    """POST /api/v1/fiscal/nfe/inutilizacao/
    Body: { "serie": 1, "numero_inicial": 10, "numero_final": 15, "justificativa": "texto 15+ chars" }
    """
    permission_classes = [IsAuthenticated, IsAdminOrAbove]

    def post(self, request: Request) -> Response:
        serie = request.data.get("serie")
        numero_inicial = request.data.get("numero_inicial")
        numero_final = request.data.get("numero_final")
        justificativa = request.data.get("justificativa", "")

        if not all([serie, numero_inicial, numero_final]):
            raise ValidationError({"detail": "serie, numero_inicial e numero_final são obrigatórios."})
        if not justificativa or len(justificativa) < 15:
            raise ValidationError({"justificativa": "Justificativa deve ter pelo menos 15 caracteres."})
        if int(numero_final) < int(numero_inicial):
            raise ValidationError({"detail": "numero_final deve ser >= numero_inicial."})

        from apps.fiscal.services.fiscal_service import FiscalService
        config = FiscalService.get_config()
        client = FocusNFeClient(config.focus_token, config.focus_base_url)
        try:
            resp = client.inutilizar(int(serie), int(numero_inicial), int(numero_final), justificativa)
            FiscalEvent.objects.create(
                event_type="INUTILIZACAO",
                triggered_by="USER",
                payload=request.data,
                response_data=resp.data or {},
                http_status=resp.status_code,
                duration_ms=resp.duration_ms,
            )
            if resp.status_code in (200, 201):
                return Response(resp.data, status=status.HTTP_200_OK)
            return Response(
                {"detail": resp.data.get("mensagem", "Erro na inutilização.") if resp.data else "Erro na inutilização."},
                status=resp.status_code,
            )
        finally:
            client.close()


class DanfePreviewView(APIView):
    """POST /api/v1/fiscal/nfe/danfe-preview/
    Gera preview do DANFE sem emitir a NF-e.
    Body: payload NF-e completo (mesmo formato de emissão).
    """

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def post(self, request: Request) -> Response:
        payload = request.data
        if not payload:
            raise ValidationError({"detail": "Payload NF-e é obrigatório."})

        from apps.fiscal.services.fiscal_service import FiscalService
        config = FiscalService.get_config()
        client = FocusNFeClient(config.focus_token, config.focus_base_url)
        try:
            resp = client.danfe_preview(payload)
            if resp.status_code in (200, 201):
                return Response(resp.data, status=status.HTTP_200_OK)
            return Response(
                {"detail": resp.data.get("mensagem", "Erro ao gerar preview.") if resp.data else "Erro ao gerar preview."},
                status=resp.status_code,
            )
        finally:
            client.close()


class NfeInutilizacaoListView(APIView):
    """GET /api/v1/fiscal/nfe/inutilizacoes/"""
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get(self, request: Request) -> Response:
        events = FiscalEvent.objects.filter(
            event_type="INUTILIZACAO",
            http_status__in=[200, 201],
        ).order_by("-created_at").values(
            "id", "payload", "response_data", "created_at",
        )[:50]
        return Response(list(events))
