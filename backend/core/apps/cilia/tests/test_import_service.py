"""Tests for Cilia import persistence into Service Orders."""
from __future__ import annotations

import uuid
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.cilia.dtos import ImportService, ParsedBudget, ParsedItemDTO
from apps.cilia.models import ImportAttempt
from apps.insurers.models import Insurer


class CiliaImportServiceTest(TenantTestCase):
    """Valida persistência do importador Cilia no fluxo MVP."""

    @classmethod
    def setup_tenant(cls, tenant):
        tenant.name = "Tenant DS Car Cilia"
        tenant.slug = "dscar_cilia"
        tenant.client_slug = "grupo-dscar_cilia"
        return tenant

    @classmethod
    def setup_domain(cls, domain):
        domain.domain = "cilia.paddock.solutions"
        domain.is_primary = True
        return domain

    def test_cilia_import_creates_service_order_waiting_auth(self) -> None:
        insurer = Insurer.objects.create(
            name=f"Tokio Marine MVP {uuid.uuid4()}",
            trade_name="Tokio Marine",
            code="TOKIO_MARINE_MVP",
            cnpj=f"{uuid.uuid4().int % 10**14:014d}",
            uses_cilia=True,
        )
        attempt = ImportAttempt.objects.create(
            source="cilia",
            trigger="user_requested",
            casualty_number="406571903",
            budget_number="1446508",
            version_number=1,
        )
        parsed = ParsedBudget(
            source="cilia",
            insurer_code=insurer.code or "",
            casualty_number="406571903",
            external_budget_number="1446508",
            external_version="1446508.1",
            external_version_id=30228697,
            external_status="analisado",
            segurado_name="Cliente Importado Cilia",
            segurado_cpf="04497844000140",
            vehicle_plate="TAF8E63",
            vehicle_brand="MERCEDES-BENZ",
            vehicle_description="SPRINTER 517 CDI",
            vehicle_chassis="8AC907655SE254082",
            vehicle_color="BRANCA",
            vehicle_km="12345.0",
            vehicle_year=2025,
            franchise_amount=Decimal("500.00"),
            raw_hash="b" * 64,
            raw_payload={"insurer": {"trade": "Tokio Marine"}},
            items=[
                ParsedItemDTO(
                    description="Parachoque traseiro",
                    external_code="A90788512009K83",
                    quantity=Decimal("1"),
                    unit_price=Decimal("1200.00"),
                    net_price=Decimal("1200.00"),
                )
            ],
        )

        order, version = ImportService._persist_cilia_budget(
            parsed=parsed,
            attempt=attempt,
        )

        self.assertEqual(order.status, "waiting_auth")
        self.assertEqual(order.customer_type, "insurer")
        self.assertEqual(order.insurer_id, insurer.id)
        self.assertEqual(order.casualty_number, "406571903")
        self.assertEqual(order.plate, "TAF8E63")
        self.assertIsNotNone(order.customer_id)
        self.assertTrue(order.customer.roles.filter(role="CLIENT").exists())
        self.assertEqual(version.source, "cilia")
        self.assertEqual(version.external_integration_id, "30228697")
        self.assertEqual(version.items.count(), 1)

        duplicate_attempt = ImportAttempt.objects.create(
            source="cilia",
            trigger="user_requested",
            casualty_number="406571903",
            budget_number="1446508",
            version_number=1,
        )
        duplicate_order, duplicate_version = ImportService._persist_cilia_budget(
            parsed=parsed,
            attempt=duplicate_attempt,
        )

        self.assertEqual(duplicate_order.pk, order.pk)
        self.assertEqual(duplicate_version.pk, version.pk)
