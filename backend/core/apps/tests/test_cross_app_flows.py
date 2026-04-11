"""
Paddock Solutions — Integration Tests: Cross-App Business Flows
===============================================================

Testa fluxos de negócio completos que atravessam múltiplos apps:

  TC-FLOW-01  Criar ServiceOrder → ReceivableDocument NÃO criado (ainda)
  TC-FLOW-02  ServiceOrder DELIVERED → ReceivableDocument criado automaticamente
  TC-FLOW-03  Fechar Payslip → PayableDocument criado em accounts_payable
  TC-FLOW-04  Criar JournalEntry → saldo refletido em AccountBalance

Todos os testes usam TenantTestCase com schema_context('tenant_dscar') de forma
implícita (TenantTestCase cria e ativa um tenant isolado por suite).

Referências:
- apps/service_orders/services.py  → ServiceOrderService.deliver()
- apps/hr/services.py              → PayslipService.close_payslip()
- apps/accounting/services.py      → JournalEntryService + AccountBalanceService

Requisito: `make dev` deve estar rodando (Docker services healthy).
Execute via: make test-backend
"""
import hashlib
from datetime import date
from decimal import Decimal

from django.db.models import Max
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.accounting.models import ChartOfAccount, CostCenter, FiscalPeriod
from apps.accounting.models.chart_of_accounts import AccountType, NatureType
from apps.accounting.services import AccountBalanceService, JournalEntryService
from apps.accounting.services.fiscal_period_service import FiscalPeriodService
from apps.authentication.models import GlobalUser
from apps.hr.models import Employee, Payslip
from apps.hr.services import PayslipService
from apps.service_orders.models import ServiceOrder


# ─── Helpers ──────────────────────────────────────────────────────────────────


def make_user(
    email: str = "crossapp@dscar.com",
    name: str = "Cross App User",
) -> GlobalUser:
    """Cria GlobalUser com email_hash calculado — padrão do projeto."""
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    return GlobalUser.objects.create_user(
        email=email,
        password="test123",
        name=name,
        email_hash=email_hash,
    )


def make_service_order(
    user: GlobalUser,
    status: str = "reception",
    plate: str = "ABC1234",
    customer_type: str = "private",
    parts_total: Decimal = Decimal("0.00"),
    services_total: Decimal = Decimal("0.00"),
) -> ServiceOrder:
    """
    Cria ServiceOrder diretamente no banco para testes.

    number é obrigatório no model mas gerado via MAX+1 em perform_create.
    Para testes, calculamos aqui para evitar duplicidade.
    """
    max_number = ServiceOrder.objects.aggregate(max_n=Max("number"))["max_n"]
    next_number = (max_number or 0) + 1

    return ServiceOrder.objects.create(
        number=next_number,
        plate=plate,
        make="Toyota",
        model="Corolla",
        status=status,
        customer_type=customer_type,
        customer_name="Cliente Teste Integração",
        parts_total=parts_total,
        services_total=services_total,
        created_by=user,
    )


def make_employee(user: GlobalUser, reg: str = "E-CROSS-01") -> Employee:
    """Cria Employee para testes de folha de pagamento."""
    return Employee.objects.create(
        user=user,
        department="reception",
        position="receptionist",
        registration_number=reg,
        hire_date=date.today(),
        base_salary=Decimal("3000.00"),
        created_by=user,
    )


def make_account(
    code: str,
    name: str,
    account_type: str = AccountType.ASSET,
    nature: str = NatureType.DEBIT,
    is_analytical: bool = True,
) -> ChartOfAccount:
    """Cria ChartOfAccount analítica para testes de contabilidade."""
    level = len(code.split("."))
    return ChartOfAccount.objects.create(
        code=code,
        name=name,
        account_type=account_type,
        nature=nature,
        is_analytical=is_analytical,
        level=level,
    )


# ─── TC-FLOW-01 + TC-FLOW-02: ServiceOrder → ReceivableDocument ──────────────


