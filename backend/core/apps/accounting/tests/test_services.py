"""
Paddock Solutions — Accounting Tests: Services

Testa servicos de contabilidade: NumberingService, JournalEntryService,
AccountBalanceService, FiscalPeriodService.
"""
import logging
from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError

from apps.accounting.models import FiscalPeriod, JournalEntry
from apps.accounting.services import (
    AccountBalanceService,
    FiscalPeriodService,
    JournalEntryService,
    NumberingService,
)

from .base import AccountingTestCase, make_account

logger = logging.getLogger(__name__)


class TestNumberingService(AccountingTestCase):
    """Testa geracao sequencial de numeros."""

    def test_numbering_service_first_number(self) -> None:
        """Primeiro número gerado deve ser JE000001."""
        number = NumberingService.next("JE")
        self.assertEqual(number, "JE000001")

    def test_numbering_service_sequential(self) -> None:
        """Numeros gerados devem ser sequenciais."""
        n1 = NumberingService.next("JE")
        n2 = NumberingService.next("JE")
        n3 = NumberingService.next("JE")
        nums = [int(n[2:]) for n in [n1, n2, n3]]
        self.assertEqual(nums, sorted(nums))
        self.assertEqual(nums[1] - nums[0], 1)
        self.assertEqual(nums[2] - nums[1], 1)

    def test_numbering_service_different_keys_independent(self) -> None:
        """Sequencias diferentes sao independentes."""
        je = NumberingService.next("JE")
        ap = NumberingService.next("AP")
        ar = NumberingService.next("AR")
        self.assertTrue(je.startswith("JE"))
        self.assertTrue(ap.startswith("AP"))
        self.assertTrue(ar.startswith("AR"))

    def test_numbering_service_concurrent_simulation(self) -> None:
        """Simulacao de concorrencia — multiplas chamadas geram numeros unicos."""
        numbers = [NumberingService.next("JE") for _ in range(10)]
        self.assertEqual(len(set(numbers)), 10)

    def test_peek_next_does_not_increment(self) -> None:
        """peek_next nao incrementa o contador."""
        peek1 = NumberingService.peek_next("JE")
        peek2 = NumberingService.peek_next("JE")
        self.assertEqual(peek1, peek2)

    def test_peek_next_invalid_key_raises(self) -> None:
        """Chave invalida lanca KeyError."""
        with self.assertRaises(KeyError):
            NumberingService.peek_next("INVALID")

    def test_next_invalid_key_raises(self) -> None:
        with self.assertRaises(KeyError):
            NumberingService.next("INVALID")


