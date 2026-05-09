"""
Paddock Solutions — Fiscal — FiscalService
Ciclo 06B: Fiscal Foundation (skeleton funcional)
Ciclo 06C: emit_nfse, cancel, consult — implementação completa

Responsabilidades:
- Orquestrar chamadas ao FocusNFeClient
- Persistir FiscalEvent (auditoria imutável)
- Traduzir http_status → exceção de domínio via _raise_for_http()
- Atualizar FiscalDocument conforme resposta da Focus
"""

import logging
import time
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from django.db import transaction

from apps.fiscal.clients.focus_nfe_client import FocusNFeClient, FocusResponse
from apps.fiscal.exceptions import (
    FiscalDocumentAlreadyAuthorized,
    FiscalInvalidStatus,
    FocusAuthError,
    FocusConflict,
    FocusNotFoundError,
    FocusRateLimitError,
    FocusServerError,
    FocusValidationError,
)
from apps.fiscal.models import FiscalDocument, FiscalEvent
from apps.fiscal.services.manaus_nfse import ManausNfseBuilder
from apps.fiscal.services.ref_generator import next_fiscal_ref
from apps.fiscal.tasks import poll_fiscal_document

if TYPE_CHECKING:
    from apps.fiscal.models import FiscalConfigModel

logger = logging.getLogger(__name__)