class TestServiceOrderToReceivable(TenantTestCase):
    """
    Verifica o fluxo OS → Accounts Receivable.

    TC-FLOW-01: Criar OS não cria ReceivableDocument (title criado apenas na entrega)
    TC-FLOW-02: OS entregue (DELIVERED) com total > 0 → ReceivableDocument criado
    """

    def setUp(self) -> None:
        super().setUp()
        self.user = make_user()
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        self.client.force_authenticate(user=self.user)

    def test_create_service_order_does_not_create_receivable(self) -> None:
        """
        TC-FLOW-01: Criar uma OS nova não deve gerar ReceivableDocument.
        O título só é criado no momento da entrega (status=delivered).
        """
        from apps.accounts_receivable.models import ReceivableDocument

        initial_count = ReceivableDocument.objects.count()

        make_service_order(
            user=self.user,
            status="reception",
            parts_total=Decimal("500.00"),
            services_total=Decimal("300.00"),
        )

        final_count = ReceivableDocument.objects.count()
        self.assertEqual(
            final_count,
            initial_count,
            f"Criar OS não deve criar ReceivableDocument. "
            f"Antes: {initial_count}, Depois: {final_count}",
        )

    def test_deliver_service_order_with_total_creates_receivable(self) -> None:
        """
        TC-FLOW-02: Entregar OS com partes+serviços > 0 deve criar ReceivableDocument
        automaticamente via ServiceOrderService.deliver().
        """
        from apps.accounts_receivable.models import ReceivableDocument
        from apps.service_orders.services import ServiceOrderService

        order = make_service_order(
            user=self.user,
            status="ready",
            customer_type="insurer",  # insurer não exige NF-e
            parts_total=Decimal("800.00"),
            services_total=Decimal("1200.00"),
            plate="DEF5678",
        )

        initial_count = ReceivableDocument.objects.count()

        ServiceOrderService.deliver(
            order=order,
            data={},
            delivered_by_id=str(self.user.id),
        )

        final_count = ReceivableDocument.objects.count()

        self.assertEqual(
            final_count,
            initial_count + 1,
            f"Entregar OS deve criar exatamente 1 ReceivableDocument. "
            f"Antes: {initial_count}, Depois: {final_count}",
        )

    def test_delivered_receivable_links_to_service_order(self) -> None:
        """
        TC-FLOW-02b: O ReceivableDocument criado deve ter service_order_id
        apontando para a OS entregue.
        """
        from apps.accounts_receivable.models import ReceivableDocument
        from apps.service_orders.services import ServiceOrderService

        order = make_service_order(
            user=self.user,
            status="ready",
            customer_type="insurer",
            parts_total=Decimal("600.00"),
            services_total=Decimal("400.00"),
            plate="GHI9012",
        )

        ServiceOrderService.deliver(
            order=order,
            data={},
            delivered_by_id=str(self.user.id),
        )

        receivable = ReceivableDocument.objects.filter(
            service_order_id=order.id
        ).first()

        self.assertIsNotNone(
            receivable,
            "ReceivableDocument com service_order_id da OS não encontrado",
        )
        self.assertEqual(
            receivable.amount,
            Decimal("1000.00"),  # 600 + 400
            f"Valor do recebível deve ser parts_total + services_total. "
            f"Esperado: 1000.00, Obtido: {receivable.amount}",
        )

    def test_deliver_service_order_with_zero_total_does_not_create_receivable(self) -> None:
        """
        TC-FLOW-02c: OS com total = 0 não deve criar ReceivableDocument
        (proteção no ServiceOrderService.deliver contra títulos zerados).
        """
        from apps.accounts_receivable.models import ReceivableDocument
        from apps.service_orders.services import ServiceOrderService

        order = make_service_order(
            user=self.user,
            status="ready",
            customer_type="insurer",
            parts_total=Decimal("0.00"),
            services_total=Decimal("0.00"),
            plate="JKL3456",
        )

        initial_count = ReceivableDocument.objects.count()

        ServiceOrderService.deliver(
            order=order,
            data={},
            delivered_by_id=str(self.user.id),
        )

        final_count = ReceivableDocument.objects.count()
        self.assertEqual(
            final_count,
            initial_count,
            "OS com total=0 não deve criar ReceivableDocument",
        )

    def test_service_order_status_is_delivered_after_deliver(self) -> None:
        """
        TC-FLOW-02d: Após ServiceOrderService.deliver(), o status da OS
        deve ser 'delivered'.
        """
        from apps.service_orders.services import ServiceOrderService

        order = make_service_order(
            user=self.user,
            status="ready",
            customer_type="insurer",
            parts_total=Decimal("100.00"),
            services_total=Decimal("100.00"),
            plate="MNO7890",
        )

        result = ServiceOrderService.deliver(
            order=order,
            data={},
            delivered_by_id=str(self.user.id),
        )

        result.refresh_from_db()
        self.assertEqual(
            result.status,
            "delivered",
            f"Status da OS deve ser 'delivered' após entrega. Status: {result.status}",
        )


# ─── TC-FLOW-03: Fechar Payslip → PayableDocument ────────────────────────────


