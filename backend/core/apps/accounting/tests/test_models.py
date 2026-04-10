"""
Paddock Solutions — Accounting Tests: Models

Testa validacoes, constraints e comportamento dos models.
"""
import logging
from datetime import date

from django.core.exceptions import ValidationError

from apps.accounting.models import (
    ChartOfAccount,
    CostCenter,
    FiscalPeriod,
    FiscalYear,
    JournalEntry,
    JournalEntryLine,
    NumberSequence,
)
from apps.accounting.models.chart_of_accounts import AccountType, NatureType

from .base import AccountingTestCase, make_account

logger = logging.getLogger(__name__)


class TestChartOfAccountModel(AccountingTestCase):
    """Testa o model ChartOfAccount."""

    def test_str_representation(self) -> None:
        """__str__ retorna 'code — name'."""
        account = self.account_ar
        self.assertEqual(str(account), f"{account.code} — {account.name}")

    def test_level_auto_computed_from_code(self) -> None:
        """Nível é calculado automaticamente pelo número de segmentos do código."""
        self.assertEqual(self.account_root_asset.level, 1)  # "1"
        self.assertEqual(self.account_ar.level, 4)  # "1.1.02.001"

    def test_chart_of_account_code_validation_invalid(self) -> None:
        """Código inválido (letras, espaços) deve lançar ValidationError."""
        account = ChartOfAccount(
            code="ABC.DEF",
            name="Conta Inválida",
            account_type="A",
            nature="D",
            is_analytical=True,
            level=2,
        )
        with self.assertRaises(ValidationError) as ctx:
            account.clean()
        self.assertIn("code", str(ctx.exception))

    def test_chart_of_account_code_validation_valid(self) -> None:
        """Código válido não lança exceção."""
        account = ChartOfAccount(
            code="1.2.03",
            name="Conta Válida",
            account_type="A",
            nature="D",
            is_analytical=False,
            level=3,
        )
        account.clean()  # Não deve lançar

    def test_synthetic_account_validation_in_clean(self) -> None:
        """Conta sintética (is_analytical=False) passa na validação clean()."""
        account = ChartOfAccount(
            code="2.1",
            name="Passivo Circulante",
            account_type="L",
            nature="C",
            is_analytical=False,
            level=2,
        )
        account.clean()  # Não deve lançar

    def test_get_full_path_root(self) -> None:
        """Conta raiz retorna apenas seu próprio código."""
        path = self.account_root_asset.get_full_path()
        self.assertEqual(path, "1")

    def test_get_full_path_nested(self) -> None:
        """Conta com pai retorna caminho separado por >."""
        # Cria hierarquia: 1 > 1.1 > 1.1.01 > 1.1.01.001
        parent_l2 = make_account("1.1", "Ativo Circulante", is_analytical=False, parent=self.account_root_asset)
        parent_l3 = make_account("1.1.01", "Caixa", is_analytical=False, parent=parent_l2)
        # Usa código distinto de self.account_bank (1.1.01.001) para evitar conflito unique
        leaf = make_account("1.1.01.099", "Caixa Teste", is_analytical=True, parent=parent_l3)

        # Recarrega com parent para testar get_full_path
        self.assertIn("1.1.01.099", leaf.get_full_path())

    def test_is_active_default_true(self) -> None:
        """is_active deve ser True por padrão."""
        self.assertTrue(self.account_ar.is_active)


class TestCostCenterModel(AccountingTestCase):
    """Testa o model CostCenter."""

    def test_str_representation(self) -> None:
        self.assertEqual(str(self.cost_center), "CC-OS — Centro Automotivo")

    def test_cost_center_is_active_default(self) -> None:
        self.assertTrue(self.cost_center.is_active)

    def test_cost_center_hierarchical(self) -> None:
        """Centro de custo pai/filho funciona com PROTECT."""
        parent_cc = CostCenter.objects.create(code="CC-ROOT", name="Raiz")
        child_cc = CostCenter.objects.create(code="CC-CHILD", name="Filho", parent=parent_cc)
        self.assertEqual(child_cc.parent, parent_cc)


class TestFiscalYearModel(AccountingTestCase):
    """Testa o model FiscalYear."""

    def test_can_add_periods_when_open(self) -> None:
        """Exercício aberto pode receber novos períodos."""
        self.assertTrue(self.fiscal_period.fiscal_year.can_add_periods())

    def test_can_add_periods_when_closed(self) -> None:
        """Exercício fechado não pode receber novos períodos."""
        year = self.fiscal_period.fiscal_year
        year.is_closed = True
        year.save(update_fields=["is_closed", "updated_at"])
        self.assertFalse(year.can_add_periods())

    def test_str_representation_open(self) -> None:
        year = self.fiscal_period.fiscal_year
        year.is_closed = False
        self.assertIn("Aberto", str(year))

    def test_str_representation_closed(self) -> None:
        year = self.fiscal_period.fiscal_year
        year.is_closed = True
        self.assertIn("Encerrado", str(year))


