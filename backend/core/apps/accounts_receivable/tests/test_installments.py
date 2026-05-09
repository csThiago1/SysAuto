"""Tests for Sprint 5 installment support in accounts receivable."""

import hashlib
import uuid
from datetime import date, timedelta
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.accounts_receivable.models import ReceivableDocument, ReceivableStatus
from apps.accounts_receivable.services import ReceivableDocumentService


# ── Helpers ───────────────────────────────────────────────────────────────────


def make_user(email: str = "installment_test@dscar.com") -> GlobalUser:
    """Cria GlobalUser com email_hash -- necessario para unique constraint."""
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    return GlobalUser.objects.create_user(
        email=email, password="test123", name="Installment Test", email_hash=email_hash
    )


# ── Tests ─────────────────────────────────────────────────────────────────────


class TestInstallments(TenantTestCase):
    """Tests for ReceivableDocumentService.create_installments()."""

    @classmethod
    def setup_tenant(cls, tenant):
        tenant.schema_name = "test"
        tenant.name = "Test"

    def setUp(self):
        self.user = make_user()
        self.customer_id = str(uuid.uuid4())

    def _base_data(self, amount: Decimal = Decimal("3000.00")) -> dict:
        """Build base_data dict for create_installments."""
        return {
            "customer_id": self.customer_id,
            "customer_name": "Test Customer",
            "description": "OS 0100 - Servicos",
            "amount": amount,
            "due_date": date.today(),
            "competence_date": date.today(),
            "origin": "NFSE",
        }

    def test_create_3_installments(self):
        """Should create 3 receivable documents with equal amounts."""
        parcelas = ReceivableDocumentService.create_installments(
            base_data=self._base_data(Decimal("3000.00")),
            num_parcelas=3,
            interval_days=30,
            user=self.user,
        )
        self.assertEqual(len(parcelas), 3)
        self.assertEqual(parcelas[0].amount, Decimal("1000.00"))
        self.assertEqual(parcelas[1].amount, Decimal("1000.00"))
        self.assertEqual(parcelas[2].amount, Decimal("1000.00"))

    def test_installments_handle_rounding(self):
        """Last installment should absorb rounding difference so total is exact."""
        parcelas = ReceivableDocumentService.create_installments(
            base_data=self._base_data(Decimal("100.00")),
            num_parcelas=3,
            user=self.user,
        )
        total = sum(p.amount for p in parcelas)
        self.assertEqual(total, Decimal("100.00"))

    def test_installments_stagger_due_dates(self):
        """Due dates should be spaced by interval_days."""
        today = date.today()
        parcelas = ReceivableDocumentService.create_installments(
            base_data=self._base_data(Decimal("6000.00")),
            num_parcelas=3,
            interval_days=30,
            user=self.user,
        )
        self.assertEqual(parcelas[0].due_date, today)
        self.assertEqual(parcelas[1].due_date, today + timedelta(days=30))
        self.assertEqual(parcelas[2].due_date, today + timedelta(days=60))

    def test_installments_description_numbered(self):
        """Each installment description should include (N/total)."""
        parcelas = ReceivableDocumentService.create_installments(
            base_data=self._base_data(Decimal("900.00")),
            num_parcelas=3,
            user=self.user,
        )
        self.assertIn("(1/3)", parcelas[0].description)
        self.assertIn("(2/3)", parcelas[1].description)
        self.assertIn("(3/3)", parcelas[2].description)

    def test_single_installment(self):
        """Single installment should equal the full amount."""
        parcelas = ReceivableDocumentService.create_installments(
            base_data=self._base_data(Decimal("500.00")),
            num_parcelas=1,
            user=self.user,
        )
        self.assertEqual(len(parcelas), 1)
        self.assertEqual(parcelas[0].amount, Decimal("500.00"))

    def test_installments_status_open(self):
        """All installments with future due dates should be status=open."""
        data = self._base_data(Decimal("3000.00"))
        data["due_date"] = date.today() + timedelta(days=5)
        parcelas = ReceivableDocumentService.create_installments(
            base_data=data,
            num_parcelas=3,
            interval_days=30,
            user=self.user,
        )
        for p in parcelas:
            self.assertEqual(p.status, ReceivableStatus.OPEN)

    def test_installments_rounding_uneven_amount(self):
        """100/3 = 33.33 + 33.33 + 33.34 -- last absorbs remainder."""
        parcelas = ReceivableDocumentService.create_installments(
            base_data=self._base_data(Decimal("100.00")),
            num_parcelas=3,
            user=self.user,
        )
        # First two parcels: 33.33 each (rounded up), last absorbs the rest
        total = sum(p.amount for p in parcelas)
        self.assertEqual(total, Decimal("100.00"))
        self.assertEqual(len(parcelas), 3)

    def test_installments_custom_interval(self):
        """Should respect custom interval_days (e.g., 15 days)."""
        today = date.today()
        parcelas = ReceivableDocumentService.create_installments(
            base_data=self._base_data(Decimal("600.00")),
            num_parcelas=2,
            interval_days=15,
            user=self.user,
        )
        self.assertEqual(parcelas[0].due_date, today)
        self.assertEqual(parcelas[1].due_date, today + timedelta(days=15))

    def test_installments_persist_in_db(self):
        """All installments should be persisted in the database."""
        initial_count = ReceivableDocument.objects.count()
        ReceivableDocumentService.create_installments(
            base_data=self._base_data(Decimal("1200.00")),
            num_parcelas=4,
            user=self.user,
        )
        self.assertEqual(ReceivableDocument.objects.count(), initial_count + 4)
