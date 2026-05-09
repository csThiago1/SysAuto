"""
Paddock Solutions — Accounting Celery Tasks

task_generate_recurring_expenses     — gera AP para cada DespesaRecorrente ativa (por tenant).
task_generate_recurring_expenses_all_tenants — entry point beat (dia 1 de cada mes, 07:00).
update_overdue_entries               — placeholder chamado pelo beat schedule existente.
"""
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def task_generate_recurring_expenses(self: object, tenant_schema: str) -> dict:  # type: ignore[type-arg]
    """
    No dia 1 de cada mes, gera PayableDocument para cada DespesaRecorrente ativa.

    Skips despesas sem fornecedor (supplier_id=None), pois create_payable requer supplier.
    Safe to retry — cria um novo titulo por execucao (by design: um por mes).

    Args:
        tenant_schema: Schema do tenant a processar (ex: 'tenant_dscar').

    Returns:
        Dict com 'status', 'checked', 'created' e 'skipped'.
    """
    from datetime import date

    from django.db.models import Q
    from django_tenants.utils import schema_context

    with schema_context(tenant_schema):
        from apps.accounting.models import DespesaRecorrente
        from apps.accounts_payable.services import PayableDocumentService

        today = date.today()
        despesas = DespesaRecorrente.objects.filter(
            is_active=True,
            vigente_desde__lte=today,
        ).filter(Q(vigente_ate__isnull=True) | Q(vigente_ate__gte=today))

        total_checked = despesas.count()
        created = 0
        skipped = 0

        for d in despesas:
            if not d.supplier_id:
                logger.info(
                    "[Accounting] DespesaRecorrente %s sem fornecedor — ignorada.",
                    d.pk,
                )
                skipped += 1
                continue

            try:
                dia = min(d.dia_vencimento, 28)  # seguro para todos os meses
                due_date = date(today.year, today.month, dia)

                PayableDocumentService.create_payable(
                    supplier_id=str(d.supplier_id),
                    description=f"{d.get_tipo_display()} — {today.strftime('%m/%Y')}",
                    amount=d.valor_mensal,
                    due_date=due_date,
                    competence_date=today.replace(day=1),
                    origin="AUTO",
                    expense_account_id=str(d.conta_contabil_id) if d.conta_contabil_id else None,
                    user=None,
                )
                created += 1
                logger.info(
                    "[Accounting] DespesaRecorrente %s — titulo gerado (vencimento %s).",
                    d.pk,
                    due_date,
                )
            except Exception as e:
                logger.warning(
                    "[Accounting] DespesaRecorrente %s falhou ao gerar titulo: %s",
                    d.pk,
                    e,
                )

        logger.info(
            "[Accounting] task_generate_recurring_expenses concluida (tenant: %s) — "
            "verificadas=%d, criadas=%d, ignoradas=%d",
            tenant_schema,
            total_checked,
            created,
            skipped,
        )
        return {
            "status": "ok",
            "checked": total_checked,
            "created": created,
            "skipped": skipped,
        }


@shared_task(bind=True, max_retries=1, default_retry_delay=60)
def task_generate_recurring_expenses_all_tenants(self: object) -> None:  # type: ignore[type-arg]
    """
    Entry point para Celery beat — dispara geracao de despesas recorrentes em todos os tenants.

    Configurar no beat schedule para rodar no dia 1 de cada mes as 07:00.
    """
    try:
        from apps.tenants.models import Company

        tenants = Company.objects.filter(schema_name__startswith="tenant_")
        schemas = list(tenants.values_list("schema_name", flat=True))
        for schema in schemas:
            task_generate_recurring_expenses.delay(schema)
            logger.info(
                "[Accounting] Enfileirada generate_recurring_expenses para tenant: %s", schema
            )
    except Exception as exc:
        logger.error(
            "[Accounting] task_generate_recurring_expenses_all_tenants falhou: %s", exc
        )
        raise self.retry(exc=exc, countdown=60)  # type: ignore[attr-defined]


@shared_task
def update_overdue_entries() -> None:
    """
    Placeholder chamado pelo beat schedule existente (todo dia as 06:00).

    Futuro: atualizar entradas contabeis vencidas, recalcular saldos, etc.
    """
    logger.info("[Accounting] update_overdue_entries executada (sem operacoes definidas).")