class TestPayslipToPayable(TenantTestCase):
    """
    TC-FLOW-03: Fechar contracheque (close_payslip) deve criar PayableDocument
    em apps.accounts_payable com origin='FOLHA'.

    Fluxo: PayslipService.close_payslip() →
           HRAccountingService.post_payslip() (lançamento contábil) +
           PayableDocumentService.create_payable(origin='FOLHA')
    """

    def setUp(self) -> None:
        super().setUp()
        self.user = make_user(email="payslip_flow@dscar.com", name="Payslip Flow User")
        self.employee = make_employee(self.user, reg="E-PAYSLIP-01")

        # Período fiscal necessário para o lançamento contábil do HRAccountingService
        self.fiscal_period: FiscalPeriod = FiscalPeriodService.get_or_create_period(
            date.today()
        )

        # Contas contábeis mínimas exigidas por HRAccountingService.post_payslip()
        # Mapeamento: HR_ACCOUNT_MAP em hr/accounting_service.py
        self._create_hr_accounts()

        # Centro de custo padrão
        CostCenter.objects.get_or_create(
            code="CC-OS",
            defaults={"name": "Centro Automotivo", "os_type_code": "bodywork"},
        )

    def _create_hr_accounts(self) -> None:
        """Cria contas contábeis mínimas para HRAccountingService não falhar."""
        accounts = [
            ("6.1.01.001", "Salarios e Ordenados", AccountType.EXPENSE, NatureType.DEBIT),
            ("6.1.01.002", "FGTS Patronal", AccountType.EXPENSE, NatureType.DEBIT),
            ("6.1.01.003", "INSS Patronal", AccountType.EXPENSE, NatureType.DEBIT),
            ("6.1.01.006", "Vales Alimentacao", AccountType.EXPENSE, NatureType.DEBIT),
            ("6.1.01.007", "Vale Transporte", AccountType.EXPENSE, NatureType.DEBIT),
            ("6.1.01.008", "Bonificacoes", AccountType.EXPENSE, NatureType.DEBIT),
            ("2.1.03.001", "Salarios a Pagar", AccountType.LIABILITY, NatureType.CREDIT),
            ("2.1.03.002", "FGTS a Recolher", AccountType.LIABILITY, NatureType.CREDIT),
            ("2.1.03.003", "INSS a Recolher", AccountType.LIABILITY, NatureType.CREDIT),
            ("2.1.03.006", "IRRF a Recolher", AccountType.LIABILITY, NatureType.CREDIT),
            ("1.1.01.002", "Banco Bradesco", AccountType.ASSET, NatureType.DEBIT),
            ("1.1.05.002", "Adiantamentos", AccountType.ASSET, NatureType.DEBIT),
        ]
        for code, name, acc_type, nature in accounts:
            level = len(code.split("."))
            ChartOfAccount.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                    "account_type": acc_type,
                    "nature": nature,
                    "is_analytical": True,
                    "level": level,
                },
            )

    def _make_payslip(self) -> Payslip:
        """Cria contracheque aberto (is_closed=False) para teste."""
        return Payslip.objects.create(
            employee=self.employee,
            reference_month=date(date.today().year, date.today().month, 1),
            base_salary=Decimal("3000.00"),
            total_bonuses=Decimal("0.00"),
            total_allowances=Decimal("0.00"),
            total_overtime_hours=Decimal("0.00"),
            total_overtime_value=Decimal("0.00"),
            total_deductions=Decimal("0.00"),
            gross_pay=Decimal("3000.00"),
            net_pay=Decimal("3000.00"),
            is_closed=False,
            created_by=self.user,
        )

    def test_close_payslip_creates_payable_document(self) -> None:
        """
        TC-FLOW-03: Fechar contracheque deve criar PayableDocument com
        origin='FOLHA' em accounts_payable.
        """
        from apps.accounts_payable.models import PayableDocument

        payslip = self._make_payslip()
        initial_count = PayableDocument.objects.count()

        PayslipService.close_payslip(
            payslip_id=str(payslip.id),
            closed_by_id=str(self.user.id),
        )

        final_count = PayableDocument.objects.count()
        self.assertEqual(
            final_count,
            initial_count + 1,
            f"Fechar contracheque deve criar exatamente 1 PayableDocument. "
            f"Antes: {initial_count}, Depois: {final_count}",
        )

    def test_closed_payable_has_correct_origin(self) -> None:
        """
        TC-FLOW-03b: O PayableDocument criado deve ter origin='FOLHA'.
        """
        from apps.accounts_payable.models import PayableDocument

        payslip = self._make_payslip()

        PayslipService.close_payslip(
            payslip_id=str(payslip.id),
            closed_by_id=str(self.user.id),
        )

        payable = PayableDocument.objects.filter(origin="FOLHA").last()

        self.assertIsNotNone(
            payable,
            "PayableDocument com origin='FOLHA' não encontrado após fechar contracheque",
        )

    def test_closed_payable_amount_matches_net_pay(self) -> None:
        """
        TC-FLOW-03c: O valor do PayableDocument deve corresponder ao net_pay do Payslip.
        """
        from apps.accounts_payable.models import PayableDocument

        payslip = self._make_payslip()

        PayslipService.close_payslip(
            payslip_id=str(payslip.id),
            closed_by_id=str(self.user.id),
        )

        payable = PayableDocument.objects.filter(origin="FOLHA").last()

        self.assertIsNotNone(payable)
        self.assertEqual(
            payable.amount,
            payslip.net_pay,
            f"Valor do PayableDocument deve ser {payslip.net_pay}, obtido: {payable.amount}",
        )

    def test_close_payslip_marks_payslip_as_closed(self) -> None:
        """
        TC-FLOW-03d: Após close_payslip, is_closed deve ser True e closed_at preenchido.
        """
        payslip = self._make_payslip()

        PayslipService.close_payslip(
            payslip_id=str(payslip.id),
            closed_by_id=str(self.user.id),
        )

        payslip.refresh_from_db()
        self.assertTrue(payslip.is_closed)
        self.assertIsNotNone(payslip.closed_at)

    def test_close_already_closed_payslip_raises(self) -> None:
        """
        TC-FLOW-03e: Tentar fechar um contracheque já fechado deve levantar ValidationError.
        """
        from django.core.exceptions import ValidationError

        payslip = self._make_payslip()

        PayslipService.close_payslip(
            payslip_id=str(payslip.id),
            closed_by_id=str(self.user.id),
        )

        with self.assertRaises(ValidationError):
            PayslipService.close_payslip(
                payslip_id=str(payslip.id),
                closed_by_id=str(self.user.id),
            )


