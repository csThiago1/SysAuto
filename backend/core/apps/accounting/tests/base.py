"""
Paddock Solutions — Accounting Tests: Base Case

AccountingTestCase — base para todos os testes do modulo de contabilidade.
Usa TenantTestCase do django-tenants + APIClient com force_authenticate.
"""
import hashlib
import logging
from datetime import date

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.accounting.models import ChartOfAccount, CostCenter, FiscalPeriod
from apps.accounting.models.chart_of_accounts import AccountType, NatureType
from apps.accounting.services.fiscal_period_service import FiscalPeriodService
from apps.authentication.models import GlobalUser

logger = logging.getLogger(__name__)


def make_user(
    email: str = "accounting@dscar.com",
    name: str = "Accounting Admin",
) -> GlobalUser:
    """Cria GlobalUser com email_hash calculado."""
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    return GlobalUser.objects.create_user(
        email=email,
        password="test123",
        name=name,
        email_hash=email_hash,
    )


def make_account(
    code: str,
    name: str,
    account_type: str = AccountType.ASSET,
    nature: str = NatureType.DEBIT,
    is_analytical: bool = True,
    parent: ChartOfAccount | None = None,
) -> ChartOfAccount:
    """Cria conta contabil sem passar pelo clean() do save (para testes rapidos)."""
    level = len(code.split("."))
    return ChartOfAccount.objects.create(
        code=code,
        name=name,
        account_type=account_type,
        nature=nature,
        is_analytical=is_analytical,
        level=level,
        parent=parent,
    )


class AccountingTestCase(TenantTestCase):
    """
    Caso base para testes do modulo de contabilidade.

    Configura:
    - APIClient com dominio do tenant de teste
    - Usuario admin autenticado
    - Contas contabeis basicas para testes
    - Periodo fiscal atual
    - Centro de custo padrao
    """

    def setUp(self) -> None:
        super().setUp()

        # APIClient com SERVER_NAME apontando para o dominio do tenant de teste
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain

        # Usuario admin autenticado
        self.admin = make_user()
        self.client.force_authenticate(user=self.admin)

        # Contas contabeis basicas
        # Raizes (nao analiticas)
        self.account_root_asset = make_account(
            code="1", name="ATIVO", account_type="A", nature="D", is_analytical=False
        )
        self.account_root_revenue = make_account(
            code="4", name="RECEITA", account_type="R", nature="C", is_analytical=False
        )
        self.account_root_cost = make_account(
            code="5", name="CUSTOS", account_type="C", nature="D", is_analytical=False
        )

        # Contas analiticas (L4)
        self.account_ar = make_account(
            code="1.1.02.001",
            name="Clientes Particulares",
            account_type="A",
            nature="D",
            is_analytical=True,
        )
        self.account_revenue = make_account(
            code="4.1.02.001",
            name="Receita Bruta Servicos",
            account_type="R",
            nature="C",
            is_analytical=True,
        )
        self.account_bank = make_account(
            code="1.1.01.001",
            name="Caixa Geral",
            account_type="A",
            nature="D",
            is_analytical=True,
        )
        self.account_revenue_parts = make_account(
            code="4.1.03.001",
            name="Receita Bruta Pecas",
            account_type="R",
            nature="C",
            is_analytical=True,
        )
        self.account_cmv = make_account(
            code="5.1.01.001",
            name="CMV Pecas",
            account_type="C",
            nature="D",
            is_analytical=True,
        )
        self.account_inventory = make_account(
            code="1.1.04.001",
            name="Estoque de Pecas",
            account_type="A",
            nature="D",
            is_analytical=True,
        )
        self.account_expense = make_account(
            code="6.1.03.008",
            name="Outras Despesas",
            account_type="X",
            nature="D",
            is_analytical=True,
        )

        # Periodo fiscal atual
        self.fiscal_period: FiscalPeriod = FiscalPeriodService.get_or_create_period(
            date.today()
        )

        # Centro de custo
        self.cost_center = CostCenter.objects.create(
            code="CC-OS",
            name="Centro Automotivo",
            os_type_code="bodywork",
        )
