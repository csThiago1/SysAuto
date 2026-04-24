"""
Paddock Solutions — Fiscal — Celery Tasks
Ciclo 06B: Fiscal Foundation

poll_fiscal_document: polling de status de documento fiscal na Focus.
Agendado após emissão com countdown=10s.
Reeschedula a si mesmo até atingir estado terminal ou POLL_MAX_ATTEMPTS.
"""

import logging

import httpx
from celery import shared_task

logger = logging.getLogger(__name__)

# Estados terminais — polling deve parar ao atingir qualquer um
POLL_TERMINAL_STATES: frozenset[str] = frozenset({"AUTHORIZED", "DENIED", "ERROR", "CANCELLED"})

# Máximo de tentativas de polling (60 * 10s = 10 min de janela)
POLL_MAX_ATTEMPTS: int = 60

# Mapeamento status Focus NF-e → status local
_FOCUS_STATUS_MAP: dict[str, str] = {
    "processando_autorizacao": "PROCESSING",
    "autorizado": "AUTHORIZED",
    "denegado": "DENIED",
    "erro_autorizacao": "ERROR",
    "cancelado": "CANCELLED",
}

# Mapeamento doc_type → método do FocusNFeClient
_CONSULT_METHOD_MAP: dict[str, str] = {
    "NFSE": "consult_nfse",
    "NFE_55": "consult_nfe",
    "NFCE_65": "consult_nfce",
    # Aliases usados em alguns fluxos
    "nfse": "consult_nfse",
    "nfe": "consult_nfe",
    "nfce": "consult_nfce",
}


@shared_task(
    bind=True,
    autoretry_for=(
        # Erros de servidor Focus — retry automático com backoff
        # Import lazy abaixo para evitar import circular
    ),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=10,
)
def poll_fiscal_document(self, document_id: str, attempt: int = 1) -> dict:  # type: ignore[type-arg]
    """Consulta status de documento fiscal na Focus e atualiza FiscalDocument.

    Fluxo:
    1. Busca FiscalDocument por UUID
    2. Se já em estado terminal: retorna imediatamente
    3. Chama método de consulta adequado no FocusNFeClient
    4. Cria FiscalEvent(event_type="CONSULT") para auditoria
    5. Atualiza FiscalDocument conforme resposta
    6. Se não terminal e attempt < POLL_MAX_ATTEMPTS: agenda nova consulta (countdown=10s)

    Args:
        document_id: UUID do FiscalDocument (string).
        attempt: Número da tentativa atual (começa em 1).

    Returns:
        Dict com document_id, status atual, attempt.
    """
    # Imports lazy — evita import circular com FiscalService e FiscalDocument
    from apps.fiscal.clients.focus_nfe_client import FocusNFeClient
    from apps.fiscal.exceptions import FocusRateLimitError, FocusServerError
    from apps.fiscal.models import FiscalDocument, FiscalEvent

    try:
        doc = FiscalDocument.objects.get(pk=document_id)
    except FiscalDocument.DoesNotExist:
        logger.error("poll_fiscal_document: FiscalDocument %s não encontrado.", document_id)
        return {"document_id": document_id, "error": "not_found"}

    # Skip se já em estado terminal
    if doc.status in POLL_TERMINAL_STATES:
        logger.debug(
            "poll_fiscal_document: doc %s já em estado terminal %s — skip.",
            document_id,
            doc.status,
        )
        return {"document_id": document_id, "skipped": True, "status": doc.status}

    # Determinar método de consulta
    method_name = _CONSULT_METHOD_MAP.get(doc.document_type)
    if method_name is None:
        logger.error(
            "poll_fiscal_document: doc_type %s não suportado para consulta.",
            doc.document_type,
        )
        return {"error": f"unsupported doc_type {doc.document_type}"}

    # Chamar API Focus
    try:
        with FocusNFeClient() as client:
            resp = getattr(client, method_name)(doc.key or str(doc.pk))
    except (FocusServerError, FocusRateLimitError, httpx.TimeoutException) as exc:
        logger.warning(
            "poll_fiscal_document: erro retryable no attempt %d para doc %s: %s",
            attempt,
            document_id,
            type(exc).__name__,
        )
        raise self.retry(exc=exc, countdown=min(10 * attempt, 300))

    # Registrar evento de auditoria
    FiscalEvent.objects.create(
        document=doc,
        event_type="CONSULT",
        http_status=resp.status_code,
        response=resp.data or {"raw": resp.raw_text},
        duration_ms=resp.duration_ms,
        triggered_by="CELERY",
    )

    # Atualizar status se Focus retornou 200 com status mapeável
    if resp.status_code == 200 and resp.data:
        focus_status = resp.data.get("status", "")
        new_status = _FOCUS_STATUS_MAP.get(focus_status)
        if new_status:
            _apply_status(doc, new_status, resp.data)

    # Reagendar se não terminal
    if doc.status not in POLL_TERMINAL_STATES and attempt < POLL_MAX_ATTEMPTS:
        poll_fiscal_document.apply_async(
            args=[document_id, attempt + 1],
            countdown=10,
        )

    return {"document_id": document_id, "status": doc.status, "attempt": attempt}


def _map_focus_status(focus_status: str) -> str | None:
    """Mapeia status da API Focus → status interno do FiscalDocument.

    Returns:
        Status interno ou None se o status não for mapeável.
    """
    return _FOCUS_STATUS_MAP.get(focus_status)


def _apply_status(doc: "FiscalDocument", new_status: str, data: dict) -> None:  # type: ignore[name-defined]
    """Aplica resposta da Focus ao FiscalDocument e salva.

    Campos variam por tipo de documento:
    - NF-e/NFC-e: key (chave_nfe), number, xml_s3_key (caminho_xml_nota_fiscal), danfe
    - NFS-e: number (numero da prefeitura), xml_s3_key (caminho_xml_nfse), danfse

    Args:
        doc: FiscalDocument a ser atualizado.
        new_status: Novo status a aplicar (um dos valores de FiscalDocument.Status).
        data: Dict de resposta da API Focus.
    """
    doc.status = new_status

    # NF-e: chave de 44 dígitos
    if "chave_nfe" in data and data["chave_nfe"]:
        doc.key = data["chave_nfe"]

    # Número definitivo (NF-e ou NFS-e)
    if "numero" in data:
        doc.number = str(data["numero"])

    # Caminho XML no Focus (download posterior)
    doc.xml_s3_key = (
        data.get("caminho_xml_nota_fiscal") or data.get("caminho_xml_nfse") or doc.xml_s3_key or ""
    )

    # Data de autorização
    if data.get("data_autorizacao"):
        doc.authorized_at = data["data_autorizacao"]

    # Cancelamento
    if new_status == "CANCELLED" and not doc.cancelled_at:
        from django.utils import timezone

        doc.cancelled_at = timezone.now()

    # Motivo de rejeição
    if new_status in ("DENIED", "REJECTED") and data.get("mensagem_sefaz"):
        doc.rejection_reason = data["mensagem_sefaz"]

    doc.save()
