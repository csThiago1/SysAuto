"""Tests for Sprint 4 PO matching service."""

from django_tenants.test.cases import TenantTestCase

from apps.fiscal.models import NFeEntrada
from apps.fiscal.services.matching import PurchaseOrderMatchingService


class TestPOMatching(TenantTestCase):
    """Tests for PurchaseOrderMatchingService."""

    @classmethod
    def setup_tenant(cls, tenant):
        tenant.schema_name = "test"
        tenant.name = "Test"

    def test_find_matches_returns_empty_without_po(self):
        """Should return empty list when no POs exist for the supplier."""
        nfe = NFeEntrada.objects.create(
            chave_acesso="13260112345678000190550010000010011234567890",
            emitente_cnpj="12345678000190",
            emitente_nome="Test Supplier",
        )
        matches = PurchaseOrderMatchingService.find_matches(nfe)
        self.assertEqual(len(matches), 0)

    def test_find_matches_returns_list_type(self):
        """find_matches should always return a list, even on error."""
        nfe = NFeEntrada.objects.create(
            chave_acesso="13260112345678000190550010000010021234567891",
            emitente_cnpj="99999999000199",
            emitente_nome="Nonexistent Supplier",
        )
        result = PurchaseOrderMatchingService.find_matches(nfe)
        self.assertIsInstance(result, list)

    def test_link_returns_false_for_invalid_po(self):
        """Should return False when PO UUID doesn't exist."""
        nfe = NFeEntrada.objects.create(
            chave_acesso="13260112345678000190550010000010031234567892",
            emitente_cnpj="12345678000190",
            emitente_nome="Test Supplier",
        )
        result = PurchaseOrderMatchingService.link(
            nfe, "00000000-0000-0000-0000-000000000000"
        )
        self.assertFalse(result)

    def test_link_does_not_set_purchase_order_on_failure(self):
        """Failed link should not modify the NFeEntrada.purchase_order."""
        nfe = NFeEntrada.objects.create(
            chave_acesso="13260112345678000190550010000010041234567893",
            emitente_cnpj="12345678000190",
            emitente_nome="Test Supplier",
        )
        PurchaseOrderMatchingService.link(
            nfe, "00000000-0000-0000-0000-000000000000"
        )
        nfe.refresh_from_db()
        self.assertIsNone(nfe.purchase_order_id)

    def test_nfe_entrada_auto_imported_field(self):
        """NFeEntrada should have auto_imported field defaulting to False."""
        nfe = NFeEntrada.objects.create(
            chave_acesso="13260112345678000190550010000010051234567894",
            emitente_cnpj="12345678000190",
            emitente_nome="Test Supplier",
        )
        self.assertFalse(nfe.auto_imported)

    def test_nfe_entrada_purchase_order_field_nullable(self):
        """NFeEntrada.purchase_order should be nullable."""
        nfe = NFeEntrada.objects.create(
            chave_acesso="13260112345678000190550010000010061234567895",
            emitente_cnpj="12345678000190",
            emitente_nome="Test Supplier",
        )
        self.assertIsNone(nfe.purchase_order)
