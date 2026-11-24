"""Contas a Pagar gera lancamento contabil no reconhecimento da despesa e na baixa."""

import hashlib
from datetime import date, timedelta
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.accounting.models import JournalEntry
from apps.accounting.models.chart_of_accounts import AccountType, ChartOfAccount, NatureType
from apps.accounts_payable.services import PayableDocumentService
from apps.authentication.models import GlobalUser
from apps.persons.models import Person, PersonRole, RolePessoa

ZERO = Decimal("0.00")
VALOR = Decimal("150.00")


class TestPayableAccounting(TenantTestCase):
    """Titulo com conta de despesa: D despesa / C Fornecedores, depois D Fornecedores / C Banco."""

    def setUp(self) -> None:
        super().setUp()
        self.user = GlobalUser.objects.create_user(
            email="baixa-ap@dscar.com",
            email_hash=hashlib.sha256(b"baixa-ap@dscar.com").hexdigest(),
            password="x",
        )
        self.supplier = Person.objects.create(full_name="Papelaria Central")
        PersonRole.objects.create(person=self.supplier, role=RolePessoa.FORNECEDOR)
        for code, name, account_type, nature in (
            ("2.1.01.001", "Fornecedores Nacionais", AccountType.LIABILITY, NatureType.CREDIT),
            ("1.1.01.002", "Banco Bradesco C/C", AccountType.ASSET, NatureType.DEBIT),
            ("6.1.03.001", "Material de Escritorio", AccountType.EXPENSE, NatureType.DEBIT),
        ):
            ChartOfAccount.objects.create(
                code=code,
                name=name,
                account_type=account_type,
                nature=nature,
                is_analytical=True,
                level=4,
            )

    def _linhas(self, entry: JournalEntry) -> dict[str, tuple[Decimal, Decimal]]:
        return {
            line.account.code: (line.debit_amount, line.credit_amount)
            for line in entry.lines.select_related("account")
        }

    def test_reconhecimento_e_baixa_lancam_nas_contas_certas(self) -> None:
        today = date.today()
        doc = PayableDocumentService.create_payable(
            supplier_id=str(self.supplier.id),
            description="Resma A4",
            amount=VALOR,
            due_date=today + timedelta(days=30),
            competence_date=today,
            expense_account_id=str(ChartOfAccount.objects.get(code="6.1.03.001").id),
            user=self.user,
        )

        reconhecimento = JournalEntry.objects.get()
        self.assertEqual(reconhecimento.competence_date, today)
        self.assertEqual(
            self._linhas(reconhecimento),
            {"6.1.03.001": (VALOR, ZERO), "2.1.01.001": (ZERO, VALOR)},
        )

        payment = PayableDocumentService.record_payment(
            document_id=str(doc.id),
            payment_date=today,
            amount=VALOR,
            user=self.user,
        )

        baixa = JournalEntry.objects.get(id=payment.journal_entry_id)
        self.assertEqual(
            self._linhas(baixa),
            {"2.1.01.001": (VALOR, ZERO), "1.1.01.002": (ZERO, VALOR)},
        )
