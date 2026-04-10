"""
Paddock Solutions — HR Celery Tasks
Sprint 6: automações mensais e alertas.
"""
import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def task_generate_recurring_allowances(self: object, tenant_schema: str) -> None:  # type: ignore[type-arg]
    """
    Gera vales recorrentes para todos os colaboradores ativos.
    Deve ser chamada no 1º dia útil do mês.
    """
    try:
        from django_tenants.utils import schema_context

        from .services import AllowanceService

        today = timezone.now().date().replace(day=1)
        with schema_context(tenant_schema):
            created = AllowanceService.generate_recurring_allowances(today)
            logger.info(
                "[HR] Generated %d recurring allowances for %s (tenant: %s)",
                len(created),
                today,
                tenant_schema,
            )
    except Exception as exc:
        logger.error("[HR] task_generate_recurring_allowances failed: %s", exc)
        raise self.retry(exc=exc, countdown=60 * 5)  # type: ignore[attr-defined]


@shared_task(bind=True, max_retries=3)
def task_check_expiring_documents(self: object, tenant_schema: str) -> None:  # type: ignore[type-arg]
    """
    Verifica documentos vencendo nos próximos 30 dias e loga alertas.
    Futuramente: notificar ADMIN via WhatsApp/notificação interna.
    """
    try:
        from django_tenants.utils import schema_context

        from .models import EmployeeDocument

        threshold = timezone.now().date() + timedelta(days=30)
        today = timezone.now().date()

        with schema_context(tenant_schema):
            expiring = EmployeeDocument.objects.filter(
                expiry_date__lte=threshold,
                expiry_date__gte=today,
                is_active=True,
                employee__status="active",
            ).select_related("employee__user")

            for doc in expiring:
                logger.warning(
                    "[HR] Document expiring: employee=%s type=%s expires=%s",
                    doc.employee,
                    doc.document_type,
                    doc.expiry_date,
                )
    except Exception as exc:
        logger.error("[HR] task_check_expiring_documents failed: %s", exc)
        raise self.retry(exc=exc, countdown=60 * 5)  # type: ignore[attr-defined]


@shared_task(bind=True, max_retries=3)
def task_clone_recurring_goals(self: object, tenant_schema: str) -> None:  # type: ignore[type-arg]
    """
    Clona metas recorrentes cujo recurrence_day == hoje.
    Roda diariamente. Só clona se a meta atual não estiver ACTIVE
    (evita duplicata no mesmo mês).
    """
    try:
        import datetime

        from django_tenants.utils import schema_context
        from django.utils import timezone

        from .models import GoalTarget

        today = timezone.now().date()
        with schema_context(tenant_schema):
            candidates = GoalTarget.objects.filter(
                is_recurring=True,
                recurrence_day=today.day,
                is_active=True,
            ).exclude(status=GoalTarget.GoalStatus.ACTIVE)

            cloned = 0
            for goal in candidates:
                new_end = today + datetime.timedelta(days=30)
                GoalTarget.objects.create(
                    employee=goal.employee,
                    department=goal.department,
                    title=goal.title,
                    description=goal.description,
                    target_value=goal.target_value,
                    current_value=0,
                    unit=goal.unit,
                    bonus_amount=goal.bonus_amount,
                    start_date=today,
                    end_date=new_end,
                    status=GoalTarget.GoalStatus.ACTIVE,
                    is_recurring=True,
                    recurrence_day=goal.recurrence_day,
                    parent_goal=goal,
                )
                cloned += 1
                logger.info("[HR] Cloned recurring goal: %s (parent: %s)", goal.title, goal.id)

            logger.info(
                "[HR] task_clone_recurring_goals: %d cloned for %s (tenant: %s)",
                cloned,
                today,
                tenant_schema,
            )
    except Exception as exc:
        logger.error("[HR] task_clone_recurring_goals failed: %s", exc)
        raise self.retry(exc=exc, countdown=60 * 5)  # type: ignore[attr-defined]


@shared_task(bind=True, max_retries=3)
def task_generate_payslip_pdf(self: object, payslip_id: str) -> None:  # type: ignore[type-arg]
    """
    Gera PDF do contracheque de forma assíncrona e faz upload para S3.
    Salva a S3 key em Payslip.pdf_file_key após sucesso.
    """
    try:
        from django.utils import timezone

        from apps.hr.models import Payslip
        from apps.hr.services import generate_payslip_pdf, upload_payslip_to_s3

        payslip = Payslip.objects.select_related("employee__user").get(id=payslip_id)
        pdf_bytes = generate_payslip_pdf(payslip)
        pdf_key = upload_payslip_to_s3(pdf_bytes, payslip)
        Payslip.objects.filter(id=payslip_id).update(
            pdf_file_key=pdf_key,
            updated_at=timezone.now(),
        )
        logger.info("[HR] PDF gerado e enviado para S3: %s", pdf_key)
    except Exception as exc:
        logger.error("[HR] task_generate_payslip_pdf failed: %s", exc)
        raise self.retry(exc=exc, countdown=60)  # type: ignore[attr-defined]
