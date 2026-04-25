"""
Paddock Solutions — Fiscal — Celery Tasks
Ciclo 06B: skeleton poll_fiscal_document
Ciclo 06C: lógica completa — delega a FiscalService.consult()

poll_fiscal_document: polling de status de documento fiscal na Focus.
Agendado após emissão (countdown=10s). Retry fixo de 10s até 60 tentativas (10 min).
"""

import logging

from celery import shared_task

logger = logging.getLogger(__name__)

# Máximo de tentativas (60 * 10s = 10 min de janela)
POLL_MAX_ATTEMPTS: int = 60

# Estados terminais — polling deve parar ao atingir qualquer um destes
POLL_TERMINAL_STATUSES: frozenset[str] = frozenset({"authorized", "rejected", "cancelled"})


@shared_task(
    bind=True,
    max_retries=POLL_MAX_ATTEMPTS,
    default_retry_delay=10,
    retry_backoff=False,  # intervalo fixo de 10s para NFS-e
)
def poll_fiscal_document(self, document_id: str) -> dict:  # type: ignore[type-arg]
    """Consulta status de documento fiscal na Focus e atualiza FiscalDocument.

    Ciclo:
    1. Busca FiscalDocument por UUID
    2. Se status não é "pending" → encerra (já processado pelo webhook ou FiscalService)
    3. FiscalService.consult(doc) → atualiza doc no banco
    4. Se ainda pending após consult → raise self.retry(countdown=10)
    5. Se authorized/rejected/cancelled → encerra

    Args:
        document_id: UUID string do FiscalDocument.

    Returns:
        Dict com document_id, status e attempt.
    """
    # Imports lazy — evita import circular com FiscalService
    from apps.fiscal.exceptions import FocusServerError, FocusTimeout
    from apps.fiscal.models import FiscalDocument
    from apps.fiscal.services.fiscal_service import FiscalService

    try:
        doc = FiscalDocument.objects.get(pk=document_id)
    except FiscalDocument.DoesNotExist:
        logger.warning("poll_fiscal_document: doc %s não encontrado.", document_id)
        return {"document_id": document_id, "error": "not_found"}

    # Webhook ou outra chamada já processou o documento
    if doc.status != FiscalDocument.Status.PENDING:
        logger.debug(
            "poll_fiscal_document: doc %s já em status '%s' — encerrando.",
            document_id,
            doc.status,
        )
        return {"document_id": document_id, "status": doc.status, "skipped": True}

    # Delegar consulta ao FiscalService
    try:
        doc = FiscalService.consult(doc)
    except (FocusServerError, FocusTimeout) as exc:  # type: ignore[misc]
        logger.warning(
            "poll_fiscal_document: erro retryable para doc %s: %s",
            document_id,
            type(exc).__name__,
        )
        raise self.retry(exc=exc, countdown=10)
    except Exception as exc:
        logger.error(
            "poll_fiscal_document: erro não retryable para doc %s: %s",
            document_id,
            exc,
        )
        return {"document_id": document_id, "error": str(type(exc).__name__)}

    # Ainda pendente → retry
    if doc.status == FiscalDocument.Status.PENDING:
        logger.debug(
            "poll_fiscal_document: doc %s ainda pending — agendando retry (attempt %d/%d).",
            document_id,
            self.request.retries + 1,
            POLL_MAX_ATTEMPTS,
        )
        raise self.retry(countdown=10)

    logger.info(
        "poll_fiscal_document: doc %s resolvido com status '%s'.",
        document_id,
        doc.status,
    )
    return {"document_id": document_id, "status": doc.status}
