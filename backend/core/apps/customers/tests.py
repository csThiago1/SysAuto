"""Testes da app customers."""
from django.test import TestCase

from apps.customers.models import UnifiedCustomer


class UnifiedCustomerAddressTest(TestCase):
    """Verifica que os campos de endereço individuais existem e que a
    property `address` computa corretamente."""

    def _make_customer(self, **kwargs) -> UnifiedCustomer:
        defaults = {
            "name": "Test",
            "phone": "92999990000",
            "lgpd_consent_version": "1.0",
        }
        defaults.update(kwargs)
        return UnifiedCustomer(**defaults)

    def test_address_fields_exist(self) -> None:
        c = self._make_customer(
            zip_code="69000-000",
            street="Rua das Flores",
            street_number="100",
            complement="Ap 2",
            neighborhood="Centro",
            city="Manaus",
            state="AM",
        )
        self.assertEqual(c.zip_code, "69000-000")
        self.assertEqual(c.street, "Rua das Flores")
        self.assertEqual(c.street_number, "100")
        self.assertEqual(c.complement, "Ap 2")
        self.assertEqual(c.neighborhood, "Centro")
        self.assertEqual(c.city, "Manaus")
        self.assertEqual(c.state, "AM")

    def test_address_property_computes(self) -> None:
        c = self._make_customer(
            street="Av. Eduardo Ribeiro",
            street_number="520",
            neighborhood="Centro",
        )
        addr = c.address
        self.assertIn("Av. Eduardo Ribeiro", addr)
        self.assertIn("520", addr)

    def test_address_property_empty_when_no_street(self) -> None:
        c = self._make_customer()
        self.assertEqual(c.address, "")
