"""Tests for Sprint 4 auto-import service."""

from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.fiscal.models import NFeEntrada, NFeEntradaItem
from apps.fiscal.services.auto_import import NFeEntradaAutoImportService


class TestAutoImport(TenantTestCase):
    """Tests for NFeEntradaAutoImportService.import_from_webhook()."""

    @classmethod
    def setup_tenant(cls, tenant):
        tenant.schema_name = "test"
        tenant.name = "Test"

    def test_import_creates_nfe_entrada(self):
        """Auto-import should create NFeEntrada with correct fields from webhook data."""
        chave = "13260112345678000190550010000010011234567890"
        nfe_data = {
            "cnpj_emitente": "12345678000190",
            "nome_emitente": "Fornecedor Teste",
            "numero": "1001",
            "serie": "1",
            "data_emissao": "2026-05-01",
            "valor_total": "5000.00",
            "items": [
                {
                    "numero_item": 1,
                    "descricao": "Pecas automotivas",
                    "codigo_ncm": "87089900",
                    "quantidade_comercial": "10",
                    "valor_unitario_comercial": "500.00",
                    "valor_bruto": "5000.00",
                    "unidade_comercial": "UN",
                },
            ],
        }

        result = NFeEntradaAutoImportService.import_from_webhook(chave, nfe_data)

        self.assertIsNotNone(result)
        self.assertEqual(result.chave_acesso, chave)
        self.assertEqual(result.emitente_cnpj, "12345678000190")
        self.assertEqual(result.emitente_nome, "Fornecedor Teste")
        self.assertEqual(result.numero, "1001")
        self.assertEqual(result.serie, "1")
        self.assertTrue(result.auto_imported)
        self.assertEqual(result.status, "importada")
        self.assertEqual(result.valor_total, Decimal("5000.00"))
        self.assertEqual(result.itens.count(), 1)

    def test_import_item_fields(self):
        """Imported items should have correct field mappings."""
        chave = "13260112345678000190550010000010041234567893"
        nfe_data = {
            "cnpj_emitente": "12345678000190",
            "nome_emitente": "Test",
            "valor_total": "500",
            "items": [
                {
                    "numero_item": 1,
                    "descricao": "Tinta PU Branca",
                    "codigo_ncm": "32091010",
                    "quantidade_comercial": "5",
                    "valor_unitario_comercial": "100.00",
                    "valor_bruto": "500.00",
                    "unidade_comercial": "LT",
                },
            ],
        }

        result = NFeEntradaAutoImportService.import_from_webhook(chave, nfe_data)
        item = result.itens.first()

        self.assertEqual(item.numero_item, 1)
        self.assertEqual(item.descricao_original, "Tinta PU Branca")
        self.assertEqual(item.ncm, "32091010")
        self.assertEqual(item.quantidade, Decimal("5"))
        self.assertEqual(item.valor_unitario_bruto, Decimal("100.00"))
        self.assertEqual(item.unidade_compra, "LT")

    def test_import_idempotent(self):
        """Second import with same chave should return None."""
        chave = "13260112345678000190550010000010021234567891"
        nfe_data = {
            "cnpj_emitente": "12345678000190",
            "nome_emitente": "Test",
            "valor_total": "1000",
        }

        result1 = NFeEntradaAutoImportService.import_from_webhook(chave, nfe_data)
        result2 = NFeEntradaAutoImportService.import_from_webhook(chave, nfe_data)

        self.assertIsNotNone(result1)
        self.assertIsNone(result2)
        self.assertEqual(NFeEntrada.objects.filter(chave_acesso=chave).count(), 1)

    def test_import_handles_missing_items(self):
        """Import should work even without items array."""
        chave = "13260112345678000190550010000010031234567892"
        nfe_data = {
            "cnpj_emitente": "12345678000190",
            "nome_emitente": "Test",
            "valor_total": "500",
        }

        result = NFeEntradaAutoImportService.import_from_webhook(chave, nfe_data)

        self.assertIsNotNone(result)
        self.assertEqual(result.itens.count(), 0)

    def test_import_accepts_itens_key(self):
        """Import should accept 'itens' (pt-BR) as alternative to 'items'."""
        chave = "13260112345678000190550010000010051234567894"
        nfe_data = {
            "cnpj_emitente": "99999999000199",
            "nome_emitente": "Fornecedor BR",
            "valor_total": "200",
            "itens": [
                {
                    "numero_item": 1,
                    "descricao": "Parafuso M8",
                    "codigo_ncm": "73181500",
                    "quantidade_comercial": "100",
                    "valor_unitario_comercial": "2.00",
                    "valor_bruto": "200.00",
                    "unidade_comercial": "UN",
                },
            ],
        }

        result = NFeEntradaAutoImportService.import_from_webhook(chave, nfe_data)
        self.assertIsNotNone(result)
        self.assertEqual(result.itens.count(), 1)

    def test_import_defaults_missing_fields(self):
        """Import should handle minimal data without crashing."""
        chave = "13260112345678000190550010000010061234567895"
        nfe_data = {
            "cnpj_emitente": "11111111000111",
            "nome_emitente": "Minimal",
        }

        result = NFeEntradaAutoImportService.import_from_webhook(chave, nfe_data)

        self.assertIsNotNone(result)
        self.assertEqual(result.valor_total, Decimal("0"))
        self.assertEqual(result.numero, "")
        self.assertEqual(result.serie, "")

    def test_import_multiple_items(self):
        """Import should create all items from a multi-item NF-e."""
        chave = "13260112345678000190550010000010071234567896"
        nfe_data = {
            "cnpj_emitente": "12345678000190",
            "nome_emitente": "Multi-item",
            "valor_total": "1500",
            "items": [
                {
                    "numero_item": 1,
                    "descricao": "Item A",
                    "quantidade_comercial": "5",
                    "valor_unitario_comercial": "100.00",
                    "valor_bruto": "500.00",
                    "unidade_comercial": "UN",
                },
                {
                    "numero_item": 2,
                    "descricao": "Item B",
                    "quantidade_comercial": "10",
                    "valor_unitario_comercial": "100.00",
                    "valor_bruto": "1000.00",
                    "unidade_comercial": "KG",
                },
            ],
        }

        result = NFeEntradaAutoImportService.import_from_webhook(chave, nfe_data)

        self.assertIsNotNone(result)
        self.assertEqual(result.itens.count(), 2)
        items = list(result.itens.order_by("numero_item"))
        self.assertEqual(items[0].descricao_original, "Item A")
        self.assertEqual(items[1].descricao_original, "Item B")