class TestFiscalPeriodModel(AccountingTestCase):
    """Testa o model FiscalPeriod."""

    def test_can_post_open_period(self) -> None:
        """Período aberto + exercício aberto retorna True."""
        self.assertTrue(self.fiscal_period.can_post())

    def test_can_post_closed_period(self) -> None:
        """Período fechado retorna False."""
        self.fiscal_period.is_closed = True
        self.fiscal_period.save(update_fields=["is_closed", "updated_at"])
        self.assertFalse(self.fiscal_period.can_post())

    def test_can_post_closed_fiscal_year(self) -> None:
        """Período com exercício fechado retorna False."""
        year = self.fiscal_period.fiscal_year
        year.is_closed = True
        year.save(update_fields=["is_closed", "updated_at"])
        self.fiscal_period.refresh_from_db()
        self.assertFalse(self.fiscal_period.can_post())

    def test_unique_together_fiscal_year_number(self) -> None:
        """Não pode ter dois períodos com mesmo fiscal_year + number."""
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            FiscalPeriod.objects.create(
                fiscal_year=self.fiscal_period.fiscal_year,
                number=self.fiscal_period.number,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 1, 31),
            )


class TestJournalEntryModel(AccountingTestCase):
    """Testa o model JournalEntry."""

    def _create_balanced_entry(self) -> JournalEntry:
        """Helper: cria lançamento balanceado para testes."""
        from apps.accounting.services.journal_entry_service import JournalEntryService

        return JournalEntryService.create_entry(
            description="Teste",
            competence_date=date.today(),
            origin="MAN",
            lines=[
                {
                    "account_id": str(self.account_ar.id),
                    "debit_amount": "1000.00",
                    "credit_amount": "0.00",
                },
                {
                    "account_id": str(self.account_revenue.id),
                    "debit_amount": "0.00",
                    "credit_amount": "1000.00",
                },
            ],
            user=self.admin,
        )

    def test_journal_entry_is_balanced(self) -> None:
        """Lançamento criado via service é balanceado."""
        entry = self._create_balanced_entry()
        self.assertTrue(entry.is_balanced)

    def test_journal_entry_total_debit_credit(self) -> None:
        """Total de débito e crédito calculados corretamente."""
        from decimal import Decimal

        entry = self._create_balanced_entry()
        self.assertEqual(entry.total_debit, Decimal("1000.00"))
        self.assertEqual(entry.total_credit, Decimal("1000.00"))

    def test_journal_entry_str(self) -> None:
        """__str__ inclui número e descrição."""
        entry = self._create_balanced_entry()
        self.assertIn(entry.number, str(entry))
        self.assertIn("Teste", str(entry))

    def test_journal_entry_default_not_approved(self) -> None:
        """Lançamento criado manualmente não é aprovado por padrão."""
        entry = self._create_balanced_entry()
        self.assertFalse(entry.is_approved)

    def test_journal_entry_default_not_reversed(self) -> None:
        """Lançamento novo não é estornado."""
        entry = self._create_balanced_entry()
        self.assertFalse(entry.is_reversed)


class TestJournalEntryLineModel(AccountingTestCase):
    """Testa validacoes do model JournalEntryLine."""

    def _make_entry(self) -> JournalEntry:
        """Cria lançamento sem linhas para teste das linhas."""
        from apps.accounting.models.sequences import NumberSequence
        from apps.accounting.services.number_service import NumberingService

        return JournalEntry.objects.create(
            number=NumberingService.next("JE"),
            description="Teste linha",
            competence_date=date.today(),
            origin="MAN",
            fiscal_period=self.fiscal_period,
            created_by=self.admin,
        )

    def test_journal_entry_line_cannot_have_both_debit_and_credit(self) -> None:
        """Linha não pode ter D e C simultâneos."""
        entry = self._make_entry()
        line = JournalEntryLine(
            entry=entry,
            account=self.account_ar,
            debit_amount="100.00",
            credit_amount="100.00",
        )
        with self.assertRaises(ValidationError):
            line.clean()

    def test_journal_entry_line_cannot_have_both_zero(self) -> None:
        """Linha não pode ter D e C ambos zerados."""
        entry = self._make_entry()
        line = JournalEntryLine(
            entry=entry,
            account=self.account_ar,
            debit_amount="0.00",
            credit_amount="0.00",
        )
        with self.assertRaises(ValidationError):
            line.clean()

    def test_journal_entry_line_synthetic_account_raises(self) -> None:
        """Conta sintética (is_analytical=False) não pode receber lançamentos."""
        entry = self._make_entry()
        line = JournalEntryLine(
            entry=entry,
            account=self.account_root_asset,  # is_analytical=False
            debit_amount="100.00",
            credit_amount="0.00",
        )
        with self.assertRaises(ValidationError) as ctx:
            line.clean()
        self.assertIn("account", str(ctx.exception))

    def test_journal_entry_line_valid_debit(self) -> None:
        """Linha com apenas débito passa na validação."""
        entry = self._make_entry()
        line = JournalEntryLine(
            entry=entry,
            account=self.account_ar,
            debit_amount="500.00",
            credit_amount="0.00",
        )
        line.clean()  # Não deve lançar
