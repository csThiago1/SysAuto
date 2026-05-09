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


# ─── S3-T6: Webhook auto-registration ────────────────────────────────────────


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def ensure_webhooks_registered(self, tenant_schema: str) -> dict:  # type: ignore[type-arg]
    """Garante que webhooks Focus estão registrados para todos os eventos necessários.

    Chamado no startup ou periodicamente para garantir que webhooks não foram
    desativados (Focus desativa após 7 dias de falha).

    Args:
        tenant_schema: Schema do tenant (ex: "tenant_dscar").

    Returns:
        Dict com status, existing e created.
    """
    from django.conf import settings
    from django_tenants.utils import schema_context

    from apps.fiscal.clients.focus_nfe_client import FocusNFeClient
    from apps.fiscal.models import FiscalConfigModel

    required_events = ["nfe", "nfsen", "nfe_recebida"]

    with schema_context(tenant_schema):
        config = FiscalConfigModel.objects.filter(is_active=True).first()
        if not config or not config.focus_token:
            logger.warning(
                "ensure_webhooks: no active FiscalConfig for %s", tenant_schema
            )
            return {"status": "skipped", "reason": "no_config"}

        webhook_secret = getattr(settings, "FOCUS_NFE_WEBHOOK_SECRET", "")
        if not webhook_secret:
            logger.warning("ensure_webhooks: FOCUS_NFE_WEBHOOK_SECRET not set")
            return {"status": "skipped", "reason": "no_secret"}

        # Build webhook URL
        base_domain = getattr(
            settings, "BACKEND_BASE_URL", "https://api.dscar.paddock.solutions"
        )
        webhook_url = f"{base_domain}/api/v1/fiscal/webhooks/focus/{webhook_secret}/"

        # focus_base_url não existe em FiscalConfigModel — usar settings
        base_url = getattr(config, "focus_base_url", None) or settings.FOCUS_NFE_BASE_URL
        client = FocusNFeClient(config.focus_token, base_url)
        try:
            # List existing webhooks
            existing_resp = client.list_webhooks()
            existing_data = (
                existing_resp.data
                if existing_resp.status_code == 200 and isinstance(existing_resp.data, list)
                else []
            )
            existing_events = {
                h.get("event") for h in existing_data if isinstance(h, dict)
            }

            created = []
            for event in required_events:
                if event not in existing_events:
                    resp = client.create_webhook(
                        event=event,
                        url=webhook_url,
                        cnpj=config.cnpj,
                        authorization=webhook_secret,
                    )
                    if resp.status_code in (200, 201):
                        created.append(event)
                        logger.info(
                            "ensure_webhooks: registered %s for %s", event, tenant_schema
                        )
                    else:
                        logger.warning(
                            "ensure_webhooks: failed to register %s — %s %s",
                            event,
                            resp.status_code,
                            resp.data,
                        )

            return {
                "status": "ok",
                "existing": list(existing_events),
                "created": created,
            }
        finally:
            client.close()


@shared_task(bind=True, max_retries=1, default_retry_delay=30)
def ensure_webhooks_all_tenants(self) -> None:
    """Entry point para beat — registra webhooks em todos os tenants ativos."""
    from apps.tenants.models import Company

    for company in Company.objects.exclude(schema_name="public"):
        ensure_webhooks_registered.delay(company.schema_name)