class TestJournalEntryService(AccountingTestCase):
    """Testa criacao, aprovacao e estorno de lancamentos."""

    def _lines_balanced(self, amount: str = "1000.00") -> list[dict]:
        """Retorna par de linhas D/C balanceadas."""
        return [
            {
                "account_id": str(self.account_ar.id),
                "debit_amount": amount,
                "credit_amount": "0.00",
            },
            {
                "account_id": str(self.account_revenue.id),
                "debit_amount": "0.00",
                "credit_amount": amount,
            },
        ]

    def test_create_entry_balanced(self) -> None:
        """Cria lançamento balanceado com sucesso."""
        entry = JournalEntryService.create_entry(
            description="Receita de serviço",
            competence_date=date.today(),
            origin="MAN",
            lines=self._lines_balanced(),
            user=self.admin,
        )
        self.assertIsInstance(entry, JournalEntry)
        self.assertTrue(entry.is_balanced)
        self.assertEqual(entry.lines.count(), 2)

    def test_create_entry_unbalanced_raises(self) -> None:
        """Lancamento desbalanceado lanca ValidationError."""
        lines = [
            {
                "account_id": str(self.account_ar.id),
                "debit_amount": "1000.00",
                "credit_amount": "0.00",
            },
            {
                "account_id": str(self.account_revenue.id),
                "debit_amount": "0.00",
                "credit_amount": "900.00",  # Desbalanceado!
            },
        ]
        with self.assertRaises(ValidationError) as ctx:
            JournalEntryService.create_entry(
                description="Desbalanceado",
                competence_date=date.today(),
                origin="MAN",
                lines=lines,
            )
        self.assertIn("balanceado", str(ctx.exception).lower())

    def test_create_entry_on_closed_period_raises(self) -> None:
        """Lançamento em período fechado lança ValidationError."""
        self.fiscal_period.is_closed = True
        self.fiscal_period.save(update_fields=["is_closed", "updated_at"])

        with self.assertRaises(ValidationError) as ctx:
            JournalEntryService.create_entry(
                description="Período fechado",
                competence_date=date.today(),
                origin="MAN",
                lines=self._lines_balanced(),
            )
        self.assertIn("fechado", str(ctx.exception).lower())

    def test_create_entry_on_synthetic_account_raises(self) -> None:
        """Lançamento em conta sintética lança ValidationError."""
        lines = [
            {
                "account_id": str(self.account_root_asset.id),  # is_analytical=False
                "debit_amount": "1000.00",
                "credit_amount": "0.00",
            },
            {
                "account_id": str(self.account_revenue.id),
                "debit_amount": "0.00",
                "credit_amount": "1000.00",
            },
        ]
        with self.assertRaises(ValidationError) as ctx:
            JournalEntryService.create_entry(
                description="Conta sintética",
                competence_date=date.today(),
                origin="MAN",
                lines=lines,
            )
        self.assertIn("analítica", str(ctx.exception))

    def test_create_entry_empty_lines_raises(self) -> None:
        """Sem linhas lança ValidationError."""
        with self.assertRaises(ValidationError):
            JournalEntryService.create_entry(
                description="Sem linhas",
                competence_date=date.today(),
                origin="MAN",
                lines=[],
            )

    def test_create_entry_auto_approve(self) -> None:
        """auto_approve=True cria lançamento já aprovado."""
        entry = JournalEntryService.create_entry(
            description="Auto-aprovado",
            competence_date=date.today(),
            origin="OS",
            lines=self._lines_balanced(),
            user=self.admin,
            auto_approve=True,
        )
        self.assertTrue(entry.is_approved)
        self.assertEqual(entry.approved_by, self.admin)

    def test_approve_entry(self) -> None:
        """Aprovacao muda is_approved para True."""
        entry = JournalEntryService.create_entry(
            description="Para aprovar",
            competence_date=date.today(),
            origin="MAN",
            lines=self._lines_balanced(),
            user=self.admin,
        )
        self.assertFalse(entry.is_approved)

        approved = JournalEntryService.approve_entry(entry, user=self.admin)
        self.assertTrue(approved.is_approved)
        self.assertEqual(approved.approved_by, self.admin)

    def test_approve_already_approved_raises(self) -> None:
        """Aprovar novamente lança ValidationError."""
        entry = JournalEntryService.create_entry(
            description="Ja aprovado",
            competence_date=date.today(),
            origin="MAN",
            lines=self._lines_balanced(),
            user=self.admin,
            auto_approve=True,
        )
        with self.assertRaises(ValidationError):
            JournalEntryService.approve_entry(entry, user=self.admin)

    def test_reverse_entry(self) -> None:
        """Estorno cria lancamento com linhas D/C invertidas."""
        entry = JournalEntryService.create_entry(
            description="Para estornar",
            competence_date=date.today(),
            origin="MAN",
            lines=self._lines_balanced("500.00"),
            user=self.admin,
            auto_approve=True,
        )
        reversal = JournalEntryService.reverse_entry(entry, user=self.admin)

        entry.refresh_from_db()
        self.assertTrue(entry.is_reversed)
        self.assertIsNotNone(entry.reversal_entry)
        self.assertEqual(entry.reversal_entry, reversal)

        # Verifica que os valores foram invertidos
        original_line_ar = entry.lines.get(account=self.account_ar)
        reversal_line_ar = reversal.lines.get(account=self.account_ar)
        self.assertEqual(original_line_ar.debit_amount, reversal_line_ar.credit_amount)
        self.assertEqual(original_line_ar.credit_amount, reversal_line_ar.debit_amount)

    def test_reverse_already_reversed_raises(self) -> None:
        """Estornar duas vezes lança ValidationError."""
        entry = JournalEntryService.create_entry(
            description="Estornado",
            competence_date=date.today(),
            origin="MAN",
            lines=self._lines_balanced(),
            user=self.admin,
            auto_approve=True,
        )
        JournalEntryService.reverse_entry(entry, user=self.admin)
        entry.refresh_from_db()

        with self.assertRaises(ValidationError) as ctx:
            JournalEntryService.reverse_entry(entry, user=self.admin)
        self.assertIn("estornado", str(ctx.exception).lower())

    def test_reverse_unapproved_raises(self) -> None:
        """Estornar lançamento não aprovado lança ValidationError."""
        entry = JournalEntryService.create_entry(
            description="Nao aprovado",
            competence_date=date.today(),
            origin="MAN",
            lines=self._lines_balanced(),
            user=self.admin,
        )
        with self.assertRaises(ValidationError):
            JournalEntryService.reverse_entry(entry, user=self.admin)

    def test_create_entry_number_format(self) -> None:
        """Número gerado segue formato JE######."""
        entry = JournalEntryService.create_entry(
            description="Formato",
            competence_date=date.today(),
            origin="MAN",
            lines=self._lines_balanced(),
        )
        self.assertRegex(entry.number, r"^JE\d{6}$")


