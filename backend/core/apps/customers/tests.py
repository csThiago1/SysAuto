"""Testes da app customers."""
from django.test import TestCase

from apps.customers.models import UnifiedCustomer
from apps.customers.serializers import (
    UnifiedCustomerCreateSerializer,
    UnifiedCustomerDetailSerializer,
)


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


class UnifiedCustomerDetailSerializerTest(TestCase):
    """Verifica que o serializer detail expõe os 7 campos de endereço."""

    def test_address_fields_in_detail_serializer(self) -> None:
        c = UnifiedCustomer(
            name="Ana",
            phone="92999990001",
            zip_code="69000-000",
            street="Rua A",
            street_number="1",
            complement="",
            neighborhood="Centro",
            city="Manaus",
            state="AM",
        )
        data = UnifiedCustomerDetailSerializer(c).data
        for field in ["zip_code", "street", "street_number", "complement",
                      "neighborhood", "city", "state"]:
            self.assertIn(field, data)
        # 'address' não deve mais ser um campo direto no serializer
        self.assertNotIn("address", data)

    def test_address_fields_are_blank_by_default(self) -> None:
        c = UnifiedCustomer(name="Bob", phone="92999990002")
        data = UnifiedCustomerDetailSerializer(c).data
        self.assertEqual(data["zip_code"], "")
        self.assertEqual(data["street"], "")
        self.assertEqual(data["state"], "")


class UnifiedCustomerCreateSerializerTest(TestCase):
    """Verifica que o serializer de criação aceita os 7 campos de endereço."""

    def test_create_with_address_fields(self) -> None:
        payload = {
            "name": "Carlos",
            "phone": "92988880001",
            "lgpd_consent": True,
            "zip_code": "69010-050",
            "street": "Av. Getúlio Vargas",
            "street_number": "100",
            "city": "Manaus",
            "state": "AM",
        }
        s = UnifiedCustomerCreateSerializer(data=payload)
        self.assertTrue(s.is_valid(), s.errors)

    def test_create_without_address_fields_is_valid(self) -> None:
        payload = {
            "name": "Daniela",
            "phone": "92977770001",
            "lgpd_consent": True,
        }
        s = UnifiedCustomerCreateSerializer(data=payload)
        self.assertTrue(s.is_valid(), s.errors)