# ─── TC-FLOW-04: JournalEntry → AccountBalance ───────────────────────────────


class TestJournalEntryToAccountBalance(TenantTestCase):
    """
    TC-FLOW-04: Criar JournalEntry aprovado deve refletir no AccountBalance.

    Fluxo: JournalEntryService.create_entry() →
           AccountBalanceService.get_balance() retorna saldo atualizado.
    """

    def setUp(self) -> None:
        super().setUp()
        self.user = make_user(email="accounting_flow@dscar.com", name="Accounting Flow User")

        # Período fiscal atual
        self.fiscal_period: FiscalPeriod = FiscalPeriodService.get_or_create_period(
            date.today()
        )

        # Contas analíticas balanceadas (D/C)
        self.account_debit = make_account(
            code="1.1.02.001",
            name="Clientes Particulares",
            account_type=AccountType.ASSET,
            nature=NatureType.DEBIT,
        )
        self.account_credit = make_account(
            code="4.1.02.001",
            name="Receita Bruta Servicos",
            account_type=AccountType.REVENUE,
            nature=NatureType.CREDIT,
        )

        # Centro de custo necessário para create_entry
        self.cost_center, _ = CostCenter.objects.get_or_create(
            code="CC-OS",
            defaults={"name": "Centro Automotivo", "os_type_code": "bodywork"},
        )

    def _balanced_lines(self, amount: str = "1000.00") -> list[dict]:
        """Par de linhas D/C balanceadas."""
        return [
            {
                "account_id": str(self.account_debit.id),
                "debit_amount": amount,
                "credit_amount": "0.00",
            },
            {
                "account_id": str(self.account_credit.id),
                "debit_amount": "0.00",
                "credit_amount": amount,
            },
        ]

    def test_journal_entry_appears_in_account_balance(self) -> None:
        """
        TC-FLOW-04: Lançamento contábil aprovado deve ser refletido
        no AccountBalanceService.get_balance() como saldo positivo >= valor lançado.
        """
        entry = JournalEntryService.create_entry(
            description="Receita de servicos OS integração",
            competence_date=date.today(),
            origin="MAN",
            lines=self._balanced_lines("1500.00"),
            user=self.user,
            auto_approve=True,
        )

        self.assertTrue(entry.is_approved)
        self.assertTrue(entry.is_balanced)

        # get_balance retorna Decimal (saldo líquido da conta + subárvore)
        balance: Decimal = AccountBalanceService.get_balance(
            account=self.account_debit,
            start_date=date.today(),
            end_date=date.today(),
        )

        self.assertGreaterEqual(
            balance,
            Decimal("1500.00"),
            f"Saldo líquido da conta deve ser >= 1500.00. Obtido: {balance}",
        )

    def test_unapproved_entry_does_not_affect_balance(self) -> None:
        """
        TC-FLOW-04b: Lançamento não aprovado (rascunho) não deve afetar
        o AccountBalance — saldos são calculados apenas sobre lançamentos aprovados.
        """
        balance_before: Decimal = AccountBalanceService.get_balance(
            account=self.account_debit,
            start_date=date.today(),
            end_date=date.today(),
        )

        JournalEntryService.create_entry(
            description="Lançamento rascunho — não aprovado",
            competence_date=date.today(),
            origin="MAN",
            lines=self._balanced_lines("9999.00"),
            user=self.user,
            auto_approve=False,  # Não aprovar
        )

        balance_after: Decimal = AccountBalanceService.get_balance(
            account=self.account_debit,
            start_date=date.today(),
            end_date=date.today(),
        )

        self.assertEqual(
            balance_before,
            balance_after,
            "Lançamento não aprovado não deve alterar o saldo contábil",
        )

    def test_two_entries_aggregate_correctly_in_balance(self) -> None:
        """
        TC-FLOW-04c: Dois lançamentos aprovados devem somar corretamente no saldo.
        """
        JournalEntryService.create_entry(
            description="Primeira receita",
            competence_date=date.today(),
            origin="MAN",
            lines=self._balanced_lines("500.00"),
            user=self.user,
            auto_approve=True,
        )
        JournalEntryService.create_entry(
            description="Segunda receita",
            competence_date=date.today(),
            origin="MAN",
            lines=self._balanced_lines("300.00"),
            user=self.user,
            auto_approve=True,
        )

        balance: Decimal = AccountBalanceService.get_balance(
            account=self.account_debit,
            start_date=date.today(),
            end_date=date.today(),
        )

        self.assertGreaterEqual(
            balance,
            Decimal("800.00"),
            f"Soma de dois lançamentos deve ser >= 800.00. Obtido: {balance}",
        )

    def test_reversed_entry_excluded_from_balance(self) -> None:
        """
        TC-FLOW-04d: Lançamento estornado deve ser excluído do saldo.
        Após reverse_entry(), o saldo volta ao valor anterior.
        """
        balance_before: Decimal = AccountBalanceService.get_balance(
            account=self.account_debit,
            start_date=date.today(),
            end_date=date.today(),
        )

        entry = JournalEntryService.create_entry(
            description="Lançamento para estorno",
            competence_date=date.today(),
            origin="MAN",
            lines=self._balanced_lines("200.00"),
            user=self.user,
            auto_approve=True,
        )

        self.assertTrue(entry.is_approved)

        # Cria o estorno — reverse_entry() retorna o entry de estorno sem exceção
        JournalEntryService.reverse_entry(
            entry=entry,
            description="Estorno do lançamento de integração",
            user=self.user,
        )

        entry.refresh_from_db()
        self.assertTrue(entry.is_reversed, "Entry deve ser marcado como estornado")

        # Após o estorno, o saldo deve ser igual ao de antes do lançamento
        balance_after: Decimal = AccountBalanceService.get_balance(
            account=self.account_debit,
            start_date=date.today(),
            end_date=date.today(),
        )

        self.assertEqual(
            balance_before,
            balance_after,
            "Após estorno, saldo deve voltar ao valor anterior",
        )

    def test_double_reverse_raises_validation_error(self) -> None:
        """
        TC-FLOW-04e: Estornar um lançamento já estornado deve levantar ValidationError.
        Garante a imutabilidade do registro contábil após estorno.
        """
        from django.core.exceptions import ValidationError

        entry = JournalEntryService.create_entry(
            description="Lançamento estornado duas vezes",
            competence_date=date.today(),
            origin="MAN",
            lines=self._balanced_lines("100.00"),
            user=self.user,
            auto_approve=True,
        )

        # Primeiro estorno — OK
        JournalEntryService.reverse_entry(
            entry=entry,
            user=self.user,
        )

        entry.refresh_from_db()

        # Segundo estorno — deve falhar
        with self.assertRaises(ValidationError):
            JournalEntryService.reverse_entry(
                entry=entry,
                user=self.user,
            )
