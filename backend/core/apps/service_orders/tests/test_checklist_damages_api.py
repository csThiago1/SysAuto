"""Testes da API de danos e pertences do checklist de entrada 3D."""

import hashlib

from django.utils import timezone
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.service_orders.models import (
    ChecklistDamage,
    CustomerBelonging,
    EntryChecklist,
    ServiceOrder,
    ServiceOrderPhoto,
    ServiceOrderStatus,
)

DAMAGE = {
    "panel_key": "porta_diant_e",
    "damage_type": "amassado",
    "severity": "leve",
}


class ChecklistDamagesAPITest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        email = "checklist-api@dscar.com"
        email_hash = hashlib.sha256(email.encode()).hexdigest()
        self.user = GlobalUser.objects.filter(email_hash=email_hash).first()
        if self.user is None:
            self.user = GlobalUser.objects.create_user(
                email=email, email_hash=email_hash, password="x"
            )
        self.order = ServiceOrder.objects.create(
            number=9961,
            plate="CHK0B22",
            customer_name="Cliente Checklist API",
            status=ServiceOrderStatus.RECEPTION,
            created_by=self.user,
        )
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})
        self.base = f"/api/v1/service-orders/{self.order.id}"

    def _post_damage(self, **extra: object):  # noqa: ANN202
        return self.client.post(
            f"{self.base}/checklist-damages/", {**DAMAGE, **extra}, format="json"
        )

    def _lock(self) -> None:
        EntryChecklist.objects.update_or_create(
            service_order=self.order,
            checklist_type="entrada",
            defaults={"finalized_at": timezone.now()},
        )

    def test_create_damage_assigns_sequential_numbers(self) -> None:
        first = self._post_damage()
        second = self._post_damage(panel_key="capo")
        assert first.status_code == 201, first.content
        assert second.status_code == 201, second.content
        assert first.json()["number"] == 1
        assert second.json()["number"] == 2
        listed = self.client.get(f"{self.base}/checklist-damages/").json()
        assert [d["number"] for d in listed] == [1, 2]

    def test_same_client_uuid_returns_existing(self) -> None:
        uuid = "0198c0de-bbbb-7000-8000-000000000001"
        first = self._post_damage(client_uuid=uuid)
        second = self._post_damage(client_uuid=uuid)
        assert first.status_code == 201
        assert second.status_code == 200
        assert second.json()["id"] == first.json()["id"]
        assert ChecklistDamage.objects.count() == 1

    def test_same_client_uuid_returns_existing_belonging(self) -> None:
        body = {"description": "Cadeirinha", "client_uuid": "0198c0de-dddd-7000-8000-000000000001"}
        first = self.client.post(f"{self.base}/belongings/", body, format="json")
        second = self.client.post(f"{self.base}/belongings/", body, format="json")
        assert (first.status_code, second.status_code) == (201, 200)
        assert second.json()["id"] == first.json()["id"]
        assert CustomerBelonging.objects.count() == 1

    def test_damage_links_photos_by_client_uuid(self) -> None:
        photo = ServiceOrderPhoto.objects.create(
            service_order=self.order,
            folder="checklist_entrada",
            checklist_type="entrada",
            s3_key="service_orders/x/checklist_entrada/a.jpg",
            uploaded_by_id=self.user.id,
            client_uuid="0198c0de-cccc-7000-8000-000000000001",
        )
        resp = self._post_damage(photo_client_uuids=[photo.client_uuid])
        assert resp.status_code == 201, resp.content
        assert resp.json()["photo_ids"] == [str(photo.id)]
        assert resp.json()["photos"][0]["id"] == str(photo.id)

    def test_damage_requires_known_photos(self) -> None:
        resp = self._post_damage(photo_client_uuids=["nao-existe"])
        assert resp.status_code == 400
        assert resp.json()["photos"] == "pending"
        assert ChecklistDamage.objects.count() == 0

    def test_edit_after_finalize_is_409(self) -> None:
        created = self._post_damage().json()
        self._lock()
        post = self._post_damage(panel_key="capo")
        patch = self.client.patch(
            f"{self.base}/checklist-damages/{created['id']}/", {"severity": "grave"}, format="json"
        )
        for resp in (post, patch):
            assert resp.status_code == 409
            assert resp.json()["code"] == "checklist_locked"
        assert ChecklistDamage.objects.count() == 1
        assert ChecklistDamage.objects.get().severity == "leve"

    def test_deactivate_hides_damage_and_keeps_numbering(self) -> None:
        created = self._post_damage().json()
        resp = self.client.post(f"{self.base}/checklist-damages/{created['id']}/deactivate/")
        assert resp.status_code == 200
        assert self.client.get(f"{self.base}/checklist-damages/").json() == []
        assert self._post_damage().json()["number"] == 2

    def test_return_belonging_allowed_when_locked(self) -> None:
        created = self.client.post(
            f"{self.base}/belongings/", {"description": "Óculos de sol"}, format="json"
        )
        assert created.status_code == 201, created.content
        self._lock()
        resp = self.client.post(f"{self.base}/belongings/{created.json()['id']}/return/")
        assert resp.status_code == 200
        assert resp.json()["returned_at"]
        belonging = CustomerBelonging.objects.get()
        assert belonging.returned_by_id == self.user.id

    def test_no_delete_route(self) -> None:
        created = self._post_damage().json()
        resp = self.client.delete(f"{self.base}/checklist-damages/{created['id']}/")
        assert resp.status_code == 405
        assert ChecklistDamage.objects.filter(is_active=True).count() == 1