class FiscalService:
    """Serviço de emissão e gerenciamento de documentos fiscais.

    Todos os métodos de emissão são @transaction.atomic.
    _raise_for_http() é o único ponto de mapeamento HTTP → exceção de domínio.
    """

    @classmethod
    def get_config(cls) -> "FiscalConfigModel":
        """Retorna a configuração fiscal ativa.

        Raises:
            FiscalConfigModel.DoesNotExist: Nenhum emissor cadastrado.
        """
        from apps.fiscal.models import FiscalConfigModel

        return FiscalConfigModel.objects.get(is_active=True)

    @classmethod
    @transaction.atomic
    def emit_nfse(
        cls,
        service_order: Any,
        config: "FiscalConfigModel | None" = None,
        triggered_by: str = "USER",
    ) -> "FiscalDocument":
        """Emite NFS-e para OS particular.

        Idempotência:
        - Se já existe FiscalDocument(service_order=os, document_type=NFSE, status=authorized)
          → levanta FiscalDocumentAlreadyAuthorized
        - Se já existe com status=pending → retorna documento existente (não envia novamente)
        - Se não existe → cria, envia para Focus, agenda polling

        Returns:
            FiscalDocument com status "pending" (Focus processa assincronamente).

        Raises:
            FiscalDocumentAlreadyAuthorized: NFS-e já autorizada para esta OS.
            NfseBuilderError: dados insuficientes (Person sem doc, sem endereço).
            FocusApiError subclasses: erros de comunicação com Focus.
        """
        if config is None:
            config = cls.get_config()

        # Idempotência: verificar documento existente
        existing = FiscalDocument.objects.filter(
            service_order=service_order,
            document_type=FiscalDocument.DocumentType.NFSE,
            status__in=[FiscalDocument.Status.AUTHORIZED, FiscalDocument.Status.PENDING],
        ).first()

        if existing is not None:
            if existing.status == FiscalDocument.Status.AUTHORIZED:
                raise FiscalDocumentAlreadyAuthorized(
                    f"NFS-e já autorizada: {existing.pk}"
                )
            # Status pending: já enviado, aguardando Focus — retornar documento existente
            return existing

        # Gerar ref de idempotência
        ref, _seq = next_fiscal_ref(config=config, doc_type="NFSE")

        # Construir payload
        payload = ManausNfseBuilder.build(service_order=service_order, config=config, ref=ref)

        # Calcular valor total
        services_total = Decimal(str(service_order.services_total or 0))
        parts_total = Decimal(str(service_order.parts_total or 0))
        total_value = services_total + parts_total

        # Criar documento no banco
        doc = FiscalDocument.objects.create(
            document_type=FiscalDocument.DocumentType.NFSE,
            status=FiscalDocument.Status.PENDING,
            ref=ref,
            config=config,
            service_order=service_order,
            destinatario=cls._get_person_for_os(service_order),
            payload_enviado=payload,
            total_value=total_value,
            environment=config.environment,
        )

        # Registrar evento de envio
        FiscalEvent.objects.create(
            document=doc,
            event_type=FiscalEvent.EventType.EMIT_REQUEST,
            payload=payload,
            triggered_by=triggered_by,
        )

        # Chamar Focus
        t0 = time.monotonic()
        with FocusNFeClient() as client:
            resp = client.emit_nfse(ref, payload)
        duration_ms = int((time.monotonic() - t0) * 1000)

        # Registrar resposta
        FiscalEvent.objects.create(
            document=doc,
            event_type=FiscalEvent.EventType.EMIT_RESPONSE,
            http_status=resp.status_code,
            response=resp.data or {},
            duration_ms=duration_ms,
            triggered_by=triggered_by,
        )

        # Levantar exceção em erro (FocusApiError subclass)
        cls._raise_for_http(resp)

        # Atualizar doc com resposta inicial
        doc.ultima_resposta = resp.data or {}
        doc.save(update_fields=["ultima_resposta"])

        # Agendar polling (Focus processa NFS-e assincronamente)
        poll_fiscal_document.apply_async(args=[str(doc.pk)], countdown=10)

        return doc

    @classmethod
    def _get_person_for_os(cls, service_order: Any) -> Any:
        """Carrega Person a partir do customer_id da OS.

        Returns None se não encontrado (para não bloquear a criação do FiscalDocument).
        """
        from apps.persons.models import Person

        customer_id = getattr(service_order, "customer_id", None)
        if customer_id is None:
            return None
        try:
            return Person.objects.get(pk=customer_id)
        except Person.DoesNotExist:
            return None

    @classmethod
    def emit_manual_nfse(
        cls,
        input_data: dict[str, Any],
        config: "FiscalConfigModel",
        user: Any,
        manual_reason: str,
    ) -> "FiscalDocument":
        """Emite NFS-e manual (ad-hoc, sem OS).

        Implementação completa no Ciclo 06C.
        """
        raise NotImplementedError("emit_manual_nfse será implementado no Ciclo 06C.")

    @classmethod
    @transaction.atomic
    def consult(cls, doc: "FiscalDocument") -> "FiscalDocument":
        """Consulta status de documento na Focus e atualiza FiscalDocument.

        Mapeamento de status Focus → FiscalDocument.Status:
        - "autorizado" → AUTHORIZED (atualiza key, numero, authorized_at, caminho_xml, caminho_pdf)
        - "processando_autorizacao" → mantém PENDING (sem alteração)
        - "erro_autorizacao" → REJECTED (atualiza mensagem_sefaz, rejection_reason)
        - "cancelado" → CANCELLED (atualiza cancelled_at)
        """
        from datetime import datetime, timezone

        t0 = time.monotonic()
        with FocusNFeClient() as client:
            resp = client.consult_nfse(doc.ref or str(doc.pk))
        duration_ms = int((time.monotonic() - t0) * 1000)

        FiscalEvent.objects.create(
            document=doc,
            event_type=FiscalEvent.EventType.CONSULT,
            http_status=resp.status_code,
            response=resp.data or {},
            duration_ms=duration_ms,
            triggered_by="USER",
        )

        cls._raise_for_http(resp)

        # Mapear status Focus → FiscalDocument.Status
        focus_status = (resp.data or {}).get("status", "")

        if focus_status == "autorizado":
            doc.status = FiscalDocument.Status.AUTHORIZED
            doc.key = (resp.data or {}).get("chave_nfe", "")
            doc.number = str((resp.data or {}).get("numero", ""))
            doc.protocolo = (resp.data or {}).get("protocolo", "")
            doc.caminho_xml = (resp.data or {}).get("caminho_xml_nota_fiscal", "")
            doc.caminho_pdf = (resp.data or {}).get("caminho_danfe", "") or (
                resp.data or {}
            ).get("caminho_pdf", "")
            doc.authorized_at = datetime.now(tz=timezone.utc)
            doc.ultima_resposta = resp.data or {}
            doc.save(
                update_fields=[
                    "status",
                    "key",
                    "number",
                    "protocolo",
                    "caminho_xml",
                    "caminho_pdf",
                    "authorized_at",
                    "ultima_resposta",
                ]
            )
        elif focus_status in ("erro_autorizacao", "denegado"):
            doc.status = FiscalDocument.Status.REJECTED
            motivo = (resp.data or {}).get("mensagem_sefaz", "")
            doc.mensagem_sefaz = motivo
            doc.rejection_reason = motivo
            doc.natureza_rejeicao = (resp.data or {}).get("natureza_rejeicao", "")
            doc.ultima_resposta = resp.data or {}
            doc.save(
                update_fields=[
                    "status",
                    "mensagem_sefaz",
                    "rejection_reason",
                    "natureza_rejeicao",
                    "ultima_resposta",
                ]
            )
        elif focus_status == "cancelado":
            doc.status = FiscalDocument.Status.CANCELLED
            doc.cancelled_at = datetime.now(tz=timezone.utc)
            doc.ultima_resposta = resp.data or {}
            doc.save(update_fields=["status", "cancelled_at", "ultima_resposta"])
        # "processando_autorizacao" → nada — doc permanece PENDING

        return doc

    @classmethod
    @transaction.atomic
    def cancel(cls, doc: "FiscalDocument", justificativa: str) -> "FiscalDocument":
        """Cancela documento fiscal autorizado.

        Raises:
            FiscalInvalidStatus: documento não está autorizado.
            FocusValidationError: justificativa muito curta (< 15 chars).
        """
        from datetime import datetime, timezone

        if doc.status != FiscalDocument.Status.AUTHORIZED:
            raise FiscalInvalidStatus(
                f"Não é possível cancelar documento com status '{doc.status}'. "
                "Apenas documentos 'authorized' podem ser cancelados."
            )

        if len(justificativa.strip()) < 15:
            raise FocusValidationError(
                {"justificativa": "Justificativa deve ter pelo menos 15 caracteres."}
            )

        t0 = time.monotonic()
        with FocusNFeClient() as client:
            resp = client.cancel_nfse(doc.ref or str(doc.pk), justificativa)
        duration_ms = int((time.monotonic() - t0) * 1000)

        FiscalEvent.objects.create(
            document=doc,
            event_type=FiscalEvent.EventType.CANCEL_REQUEST,
            payload={"justificativa": justificativa},
            http_status=resp.status_code,
            response=resp.data or {},
            duration_ms=duration_ms,
            triggered_by="USER",
        )

        cls._raise_for_http(resp)

        doc.status = FiscalDocument.Status.CANCELLED
        doc.cancelled_at = datetime.now(tz=timezone.utc)
        doc.ultima_resposta = resp.data or {}
        doc.save(update_fields=["status", "cancelled_at", "ultima_resposta"])

        return doc

    @staticmethod
    def _raise_for_http(resp: FocusResponse) -> None:
        """Traduz http_status_code em exceção de domínio.

        Chamado após cada resposta HTTP da Focus.
        2xx: retorna normalmente (sem exceção).
        4xx/5xx: levanta a exceção adequada com o payload de erro.

        Args:
            resp: FocusResponse retornado pelo FocusNFeClient.

        Raises:
            FocusAuthError: 401 ou 403 — token inválido/sem permissão.
            FocusNotFoundError: 404 — ref não encontrada na Focus.
            FocusConflict: 409 — conflito de ref.
            FocusRateLimitError: 429 — rate limit excedido.
            FocusValidationError: 400/415/422 — payload inválido (não fazer retry).
            FocusServerError: 5xx — erro interno Focus/SEFAZ (fazer retry).
        """
        sc = resp.status_code
        if 200 <= sc < 300:
            return

        error_payload: Any = resp.data or {"raw": resp.raw_text}

        if sc in (401, 403):
            raise FocusAuthError(error_payload)
        if sc == 404:
            raise FocusNotFoundError(error_payload)
        if sc == 409:
            raise FocusConflict(error_payload)
        if sc == 429:
            raise FocusRateLimitError(error_payload)
        if 400 <= sc < 500:
            raise FocusValidationError(error_payload)
        if sc >= 500:
            raise FocusServerError(error_payload)

        # Status desconhecido — tratar como erro de servidor
        logger.warning("FiscalService: status_code inesperado %d", sc)
        raise FocusServerError(error_payload)
