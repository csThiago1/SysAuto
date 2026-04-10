"""
Paddock Solutions — Accounting: Serviço de Período Fiscal

FiscalPeriodService — cria e gerencia exercícios e períodos fiscais.
"""
import logging
from datetime import date

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.accounting.models.fiscal_period import FiscalPeriod, FiscalYear
from apps.authentication.models import GlobalUser

logger = logging.getLogger(__name__)


class FiscalPeriodService:
    """Gerencia criação e fechamento de períodos fiscais."""

    @classmethod
    def get_or_create_period(cls, competence_date: date) -> FiscalPeriod:
        """
        Retorna o período fiscal do mês/ano da data.

        Cria FiscalYear e FiscalPeriod automaticamente se não existirem.

        Args:
            competence_date: Data cuja competência determina o período.

        Returns:
            FiscalPeriod correspondente ao mês/ano da data.
        """
        year = competence_date.year
        month = competence_date.month

        fiscal_year, _ = FiscalYear.objects.get_or_create(
            year=year,
            defaults={
                "start_date": date(year, 1, 1),
                "end_date": date(year, 12, 31),
            },
        )

        import calendar

        last_day = calendar.monthrange(year, month)[1]

        period, created = FiscalPeriod.objects.get_or_create(
            fiscal_year=fiscal_year,
            number=month,
            defaults={
                "start_date": date(year, month, 1),
                "end_date": date(year, month, last_day),
            },
        )

        if created:
            logger.info(
                "FiscalPeriodService: período criado %d/%02d", year, month
            )

        return period

    @classmethod
    @transaction.atomic
    def close_period(
        cls, period: FiscalPeriod, user: GlobalUser
    ) -> FiscalPeriod:
        """
        Fecha o período contábil.

        Valida que não existem lançamentos pendentes de aprovação no período.

        Args:
            period: Período a fechar.
            user: Usuário responsável pelo fechamento.

        Returns:
            FiscalPeriod atualizado com is_closed=True.

        Raises:
            ValidationError: Se o período já estiver fechado.
            ValidationError: Se houver lançamentos não aprovados no período.
        """
        if period.is_closed:
            raise ValidationError(_("Período já está fechado."))

        # Verifica lançamentos pendentes de aprovação
        pending_count = period.journal_entries.filter(is_approved=False).count()
        if pending_count > 0:
            raise ValidationError(
                _(
                    f"Existem {pending_count} lançamento(s) não aprovado(s) no período. "
                    "Aprove ou cancele antes de fechar."
                )
            )

        period.is_closed = True
        period.save(update_fields=["is_closed", "updated_at"])

        logger.info(
            "FiscalPeriodService: período %s fechado por %s",
            period,
            user.get_full_name(),
        )
        return period

    @classmethod
    def get_current_period(cls) -> FiscalPeriod | None:
        """
        Retorna o período do mês atual, criando se não existir.

        Returns:
            FiscalPeriod do mês corrente.
        """
        return cls.get_or_create_period(timezone.now().date())
