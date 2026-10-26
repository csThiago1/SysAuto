"""
Testes do laço de aprendizado: salvar despesa com conta vira regra permanente.

É o que faz a sugestão melhorar sozinha — sem isso, a LLM seria reconsultada
para sempre no mesmo item.
"""

import hashlib
from datetime import date, timedelta
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.accounting.models.account_suggestion import AccountSuggestionRule, SuggestionSource
from apps.accounting.models.chart_of_accounts import AccountType, ChartOfAccount, NatureType
from apps.authentication.models import GlobalUser
from apps.persons.models import Person, PersonRole, RolePessoa

URL = "/api/v1/accounts-payable/documents/"


class PayableAccountLearningTest(TenantTestCase):
    """POST de despesa com conta contábil grava regra HUMAN."""

    def setUp(self) -> None:
        super().setUp()
        self.user = GlobalUser.objects.create_user(
            email="aprendizado@dscar.com",
            email_hash=hashlib.sha256(b"aprendizado@dscar.com").hexdigest(),
            password="x",
        )
        self.supplier = Person.objects.create(full_name="Papelaria Central")
        PersonRole.objects.create(person=self.supplier, role=RolePessoa.FORNECEDOR)

        self.escritorio = ChartOfAccount.objects.create(
            code="6.1.03.001",
            name="Material de Escritorio e Limpeza",
            account_type=AccountType.EXPENSE,
            nature=NatureType.DEBIT,
            is_analytical=True,
            level=4,
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})
        self.client.defaults["SERVER_NAME"] = "tenant.test.com"

    def _payload(self, description: str, account: ChartOfAccount | None) -> dict:
        today = date.today()
        payload = {
            "supplier_id": str(self.supplier.id),
            "description": description,
            "amount": "150.00",
            "due_date": str(today + timedelta(days=30)),
            "competence_date": str(today),
        }
        if account is not None:
            payload["expense_account_id"] = str(account.id)
        return payload

    def test_saving_with_account_creates_human_rule(self) -> None:
        """A conta escolhida pelo usuário vira regra para a descrição."""
        resp = self.client.post(
            URL, self._payload("Tesoura escolar", self.escritorio), format="json"
        )
        self.assertEqual(resp.status_code, 201, resp.data)

        rule = AccountSuggestionRule.objects.get(term="tesoura escolar")
        self.assertEqual(rule.account, self.escritorio)
        self.assertEqual(rule.source, SuggestionSource.HUMAN)

    def test_saving_without_account_creates_no_rule(self) -> None:
        """Despesa sem classificação não inventa regra."""
        resp = self.client.post(URL, self._payload("Item sem conta", None), format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(AccountSuggestionRule.objects.count(), 0)

    def test_human_rule_overrides_previous_seed(self) -> None:
        """Correção do usuário sobrescreve a carga inicial do mesmo termo."""
        outra = ChartOfAccount.objects.create(
            code="6.1.03.008",
            name="Outras Despesas Administrativas",
            account_type=AccountType.EXPENSE,
            nature=NatureType.DEBIT,
            is_analytical=True,
            level=4,
        )
        AccountSuggestionRule.objects.create(
            term="tesoura escolar", account=outra, source=SuggestionSource.SEED
        )

        resp = self.client.post(
            URL, self._payload("Tesoura escolar", self.escritorio), format="json"
        )
        self.assertEqual(resp.status_code, 201, resp.data)

        rule = AccountSuggestionRule.objects.get(term="tesoura escolar")
        self.assertEqual(rule.account, self.escritorio)
        self.assertEqual(rule.source, SuggestionSource.HUMAN)
        self.assertEqual(AccountSuggestionRule.objects.count(), 1)
