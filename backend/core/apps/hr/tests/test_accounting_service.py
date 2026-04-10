"""
Paddock Solutions — HR Accounting Service Tests — Sprint 13/14

Testes para HRAccountingService (post_payslip, post_allowance_payment, post_bonus).
Usa TenantTestCase + criação direta de ChartOfAccount via helper (sem management command).

Contas criadas no setUp seguem exatamente o HR_ACCOUNT_MAP de hr/accounting_service.py:
  6.1.01.001  Salarios e Ordenados (bruto)
  6.1.01.002  FGTS (despesa patronal)
  6.1.01.003  INSS Patronal
  6.1.01.006  Vales Alimentacao e Refeicao
  6.1.01.007  Vale Transporte
  6.1.01.008  Bonificacoes e Comissoes
  2.1.03.001  Salarios e Ordenados a Pagar
  2.1.03.002  FGTS a Recolher
  2.1.03.003  INSS a Recolher
  2.1.03.006  IRRF a Recolher
  1.1.01.002  Banco Bradesco C/C
  1.1.05.002  Adiantamentos a Colaboradores
"""
import hashlib
from datetime import date
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.accounting.models import ChartOfAccount
from apps.accounting.models.chart_of_accounts import AccountType, NatureType
from apps.accounting.services.fiscal_period_service import FiscalPeriodService
from apps.authentication.models import GlobalUser
from apps.hr.accounting_service import HRAccountingService
from apps.hr.models import Allowance, Bonus, Employee, Payslip


# ── Helpers ───────────────────────────────────────────────────────────────────


def make_user(email: str = "hr_acc@dscar.com", name: str = "HR Acc User") -> GlobalUser:
    """Cria GlobalUser com email_hash calculado."""
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    return GlobalUser.objects.create_user(
        email=email, password="test123", name=name, email_hash=email_hash
    )


def make_account(
    code: str,
    name: str,
    account_type: str = AccountType.EXPENSE,
    nature: str = NatureType.DEBIT,
) -> ChartOfAccount:
    """Cria ChartOfAccount analítica necessária para os testes de HR."""
    level = len(code.split("."))
    return ChartOfAccount.objects.create(
        code=code,
        name=name,
        account_type=account_type,
        nature=nature,
        is_analytical=True,
        level=level,
    )


def make_employee(user: GlobalUser) -> Employee:
    """Cria Employee mínimo para uso como FK nos testes."""
    return Employee.objects.create(
        user=user,
        department="reception",
        position="receptionist",
        registration_number="HR-ACC-001",
        hire_date=date.today(),
        base_salary=Decimal("3000.00"),
    )


def make_payslip(
    employee: Employee,
    user: GlobalUser,
    gross_pay: Decimal = Decimal("3000.00"),
    net_pay: Decimal = Decimal("2500.00"),
    total_bonuses: Decimal = Decimal("0.00"),
    deduction_breakdown: list | None = None,
) -> Payslip:
    """Cria Payslip de teste com valores explícitos."""
    return Payslip.objects.create(
        employee=employee,
        reference_month=date(2026, 4, 1),
        base_salary=Decimal("3000.00"),
        total_bonuses=total_bonuses,
        total_allowances=Decimal("0.00"),
        total_overtime_hours=Decimal("0.00"),
        total_overtime_value=Decimal("0.00"),
        total_deductions=gross_pay - net_pay,
        gross_pay=gross_pay,
        net_pay=net_pay,
        worked_days=26,
        bonus_breakdown=[],
        allowance_breakdown=[],
        deduction_breakdown=deduction_breakdown or [],
        is_closed=False,
        created_by=user,
    )


# ── Base ──────────────────────────────────────────────────────────────────────


