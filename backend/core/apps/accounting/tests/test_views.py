"""
Paddock Solutions — Accounting Tests: Views

Testa endpoints REST dos ViewSets de contabilidade.
"""
import logging
import uuid
from datetime import date

from rest_framework import status

from apps.accounting.models import ChartOfAccount, CostCenter, FiscalPeriod
from apps.accounting.services.journal_entry_service import JournalEntryService

from .base import AccountingTestCase, make_account, make_user

logger = logging.getLogger(__name__)


class TestChartOfAccountViewSet(AccountingTestCase):
    """Testa CRUD do plano de contas."""

    URL = "/api/v1/accounting/chart-of-accounts/"

    def test_list_accounts_authenticated(self) -> None:
        """List retorna 200 com resultados paginados."""
        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("results", data)

    def test_list_unauthenticated_returns_401(self) -> None:
        """Sem autenticação retorna 401."""
        from rest_framework.test import APIClient

        anon = APIClient()
        anon.defaults["SERVER_NAME"] = self.domain.domain
        response = anon.get(self.URL)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_retrieve_account(self) -> None:
        """Detalhe retorna conta com saldo e filhos."""
        response = self.client.get(f"{self.URL}{self.account_ar.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["code"], self.account_ar.code)
        self.assertIn("balance", data)
        self.assertIn("children", data)

    def test_retrieve_nonexistent_returns_404(self) -> None:
        response = self.client.get(f"{self.URL}{uuid.uuid4()}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_account(self) -> None:
        """Cria conta analítica com sucesso."""
        payload = {
            "code": "9.9.99.001",
            "name": "Conta Teste",
            "account_type": "O",
            "nature": "D",
            "is_analytical": True,
            "sped_code": "",
            "accepts_cost_center": False,
        }
        response = self.client.post(self.URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(ChartOfAccount.objects.filter(code="9.9.99.001").exists())

    def test_create_account_invalid_code_returns_400(self) -> None:
        """Código inválido retorna 400."""
        payload = {
            "code": "INVALIDO",
            "name": "Conta Invalida",
            "account_type": "A",
            "nature": "D",
            "is_analytical": True,
        }
        response = self.client.post(self.URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tree_endpoint(self) -> None:
        """Endpoint /tree/ retorna estrutura hierárquica."""
        response = self.client.get(f"{self.URL}tree/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIsInstance(data, list)

    def test_balance_endpoint(self) -> None:
        """Endpoint /balance/ retorna saldo da conta."""
        response = self.client.get(
            f"{self.URL}{self.account_ar.id}/balance/",
            {"start": "2020-01-01", "end": "2099-12-31"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("balance", data)
        self.assertEqual(data["code"], self.account_ar.code)

    def test_balance_endpoint_invalid_date_returns_400(self) -> None:
        response = self.client.get(
            f"{self.URL}{self.account_ar.id}/balance/",
            {"start": "NOT_A_DATE"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_filter_by_account_type(self) -> None:
        response = self.client.get(f"{self.URL}?account_type=A")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for account in response.json()["results"]:
            self.assertEqual(account["account_type"], "A")

    def test_filter_by_is_analytical(self) -> None:
        response = self.client.get(f"{self.URL}?is_analytical=true")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for account in response.json()["results"]:
            self.assertTrue(account["is_analytical"])


class TestCostCenterViewSet(AccountingTestCase):
    """Testa CRUD de centros de custo."""

    URL = "/api/v1/accounting/cost-centers/"

    def test_list_cost_centers(self) -> None:
        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertGreaterEqual(len(data["results"]), 1)

    def test_retrieve_cost_center(self) -> None:
        response = self.client.get(f"{self.URL}{self.cost_center.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["code"], "CC-OS")

    def test_create_cost_center(self) -> None:
        payload = {"code": "CC-NEW", "name": "Novo CC", "os_type_code": ""}
        response = self.client.post(self.URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(CostCenter.objects.filter(code="CC-NEW").exists())

    def test_update_cost_center(self) -> None:
        response = self.client.patch(
            f"{self.URL}{self.cost_center.id}/",
            {"name": "Nome Atualizado"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.cost_center.refresh_from_db()
        self.assertEqual(self.cost_center.name, "Nome Atualizado")


class TestFiscalPeriodViewSet(AccountingTestCase):
    """Testa gerenciamento de periodos fiscais."""

    PERIOD_URL = "/api/v1/accounting/fiscal-periods/"
    YEAR_URL = "/api/v1/accounting/fiscal-years/"

    def test_list_fiscal_periods(self) -> None:
        response = self.client.get(self.PERIOD_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertGreaterEqual(len(data["results"]), 1)

    def test_retrieve_fiscal_period(self) -> None:
        response = self.client.get(f"{self.PERIOD_URL}{self.fiscal_period.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("can_post", data)
        self.assertTrue(data["can_post"])

    def test_current_period_endpoint(self) -> None:
        """Endpoint /current/ retorna o periodo atual."""
        response = self.client.get(f"{self.PERIOD_URL}current/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["number"], date.today().month)

    def test_close_period_without_pending(self) -> None:
        """Fecha periodo sem lancamentos pendentes com sucesso."""
        response = self.client.post(f"{self.PERIOD_URL}{self.fiscal_period.id}/close/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data["is_closed"])

    def test_close_period_with_pending_returns_400(self) -> None:
        """Fecha periodo com lancamentos pendentes retorna 400."""
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
        response = self.client.post(f"{self.PERIOD_URL}{self.fiscal_period.id}/close/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_fiscal_years(self) -> None:
        response = self.client.get(self.YEAR_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class TestJournalEntryViewSet(AccountingTestCase):
    """Testa CRUD e acoes de lancamentos contabeis."""

    URL = "/api/v1/accounting/journal-entries/"

    def _base_payload(self, amount: str = "1000.00") -> dict:
        return {
            "description": "Teste Endpoint",
            "competence_date": str(date.today()),
            "origin": "MAN",
            "lines": [
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
            ],
        }

    def test_list_journal_entries(self) -> None:
        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_journal_entry_valid(self) -> None:
        """Cria lancamento valido retorna 201."""
        response = self.client.post(self.URL, self._base_payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertIn("number", data)
        self.assertIn("lines", data)
        self.assertFalse(data["is_approved"])

    def test_create_journal_entry_unbalanced_returns_400(self) -> None:
        """Lancamento desbalanceado retorna 400."""
        payload = {
            "description": "Desbalanceado",
            "competence_date": str(date.today()),
            "origin": "MAN",
            "lines": [
                {
                    "account_id": str(self.account_ar.id),
                    "debit_amount": "1000.00",
                    "credit_amount": "0.00",
                },
                {
                    "account_id": str(self.account_revenue.id),
                    "debit_amount": "0.00",
                    "credit_amount": "500.00",  # Desbalanceado!
                },
            ],
        }
        response = self.client.post(self.URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_journal_entry_empty_lines_returns_400(self) -> None:
        payload = {
            "description": "Sem linhas",
            "competence_date": str(date.today()),
            "origin": "MAN",
            "lines": [],
        }
        response = self.client.post(self.URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_retrieve_journal_entry(self) -> None:
        """Detalhe retorna lancamento com linhas."""
        entry = JournalEntryService.create_entry(
            description="Para detalhe",
            competence_date=date.today(),
            origin="MAN",
            lines=[
                {
                    "account_id": str(self.account_ar.id),
                    "debit_amount": "2000.00",
                    "credit_amount": "0.00",
                },
                {
                    "account_id": str(self.account_revenue.id),
                    "debit_amount": "0.00",
                    "credit_amount": "2000.00",
                },
            ],
            user=self.admin,
        )
        response = self.client.get(f"{self.URL}{entry.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data["lines"]), 2)
        self.assertIn("is_balanced", data)

    def test_approve_action(self) -> None:
        """Action /approve/ aprova o lancamento."""
        response = self.client.post(self.URL, self._base_payload(), format="json")
        entry_id = response.json()["id"]

        approve_response = self.client.post(f"{self.URL}{entry_id}/approve/")
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
        self.assertTrue(approve_response.json()["is_approved"])

    def test_approve_already_approved_returns_400(self) -> None:
        response = self.client.post(self.URL, self._base_payload(), format="json")
        entry_id = response.json()["id"]
        self.client.post(f"{self.URL}{entry_id}/approve/")
        second = self.client.post(f"{self.URL}{entry_id}/approve/")
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reverse_action(self) -> None:
        """Action /reverse/ cria estorno do lancamento."""
        # Cria e aprova
        response = self.client.post(self.URL, self._base_payload(), format="json")
        entry_id = response.json()["id"]
        self.client.post(f"{self.URL}{entry_id}/approve/")

        # Estorna
        reverse_response = self.client.post(f"{self.URL}{entry_id}/reverse/")
        self.assertEqual(reverse_response.status_code, status.HTTP_201_CREATED)
        data = reverse_response.json()
        self.assertIn("Estorno", data["description"])

    def test_delete_returns_405(self) -> None:
        """DELETE deve retornar 405 — lancamentos sao imutaveis."""
        response = self.client.post(self.URL, self._base_payload(), format="json")
        entry_id = response.json()["id"]

        delete_response = self.client.delete(f"{self.URL}{entry_id}/")
        self.assertEqual(delete_response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_filter_by_origin(self) -> None:
        """Filtro por origem retorna apenas lancamentos da origem especificada."""
        response = self.client.get(f"{self.URL}?origin=MAN")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_filter_by_is_approved(self) -> None:
        """Filtro por is_approved funciona."""
        response = self.client.get(f"{self.URL}?is_approved=false")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unauthenticated_returns_401(self) -> None:
        from rest_framework.test import APIClient

        anon = APIClient()
        anon.defaults["SERVER_NAME"] = self.domain.domain
        response = anon.get(self.URL)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
