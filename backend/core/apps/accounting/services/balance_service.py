"""
Paddock Solutions — Accounting: Serviço de Saldo Contábil

AccountBalanceService — calcula saldo de contas a partir dos lançamentos aprovados.
"""
import logging
from datetime import date
from decimal import Decimal

from django.db.models import Q, Sum

from apps.accounting.models.chart_of_accounts import ChartOfAccount, NatureType
from apps.accounting.models.journal_entry import JournalEntryLine

logger = logging.getLogger(__name__)


class AccountBalanceService:
    """
    Calcula saldo de contas contábeis a partir dos lançamentos aprovados.

    Suporta consulta de subárvore completa via code__startswith.
    Lançamentos estornados são excluídos do cálculo.
    """

    @classmethod
    def get_balance(
        cls,
        account: ChartOfAccount,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> Decimal:
        """
        Retorna saldo líquido da conta e todos os filhos (subárvore).

        A natureza da conta determina o sinal positivo do saldo:
        - Natureza Devedora (Ativo, Custo, Despesa): saldo = débitos - créditos
        - Natureza Credora (Passivo, PL, Receita): saldo = créditos - débitos

        Args:
            account: Conta a consultar (inclui toda a subárvore).
            start_date: Data de início do período (inclusive). None = sem limite.
            end_date: Data de fim do período (inclusive). None = sem limite.

        Returns:
            Saldo líquido como Decimal.
        """
        # Captura toda a subárvore pelo prefixo do código
        lines_qs = JournalEntryLine.objects.filter(
            account__code__startswith=account.code,
            entry__is_approved=True,
            entry__is_reversed=False,
        ).select_related("entry")

        if start_date:
            lines_qs = lines_qs.filter(entry__competence_date__gte=start_date)
        if end_date:
            lines_qs = lines_qs.filter(entry__competence_date__lte=end_date)

        aggregation = lines_qs.aggregate(
            total_debit=Sum("debit_amount"),
            total_credit=Sum("credit_amount"),
        )
        total_debit: Decimal = aggregation["total_debit"] or Decimal("0.00")
        total_credit: Decimal = aggregation["total_credit"] or Decimal("0.00")

        if account.nature == NatureType.DEBIT:
            return total_debit - total_credit
        else:
            return total_credit - total_debit

    @classmethod
    def get_trial_balance(
        cls,
        start_date: date,
        end_date: date,
        cost_center_id: str | None = None,
    ) -> list[dict]:
        """
        Retorna balancete de verificação para o período.

        Apenas contas analíticas com movimentação no período são retornadas.

        Args:
            start_date: Data de início do período.
            end_date: Data de fim do período.
            cost_center_id: UUID do centro de custo para filtrar. None = todos.

        Returns:
            Lista de dicts, cada um com:
                account_id, code, name, account_type, nature,
                debit_total, credit_total, balance.
        """
        lines_qs = JournalEntryLine.objects.filter(
            entry__is_approved=True,
            entry__is_reversed=False,
            entry__competence_date__gte=start_date,
            entry__competence_date__lte=end_date,
        ).select_related("account", "entry")

        if cost_center_id:
            lines_qs = lines_qs.filter(cost_center_id=cost_center_id)

        aggregation = (
            lines_qs.values(
                "account__id",
                "account__code",
                "account__name",
                "account__account_type",
                "account__nature",
            )
            .annotate(
                debit_total=Sum("debit_amount"),
                credit_total=Sum("credit_amount"),
            )
            .order_by("account__code")
        )

        result: list[dict] = []
        for row in aggregation:
            debit_total: Decimal = row["debit_total"] or Decimal("0.00")
            credit_total: Decimal = row["credit_total"] or Decimal("0.00")
            nature = row["account__nature"]

            if nature == NatureType.DEBIT:
                balance = debit_total - credit_total
            else:
                balance = credit_total - debit_total

            result.append(
                {
                    "account_id": str(row["account__id"]),
                    "code": row["account__code"],
                    "name": row["account__name"],
                    "account_type": row["account__account_type"],
                    "nature": nature,
                    "debit_total": debit_total,
                    "credit_total": credit_total,
                    "balance": balance,
                }
            )

        logger.debug(
            "AccountBalanceService.get_trial_balance: %d contas no período %s - %s",
            len(result),
            start_date,
            end_date,
        )
        return result