class HRAccountingTestCase(TenantTestCase):
    """
    Base para testes de HRAccountingService.

    Cria todas as contas do HR_ACCOUNT_MAP e um período fiscal para o mês atual,
    garantindo que JournalEntryService.create_entry possa postar os lançamentos.
    """

    def setUp(self) -> None:
        super().setUp()
        self.user = make_user()
        self.employee = make_employee(self.user)

        # Período fiscal para o mês dos testes
        FiscalPeriodService.get_or_create_period(date.today())

        # ── Despesas com pessoal (Natureza D = Devedora) ──────────────────────
        self.acc_salary_gross = make_account(
            "6.1.01.001", "Salarios e Ordenados", AccountType.EXPENSE, NatureType.DEBIT
        )
        self.acc_fgts_expense = make_account(
            "6.1.01.002", "FGTS Patronal", AccountType.EXPENSE, NatureType.DEBIT
        )
        self.acc_inss_expense = make_account(
            "6.1.01.003", "INSS Patronal", AccountType.EXPENSE, NatureType.DEBIT
        )
        self.acc_allowance_meal = make_account(
            "6.1.01.006", "Vales Alimentacao e Refeicao", AccountType.EXPENSE, NatureType.DEBIT
        )
        self.acc_allowance_transport = make_account(
            "6.1.01.007", "Vale Transporte", AccountType.EXPENSE, NatureType.DEBIT
        )
        self.acc_bonus = make_account(
            "6.1.01.008", "Bonificacoes e Comissoes", AccountType.EXPENSE, NatureType.DEBIT
        )

        # ── Passivos trabalhistas (Natureza C = Credora) ──────────────────────
        self.acc_payable_net = make_account(
            "2.1.03.001", "Salarios a Pagar", AccountType.LIABILITY, NatureType.CREDIT
        )
        self.acc_fgts_payable = make_account(
            "2.1.03.002", "FGTS a Recolher", AccountType.LIABILITY, NatureType.CREDIT
        )
        self.acc_inss_payable = make_account(
            "2.1.03.003", "INSS a Recolher", AccountType.LIABILITY, NatureType.CREDIT
        )
        self.acc_irrf_payable = make_account(
            "2.1.03.006", "IRRF a Recolher", AccountType.LIABILITY, NatureType.CREDIT
        )

        # ── Ativos ────────────────────────────────────────────────────────────
        self.acc_bank = make_account(
            "1.1.01.002", "Banco Bradesco C/C", AccountType.ASSET, NatureType.DEBIT
        )
        self.acc_advance = make_account(
            "1.1.05.002", "Adiantamentos a Colaboradores", AccountType.ASSET, NatureType.DEBIT
        )


# ── TC-HR-ACC-01 a TC-HR-ACC-05 ──────────────────────────────────────────────


class TestPostPayslip(HRAccountingTestCase):
    """Testes de lançamento contábil ao fechar folha de pagamento."""

    def test_post_payslip_returns_balanced_journal_entry(self) -> None:
        """TC-HR-ACC-01: post_payslip deve retornar JournalEntry com débitos == créditos."""
        payslip = make_payslip(
            employee=self.employee,
            user=self.user,
            gross_pay=Decimal("3000.00"),
            net_pay=Decimal("2500.00"),
        )
        entry = HRAccountingService.post_payslip(payslip, self.user)
        self.assertIsNotNone(entry)
        total_debit = sum(Decimal(str(line.debit_amount)) for line in entry.lines.all())
        total_credit = sum(Decimal(str(line.credit_amount)) for line in entry.lines.all())
        self.assertEqual(
            total_debit,
            total_credit,
            f"Lançamento desbalanceado: D={total_debit} C={total_credit}",
        )

    def test_post_payslip_with_bonus_includes_bonus_line(self) -> None:
        """TC-HR-ACC-02: post_payslip com bônus inclui linha de Bonificacoes (6.1.01.008)."""
        payslip = make_payslip(
            employee=self.employee,
            user=self.user,
            gross_pay=Decimal("3500.00"),
            net_pay=Decimal("2900.00"),
            total_bonuses=Decimal("500.00"),
        )
        entry = HRAccountingService.post_payslip(payslip, self.user)
        self.assertIsNotNone(entry)
        account_codes = [line.account.code for line in entry.lines.all()]
        self.assertIn(
            "6.1.01.008",
            account_codes,
            "Linha de bonificacoes (6.1.01.008) deve estar presente quando total_bonuses > 0",
        )

    def test_post_payslip_without_salary_account_returns_none(self) -> None:
        """TC-HR-ACC-03: post_payslip sem conta 6.1.01.001 deve retornar None sem crash."""
        # Remove a conta crítica de salário bruto
        ChartOfAccount.objects.filter(code="6.1.01.001").delete()

        payslip = make_payslip(
            employee=self.employee,
            user=self.user,
            gross_pay=Decimal("3000.00"),
            net_pay=Decimal("2500.00"),
        )
        result = HRAccountingService.post_payslip(payslip, self.user)
        self.assertIsNone(result)

    def test_post_payslip_with_inss_includes_inss_line(self) -> None:
        """TC-HR-ACC-01b: post_payslip com INSS no breakdown inclui linha credora de INSS."""
        payslip = make_payslip(
            employee=self.employee,
            user=self.user,
            gross_pay=Decimal("3000.00"),
            net_pay=Decimal("2550.00"),
            deduction_breakdown=[{"type": "inss", "amount": "330.00"}],
        )
        entry = HRAccountingService.post_payslip(payslip, self.user)
        self.assertIsNotNone(entry)
        account_codes = [line.account.code for line in entry.lines.all()]
        self.assertIn(
            "2.1.03.003",
            account_codes,
            "Linha de INSS retido (2.1.03.003) deve estar presente quando inss_retido > 0",
        )

    def test_post_payslip_with_irrf_includes_irrf_line(self) -> None:
        """TC-HR-ACC-01c: post_payslip com IRRF no breakdown inclui linha credora de IRRF."""
        payslip = make_payslip(
            employee=self.employee,
            user=self.user,
            gross_pay=Decimal("3000.00"),
            net_pay=Decimal("2400.00"),
            deduction_breakdown=[
                {"type": "inss", "amount": "330.00"},
                {"type": "irrf", "amount": "270.00"},
            ],
        )
        entry = HRAccountingService.post_payslip(payslip, self.user)
        self.assertIsNotNone(entry)
        account_codes = [line.account.code for line in entry.lines.all()]
        self.assertIn(
            "2.1.03.006",
            account_codes,
            "Linha de IRRF retido (2.1.03.006) deve estar presente quando irrf_retido > 0",
        )


