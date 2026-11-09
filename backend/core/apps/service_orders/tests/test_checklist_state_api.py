"""Testes do estado do checklist de entrada 3D (carroceria, paradas, histórico)."""

import hashlib

from django.utils import timezone
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.service_orders.models import (
    ChecklistDamage,
    ChecklistItem,
    EntryChecklist,
    FamilyBodyType,
    ServiceOrder,
    ServiceOrderStatus,
)
from apps.vehicle_catalog.models import VehicleFamily, VehicleMake


class ChecklistStateAPITest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        email = "checklist-state@dscar.com"
        email_hash = hashlib.sha256(email.encode()).hexdigest()
        self.user = GlobalUser.objects.filter(email_hash=email_hash).first()
        if self.user is None:
            self.user = GlobalUser.objects.create_user(
                email=email, email_hash=email_hash, password="x"
            )
        make = VehicleMake.objects.create(
            nome="CHK MARCA", nome_normalizado="CHK MARCA", display_name="Chk"
        )
        self.family = VehicleFamily.objects.create(
            make=make, nome="Chk Modelo", nome_normalizado="CHK MODELO"
        )
        self.order = self._order(9971, catalog_family=self.family, color="NAO_INFORMADA")
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})
        self.url = f"/api/v1/service-orders/{self.order.id}/checklist/entrada/"

    def _order(self, number: int, **extra: object) -> ServiceOrder:
        return ServiceOrder.objects.create(
            number=number,
            plate="CHK0C33",
            customer_name="Cliente Checklist Estado",
            status=ServiceOrderStatus.RECEPTION,
            created_by=self.user,
            **extra,
        )

    def test_get_creates_checklist_lazily(self) -> None:
        response = self.client.get(self.url)
        assert response.status_code == 200, response.content
        assert EntryChecklist.objects.count() == 1
        body = response.json()
        assert body["version"] == 1
        assert body["pdf_url"] is None

    def test_items_summary_counts_entry_items_by_status(self) -> None:
        for key, status in (("pneu_de", "ok"), ("pneu_dd", "ok"), ("estepe", "critical")):
            ChecklistItem.objects.create(
                service_order=self.order, category="tires", item_key=key, status=status
            )
        summary = self.client.get(self.url).json()["items_summary"]
        assert summary == {"ok": 2, "attention": 0, "critical": 1, "pending": 0}

    def test_body_type_suggested_from_family(self) -> None:
        FamilyBodyType.objects.create(family=self.family, body_type="suv")
        assert self.client.get(self.url).json()["suggested_body_type"] == "suv"

    def test_patch_body_type_upserts_family(self) -> None:
        FamilyBodyType.objects.create(family=self.family, body_type="suv")
        response = self.client.patch(self.url, {"body_type": "pickup"}, format="json")
        assert response.status_code == 200, response.content
        assert response.json()["body_type"] == "pickup"
        assert FamilyBodyType.objects.get(family=self.family).body_type == "pickup"

    def test_unknown_color_falls_back_to_gray(self) -> None:
        assert self.client.get(self.url).json()["vehicle_color_hex"] == "#9a9a9a"

    def test_known_color_uses_catalog_hex(self) -> None:
        ServiceOrder.objects.filter(pk=self.order.pk).update(color="PRETA")
        assert self.client.get(self.url).json()["vehicle_color_hex"] == "#111111"

    def test_stops_done_merges_by_key(self) -> None:
        self.client.patch(self.url, {"stops_done": {"frente": "done"}}, format="json")
        response = self.client.patch(self.url, {"stops_done": {"teto": "sem_dano"}}, format="json")
        assert response.status_code == 200, response.content
        assert response.json()["stops_done"] == {"frente": "done", "teto": "sem_dano"}

    def test_stops_done_rejects_invalid_value(self) -> None:
        response = self.client.patch(self.url, {"stops_done": {"frente": "ok"}}, format="json")
        assert response.status_code == 400

    def test_patch_locked_checklist_is_409(self) -> None:
        EntryChecklist.objects.create(service_order=self.order, finalized_at=timezone.now())
        response = self.client.patch(self.url, {"body_type": "van"}, format="json")
        assert response.status_code == 409

    def test_saida_type_is_404(self) -> None:
        response = self.client.get(f"/api/v1/service-orders/{self.order.id}/checklist/saida/")
        assert response.status_code == 404

    def test_history_lists_other_os_same_plate(self) -> None:
        other = self._order(9972)
        EntryChecklist.objects.create(service_order=other, finalized_at=timezone.now())
        ChecklistDamage.objects.create(
            service_order=other,
            number=1,
            panel_key="capo",
            damage_type="risco",
            severity="leve",
        )
        EntryChecklist.objects.create(service_order=self.order, finalized_at=timezone.now())
        response = self.client.get(f"{self.url}history/")
        assert response.status_code == 200, response.content
        body = response.json()
        assert [item["os_number"] for item in body] == [9972]
        assert body[0]["damage_count"] == 1

    def test_history_empty_for_placeholder_plate(self) -> None:
        ServiceOrder.objects.filter(pk=self.order.pk).update(plate="N/A")
        other = self._order(9973)
        ServiceOrder.objects.filter(pk=other.pk).update(plate="N/A")
        EntryChecklist.objects.create(service_order=other, finalized_at=timezone.now())
        response = self.client.get(f"{self.url}history/")
        assert response.status_code == 200, response.content
        assert response.json() == []

    def test_history_matches_normalized_plate(self) -> None:
        ServiceOrder.objects.filter(pk=self.order.pk).update(plate="abc-1d23")
        other = self._order(9974)
        ServiceOrder.objects.filter(pk=other.pk).update(plate="ABC1D23")
        EntryChecklist.objects.create(service_order=other, finalized_at=timezone.now())
        response = self.client.get(f"{self.url}history/")
        assert response.status_code == 200, response.content
        assert [item["os_number"] for item in response.json()] == [9974]
