"""Tests for Sprint 6 Financial Dashboard Service."""

import hashlib
import uuid
from datetime import date
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser


# ── Helpers ───────────────────────────────────────────────────────────────────


def make_user(email: str = "dashboard_test@dscar.com") -> GlobalUser:
    """Cria GlobalUser com email_hash -- necessario para unique constraint."""
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    return GlobalUser.objects.create_user(
        email=email, password="test123", name="Dashboard Test", email_hash=email_hash
    )


# ── Tests ─────────────────────────────────────────────────────────────────────


class TestFinancialDashboard(TenantTestCase):
    """Tests for FinancialDashboardService.get_summary()."""

    @classmethod
    def setup_tenant(cls, tenant):
        tenant.schema_name = "test"
        tenant.name = "Test"

    def setUp(self):
        self.user = make_user()
        today = date.today()

        # Create test AR document
        from apps.accounts_receivable.models import ReceivableDocument

        ReceivableDocument.objects.create(
            customer_id=uuid.uuid4(),
            customer_name="Customer 1",
            description="Test AR",
            amount=Decimal("5000.00"),
            due_date=today,
            competence_date=today,
            status="open",
            created_by=self.user,
        )

        # Create test AP document
        from apps.accounts_payable.models import PayableDocument, Supplier

        supplier = Supplier.objects.create(name="Supplier 1", cnpj="11111111000111")
        PayableDocument.objects.create(
            supplier=supplier,
            description="Test AP",
            amount=Decimal("3000.00"),
            due_date=today,
            competence_date=today,
            status="open",
        )

    def test_summary_returns_all_keys(self):
        """Summary must contain all required top-level keys."""
        from apps.accounting.services.financial_dashboard import (
            FinancialDashboardService,
        )

        today = date.today()
        result = FinancialDashboardService.get_summary(today.replace(day=1), today)

        required_keys = [
            "receita_mes",
            "despesa_mes",
            "ar_vencidos",
            "ap_vencidos",
            "fluxo_caixa_30d",
            "notas_emitidas",
            "notas_recebidas",
            "notas_pendentes",
            "aging_ar",
            "aging_ap",
        ]
        for key in required_keys:
            self.assertIn(key, result, f"Missing key: {key}")

    def test_cash_flow_has_4_weeks(self):
        """Cash flow projection should have exactly 4 week entries."""
        from apps.accounting.services.financial_dashboard import (
            FinancialDashboardService,
        )

        today = date.today()
        result = FinancialDashboardService.get_summary(today.replace(day=1), today)
        self.assertEqual(len(result["fluxo_caixa_30d"]), 4)

    def test_cash_flow_week_structure(self):
        """Each cash flow week should have semana, inicio, fim, entradas, saidas, saldo."""
        from apps.accounting.services.financial_dashboard import (
            FinancialDashboardService,
        )

        today = date.today()
        result = FinancialDashboardService.get_summary(today.replace(day=1), today)
        week = result["fluxo_caixa_30d"][0]
        self.assertIn("semana", week)
        self.assertIn("inicio", week)
        self.assertIn("fim", week)
        self.assertIn("entradas", week)
        self.assertIn("saidas", week)
        self.assertIn("saldo", week)

    def test_aging_has_4_bands(self):
        """Aging reports should have 4 bands: 0-30, 31-60, 61-90, 90+."""
        from apps.accounting.services.financial_dashboard import (
            FinancialDashboardService,
        )

        today = date.today()
        result = FinancialDashboardService.get_summary(today.replace(day=1), today)
        self.assertEqual(len(result["aging_ar"]), 4)
        self.assertEqual(len(result["aging_ap"]), 4)

    def test_aging_band_labels(self):
        """Aging bands should be labeled 0-30, 31-60, 61-90, 90+."""
        from apps.accounting.services.financial_dashboard import (
            FinancialDashboardService,
        )

        today = date.today()
        result = FinancialDashboardService.get_summary(today.replace(day=1), today)
        faixas = [a["faixa"] for a in result["aging_ar"]]
        self.assertEqual(faixas, ["0-30", "31-60", "61-90", "90+"])

    def test_aging_band_structure(self):
        """Each aging band should have faixa, count, and total."""
        from apps.accounting.services.financial_dashboard import (
            FinancialDashboardService,
        )

        today = date.today()
        result = FinancialDashboardService.get_summary(today.replace(day=1), today)
        for band in result["aging_ar"]:
            self.assertIn("faixa", band)
            self.assertIn("count", band)
            self.assertIn("total", band)

    def test_overdue_summary_structure(self):
        """ar_vencidos and ap_vencidos should have count and total keys."""
        from apps.accounting.services.financial_dashboard import (
            FinancialDashboardService,
        )

        today = date.today()
        result = FinancialDashboardService.get_summary(today.replace(day=1), today)
        for key in ("ar_vencidos", "ap_vencidos"):
            self.assertIn("count", result[key])
            self.assertIn("total", result[key])

    def test_notas_emitidas_structure(self):
        """notas_emitidas should have por_tipo, total_count, total_value."""
        from apps.accounting.services.financial_dashboard import (
            FinancialDashboardService,
        )

        today = date.today()
        result = FinancialDashboardService.get_summary(today.replace(day=1), today)
        notas = result["notas_emitidas"]
        self.assertIn("por_tipo", notas)
        self.assertIn("total_count", notas)
        self.assertIn("total_value", notas)

    def test_notas_emitidas_has_3_types(self):
        """por_tipo should have entries for nfse, nfe, nfce."""
        from apps.accounting.services.financial_dashboard import (
            FinancialDashboardService,
        )

        today = date.today()
        result = FinancialDashboardService.get_summary(today.replace(day=1), today)
        por_tipo = result["notas_emitidas"]["por_tipo"]
        self.assertIn("nfse", por_tipo)
        self.assertIn("nfe", por_tipo)
        self.assertIn("nfce", por_tipo)

    def test_notas_pendentes_is_int(self):
        """notas_pendentes should return an integer count."""
        from apps.accounting.services.financial_dashboard import (
            FinancialDashboardService,
        )

        today = date.today()
        result = FinancialDashboardService.get_summary(today.replace(day=1), today)
        self.assertIsInstance(result["notas_pendentes"], int)

    def test_receita_despesa_are_strings(self):
        """receita_mes and despesa_mes should be string representations of Decimal."""
        from apps.accounting.services.financial_dashboard import (
            FinancialDashboardService,
        )

        today = date.today()
        result = FinancialDashboardService.get_summary(today.replace(day=1), today)
        self.assertIsInstance(result["receita_mes"], str)
        self.assertIsInstance(result["despesa_mes"], str)