class TestPostAllowancePayment(HRAccountingTestCase):
    """Testes de lançamento contábil ao pagar vale/benefício."""

    def _make_allowance(
        self,
        allowance_type: str = Allowance.AllowanceType.MEAL,
        amount: Decimal = Decimal("600.00"),
    ) -> Allowance:
        """Cria Allowance de teste com status PAID."""
        from django.utils import timezone
        return Allowance.objects.create(
            employee=self.employee,
            allowance_type=allowance_type,
            amount=amount,
            reference_month=date(2026, 4, 1),
            status=Allowance.AllowanceStatus.PAID,
            paid_at=timezone.now(),
            created_by=self.user,
        )

    def test_post_allowance_meal_debits_correct_account(self) -> None:
        """TC-HR-ACC-04: vale tipo MEAL deve debitar conta 6.1.01.006."""
        allowance = self._make_allowance(
            allowance_type=Allowance.AllowanceType.MEAL,
            amount=Decimal("600.00"),
        )
        entry = HRAccountingService.post_allowance_payment(allowance, self.user)
        self.assertIsNotNone(entry)
        debit_lines = [
            line for line in entry.lines.all()
            if Decimal(str(line.debit_amount)) > 0
        ]
        debit_codes = [line.account.code for line in debit_lines]
        self.assertIn(
            "6.1.01.006",
            debit_codes,
            "Vale Refeicao deve debitar conta 6.1.01.006",
        )

    def test_post_allowance_transport_debits_correct_account(self) -> None:
        """TC-HR-ACC-04b: vale tipo TRANSPORT deve debitar conta 6.1.01.007."""
        allowance = self._make_allowance(
            allowance_type=Allowance.AllowanceType.TRANSPORT,
            amount=Decimal("200.00"),
        )
        entry = HRAccountingService.post_allowance_payment(allowance, self.user)
        self.assertIsNotNone(entry)
        debit_codes = [
            line.account.code
            for line in entry.lines.all()
            if Decimal(str(line.debit_amount)) > 0
        ]
        self.assertIn("6.1.01.007", debit_codes)

    def test_post_allowance_credits_bank_account(self) -> None:
        """TC-HR-ACC-04c: pagamento de vale deve creditar conta bancária 1.1.01.002."""
        allowance = self._make_allowance()
        entry = HRAccountingService.post_allowance_payment(allowance, self.user)
        self.assertIsNotNone(entry)
        credit_codes = [
            line.account.code
            for line in entry.lines.all()
            if Decimal(str(line.credit_amount)) > 0
        ]
        self.assertIn("1.1.01.002", credit_codes)

    def test_post_allowance_returns_balanced_entry(self) -> None:
        """TC-HR-ACC-04d: lançamento de vale deve ser balanceado (D == C)."""
        allowance = self._make_allowance(amount=Decimal("750.00"))
        entry = HRAccountingService.post_allowance_payment(allowance, self.user)
        self.assertIsNotNone(entry)
        total_debit = sum(Decimal(str(line.debit_amount)) for line in entry.lines.all())
        total_credit = sum(Decimal(str(line.credit_amount)) for line in entry.lines.all())
        self.assertEqual(total_debit, total_credit)

    def test_post_allowance_without_bank_account_returns_none(self) -> None:
        """TC-HR-ACC-04e: sem conta bancária (1.1.01.002) deve retornar None sem crash."""
        ChartOfAccount.objects.filter(code="1.1.01.002").delete()
        allowance = self._make_allowance()
        result = HRAccountingService.post_allowance_payment(allowance, self.user)
        self.assertIsNone(result)