class TestAccountBalanceService(AccountingTestCase):
    """Testa calculo de saldo de contas."""

    def _create_approved_entry(
        self,
        debit_account_id: str,
        credit_account_id: str,
        amount: str,
    ) -> JournalEntry:
        """Helper: cria e aprova lançamento."""
        return JournalEntryService.create_entry(
            description="Saldo teste",
            competence_date=date.today(),
            origin="MAN",
            lines=[
                {
                    "account_id": debit_account_id,
                    "debit_amount": amount,
                    "credit_amount": "0.00",
                },
                {
                    "account_id": credit_account_id,
                    "debit_amount": "0.00",
                    "credit_amount": amount,
                },
            ],
            user=self.admin,
            auto_approve=True,
        )

    def test_balance_service_simple_debit_nature(self) -> None:
        """Conta devedora: saldo = débitos - créditos."""
        self._create_approved_entry(
            str(self.account_ar.id), str(self.account_revenue.id), "2000.00"
        )
        balance = AccountBalanceService.get_balance(self.account_ar)
        self.assertEqual(balance, Decimal("2000.00"))

    def test_balance_service_simple_credit_nature(self) -> None:
        """Conta credora (receita): saldo = créditos - débitos."""
        self._create_approved_entry(
            str(self.account_ar.id), str(self.account_revenue.id), "3000.00"
        )
        balance = AccountBalanceService.get_balance(self.account_revenue)
        self.assertEqual(balance, Decimal("3000.00"))

    def test_balance_service_zero_for_no_entries(self) -> None:
        """Conta sem lançamentos tem saldo zero."""
        balance = AccountBalanceService.get_balance(self.account_bank)
        self.assertEqual(balance, Decimal("0.00"))

    def test_balance_service_excludes_unapproved(self) -> None:
        """Lancamentos nao aprovados nao entram no saldo."""
        JournalEntryService.create_entry(
            description="Nao aprovado",
            competence_date=date.today(),
            origin="MAN",
            lines=[
                {
                    "account_id": str(self.account_ar.id),
                    "debit_amount": "5000.00",
                    "credit_amount": "0.00",
                },
                {
                    "account_id": str(self.account_revenue.id),
                    "debit_amount": "0.00",
                    "credit_amount": "5000.00",
                },
            ],
            user=self.admin,
            auto_approve=False,
        )
        balance = AccountBalanceService.get_balance(self.account_ar)
        self.assertEqual(balance, Decimal("0.00"))

    def test_balance_service_date_filter(self) -> None:
        """Filtro de data limita o saldo ao periodo informado."""
        self._create_approved_entry(
            str(self.account_ar.id), str(self.account_revenue.id), "1000.00"
        )
        # Filtra para o futuro — sem lancamentos
        future_date = date(2099, 1, 1)
        balance = AccountBalanceService.get_balance(
            self.account_ar, start_date=future_date
        )
        self.assertEqual(balance, Decimal("0.00"))

    def test_get_trial_balance_returns_list(self) -> None:
        """Balancete retorna lista de dicts com campos esperados."""
        self._create_approved_entry(
            str(self.account_ar.id), str(self.account_revenue.id), "1500.00"
        )
        result = AccountBalanceService.get_trial_balance(
            start_date=date(2020, 1, 1),
            end_date=date(2099, 12, 31),
        )
        self.assertIsInstance(result, list)
        self.assertGreaterEqual(len(result), 1)
        row = result[0]
        self.assertIn("account_id", row)
        self.assertIn("code", row)
        self.assertIn("balance", row)
        self.assertIn("debit_total", row)
        self.assertIn("credit_total", row)


