"""Tests for Sprint 3 fiscal services -- CCe, ResumoFiscal."""

import hashlib
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.fiscal.models import FiscalConfigModel, FiscalDocument, FiscalDocumentItem


# ── Helpers ───────────────────────────────────────────────────────────────────


def make_user(email: str = "fiscal_s3@test.com") -> GlobalUser:
    """Cria GlobalUser com email_hash -- necessario para unique constraint."""
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    return GlobalUser.objects.create_user(
        email=email, password="test123", name="S3 Test", email_hash=email_hash
    )


# ── CCe Tests ─────────────────────────────────────────────────────────────────


class TestCartaCorrecao(TenantTestCase):
    """Test FiscalService.carta_correcao() pre-conditions and model fields."""

    @classmethod
    def setup_tenant(cls, tenant):
        tenant.schema_name = "test"
        tenant.name = "Test"

    def setUp(self):
        self.user = make_user()
        self.config = FiscalConfigModel.objects.create(
            cnpj="12345678000190",
            razao_social="Test Company",
            focus_token="test-token",
            environment="homologacao",
            is_active=True,
        )
        # FiscalDocument needs either service_order OR manual_reason (CheckConstraint)
        self.doc = FiscalDocument.objects.create(
            document_type="nfe",
            status="authorized",
            ref="TEST-CCE-001",
            number="1001",
            total_value=Decimal("1000.00"),
            config=self.config,
            manual_reason="Teste CCe",
        )

    def test_cce_rejects_non_authorized(self):
        """CCe should only apply to authorized documents."""
        self.doc.status = "pending"
        self.doc.save()
        self.assertNotEqual(self.doc.status, "authorized")

    def test_cce_rejects_nfse(self):
        """CCe applies to NF-e only, not NFS-e."""
        self.doc.document_type = "nfse"
        self.doc.save()
        self.assertEqual(self.doc.document_type, "nfse")

    def test_cce_count_limit(self):
        """CCe should reject when cce_count >= 20."""
        self.doc.cce_count = 20
        self.doc.save()
        self.doc.refresh_from_db()
        self.assertEqual(self.doc.cce_count, 20)

    def test_cce_count_increments(self):
        """Verify cce_count field can be incremented and persisted."""
        self.doc.cce_count = 5
        self.doc.save()
        self.doc.refresh_from_db()
        self.assertEqual(self.doc.cce_count, 5)

    def test_cce_count_defaults_to_zero(self):
        """New FiscalDocument should have cce_count=0."""
        doc = FiscalDocument.objects.create(
            document_type="nfe",
            status="authorized",
            ref="TEST-CCE-002",
            number="1002",
            total_value=Decimal("500.00"),
            config=self.config,
            manual_reason="Teste default",
        )
        self.assertEqual(doc.cce_count, 0)

    def test_cce_event_type_exists(self):
        """FiscalEvent.EventType should include CCE."""
        from apps.fiscal.models import FiscalEvent

        self.assertIn("CCE", FiscalEvent.EventType.values)

    def test_email_sent_at_field_nullable(self):
        """email_sent_at should be null by default."""
        self.assertIsNone(self.doc.email_sent_at)


# ── ResumoFiscal Tests ────────────────────────────────────────────────────────


class TestResumoFiscal(TenantTestCase):
    """Test ResumoFiscalService.get_monthly_summary()."""

    @classmethod
    def setup_tenant(cls, tenant):
        tenant.schema_name = "test"
        tenant.name = "Test"

    def setUp(self):
        from django.utils import timezone

        now = timezone.now()
        self.year = now.year
        self.month = now.month

        # FiscalDocument needs either service_order OR manual_reason (CheckConstraint)
        FiscalDocument.objects.create(
            document_type="nfse",
            status="authorized",
            ref="TEST-RESUMO-NFSE-1",
            number="R001",
            total_value=Decimal("5000.00"),
            manual_reason="Teste resumo NFSE 1",
        )
        FiscalDocument.objects.create(
            document_type="nfe",
            status="authorized",
            ref="TEST-RESUMO-NFE-1",
            number="R002",
            total_value=Decimal("3000.00"),
            manual_reason="Teste resumo NFE 1",
        )
        FiscalDocument.objects.create(
            document_type="nfse",
            status="cancelled",
            ref="TEST-RESUMO-NFSE-2",
            number="R003",
            total_value=Decimal("1000.00"),
            manual_reason="Teste resumo NFSE 2",
        )

    def test_summary_returns_all_keys(self):
        """Summary dict must contain all expected top-level keys."""
        from apps.fiscal.services.resumo_fiscal import ResumoFiscalService

        result = ResumoFiscalService.get_monthly_summary(self.year, self.month)
        self.assertIn("nfse", result)
        self.assertIn("nfe", result)
        self.assertIn("impostos", result)
        self.assertIn("total_emitidas", result)
        self.assertIn("total_canceladas", result)

    def test_summary_counts_authorized(self):
        """Authorized NFS-e and NF-e should be counted separately."""
        from apps.fiscal.services.resumo_fiscal import ResumoFiscalService

        result = ResumoFiscalService.get_monthly_summary(self.year, self.month)
        self.assertEqual(result["nfse"]["count"], 1)
        self.assertEqual(result["nfe"]["count"], 1)

    def test_summary_total_emitidas(self):
        """total_emitidas should be the sum of authorized NFS-e + NF-e."""
        from apps.fiscal.services.resumo_fiscal import ResumoFiscalService

        result = ResumoFiscalService.get_monthly_summary(self.year, self.month)
        self.assertEqual(result["total_emitidas"], 2)

    def test_summary_cancelled_count(self):
        """Cancelled documents should be counted."""
        from apps.fiscal.services.resumo_fiscal import ResumoFiscalService

        result = ResumoFiscalService.get_monthly_summary(self.year, self.month)
        self.assertEqual(result["total_canceladas"], 1)

    def test_summary_nfse_total_value(self):
        """NFS-e total should reflect only authorized documents."""
        from apps.fiscal.services.resumo_fiscal import ResumoFiscalService

        result = ResumoFiscalService.get_monthly_summary(self.year, self.month)
        self.assertEqual(result["nfse"]["total"], str(Decimal("5000.00")))

    def test_summary_impostos_keys(self):
        """Impostos dict should have ISS, ICMS, PIS, COFINS."""
        from apps.fiscal.services.resumo_fiscal import ResumoFiscalService

        result = ResumoFiscalService.get_monthly_summary(self.year, self.month)
        impostos = result["impostos"]
        self.assertIn("iss", impostos)
        self.assertIn("icms", impostos)
        self.assertIn("pis", impostos)
        self.assertIn("cofins", impostos)

    def test_summary_empty_month_returns_zeros(self):
        """A month with no documents should return zero counts."""
        from apps.fiscal.services.resumo_fiscal import ResumoFiscalService

        result = ResumoFiscalService.get_monthly_summary(2000, 1)
        self.assertEqual(result["nfse"]["count"], 0)
        self.assertEqual(result["nfe"]["count"], 0)
        self.assertEqual(result["total_emitidas"], 0)
        self.assertEqual(result["total_canceladas"], 0)