class TestPostBonus(HRAccountingTestCase):
    """Testes de lançamento contábil ao confirmar bônus."""

    def _make_bonus(self, amount: Decimal = Decimal("1000.00")) -> Bonus:
        """Cria Bonus de teste."""
        return Bonus.objects.create(
            employee=self.employee,
            bonus_type=Bonus.BonusType.PERFORMANCE,
            description="Bonus Desempenho Trimestral",
            amount=amount,
            reference_month=date(2026, 4, 1),
            created_by=self.user,
        )

    def test_post_bonus_debits_bonus_account(self) -> None:
        """TC-HR-ACC-05: post_bonus deve debitar conta 6.1.01.008 Bonificacoes."""
        bonus = self._make_bonus(amount=Decimal("1000.00"))
        entry = HRAccountingService.post_bonus(bonus, self.user)
        self.assertIsNotNone(entry)
        debit_codes = [
            line.account.code
            for line in entry.lines.all()
            if Decimal(str(line.debit_amount)) > 0
        ]
        self.assertIn(
            "6.1.01.008",
            debit_codes,
            "Bonus deve debitar 6.1.01.008 Bonificacoes e Comissoes",
        )

    def test_post_bonus_credits_payable_net_account(self) -> None:
        """TC-HR-ACC-05b: post_bonus deve creditar conta 2.1.03.001 Salarios a Pagar."""
        bonus = self._make_bonus(amount=Decimal("1000.00"))
        entry = HRAccountingService.post_bonus(bonus, self.user)
        self.assertIsNotNone(entry)
        credit_codes = [
            line.account.code
            for line in entry.lines.all()
            if Decimal(str(line.credit_amount)) > 0
        ]
        self.assertIn(
            "2.1.03.001",
            credit_codes,
            "Bonus deve creditar 2.1.03.001 Salarios e Ordenados a Pagar",
        )

    def test_post_bonus_returns_balanced_entry(self) -> None:
        """TC-HR-ACC-05c: lançamento de bônus deve ser balanceado (D == C)."""
        bonus = self._make_bonus(amount=Decimal("500.00"))
        entry = HRAccountingService.post_bonus(bonus, self.user)
        self.assertIsNotNone(entry)
        total_debit = sum(Decimal(str(line.debit_amount)) for line in entry.lines.all())
        total_credit = sum(Decimal(str(line.credit_amount)) for line in entry.lines.all())
        self.assertEqual(total_debit, total_credit)
        self.assertEqual(total_debit, Decimal("500.00"))

    def test_post_bonus_without_bonus_account_returns_none(self) -> None:
        """TC-HR-ACC-05d: sem conta 6.1.01.008 deve retornar None sem levantar exceção."""
        ChartOfAccount.objects.filter(code="6.1.01.008").delete()
        bonus = self._make_bonus()
        result = HRAccountingService.post_bonus(bonus, self.user)
        self.assertIsNone(result)

    def test_post_bonus_with_zero_amount_returns_none(self) -> None:
        """TC-HR-ACC-05e: bônus com amount=0 deve retornar None sem crash."""
        bonus = self._make_bonus(amount=Decimal("0.00"))
        result = HRAccountingService.post_bonus(bonus, self.user)
        self.assertIsNone(result)