class TestFiscalPeriodService(AccountingTestCase):
    """Testa gerenciamento de periodos fiscais."""

    def test_get_or_create_period_returns_existing(self) -> None:
        """Retorna período existente sem criar duplicata."""
        today = date.today()
        period1 = FiscalPeriodService.get_or_create_period(today)
        period2 = FiscalPeriodService.get_or_create_period(today)
        self.assertEqual(period1.id, period2.id)

    def test_get_or_create_creates_fiscal_year(self) -> None:
        """Cria FiscalYear automaticamente se não existir."""
        test_date = date(2030, 6, 15)
        period = FiscalPeriodService.get_or_create_period(test_date)
        self.assertEqual(period.fiscal_year.year, 2030)
        self.assertEqual(period.number, 6)

    def test_get_or_create_period_correct_dates(self) -> None:
        """Período criado tem datas corretas (01 ao último dia do mês)."""
        period = FiscalPeriodService.get_or_create_period(date(2025, 2, 15))
        self.assertEqual(period.start_date, date(2025, 2, 1))
        self.assertEqual(period.end_date, date(2025, 2, 28))

    def test_close_period_success(self) -> None:
        """Fecha período sem lancamentos pendentes."""
        period = FiscalPeriodService.close_period(self.fiscal_period, user=self.admin)
        self.assertTrue(period.is_closed)

    def test_close_period_with_pending_entries_raises(self) -> None:
        """Fecha período com lançamentos pendentes lança ValidationError."""
        # Cria lançamento nao aprovado
        JournalEntryService.create_entry(
            description="Pendente",
            competence_date=date.today(),
            origin="MAN",
            lines=[
                {
                    "account_id": str(self.account_ar.id),
                    "debit_amount": "100.00",
                    "credit_amount": "0.00",
                },
                {
                    "account_id": str(self.account_revenue.id),
                    "debit_amount": "0.00",
                    "credit_amount": "100.00",
                },
            ],
            user=self.admin,
        )
        with self.assertRaises(ValidationError):
            FiscalPeriodService.close_period(self.fiscal_period, user=self.admin)

    def test_close_period_already_closed_raises(self) -> None:
        """Fechar período já fechado lança ValidationError."""
        FiscalPeriodService.close_period(self.fiscal_period, user=self.admin)
        self.fiscal_period.refresh_from_db()
        with self.assertRaises(ValidationError):
            FiscalPeriodService.close_period(self.fiscal_period, user=self.admin)

    def test_get_current_period_returns_period(self) -> None:
        """get_current_period() retorna o período do mês corrente."""
        period = FiscalPeriodService.get_current_period()
        self.assertIsNotNone(period)
        today = date.today()
        self.assertEqual(period.number, today.month)
        self.assertEqual(period.fiscal_year.year, today.year)
