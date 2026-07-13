"""Testes de fotos da OS — permissões, bulk-delete e download ZIP."""
import hashlib
import io
import zipfile

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.test import override_settings
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.service_orders.models import (
    ActivityType,
    ServiceOrder,
    ServiceOrderActivityLog,
    ServiceOrderPhoto,
    ServiceOrderStatus,
)

IN_MEMORY_STORAGE = {
    "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}


@override_settings(STORAGES=IN_MEMORY_STORAGE)
class PhotoAPITestBase(TenantTestCase):
    """Base: OS + user + client autenticável por role."""

    def setUp(self) -> None:
        super().setUp()
        email = "fotos@dscar.com"
        email_hash = hashlib.sha256(email.encode()).hexdigest()
        self.user = GlobalUser.objects.filter(email_hash=email_hash).first()
        if self.user is None:
            self.user = GlobalUser.objects.create_user(
                email=email, email_hash=email_hash, password="x"
            )
        self.order = ServiceOrder.objects.create(
            number=9950,
            plate="FOT0A11",
            customer_name="Cliente Fotos",
            status=ServiceOrderStatus.RECEPTION,
            created_by=self.user,
        )
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain

    def auth(self, role: str = "ADMIN") -> None:
        self.client.force_authenticate(user=self.user, token={"role": role})

    def make_photo(
        self, folder: str = "vistoria_inicial", content: bytes = b"jpegdata", **kwargs
    ) -> ServiceOrderPhoto:
        key = default_storage.save(
            f"service_orders/{self.order.id}/{folder}/t.jpg", ContentFile(content)
        )
        return ServiceOrderPhoto.objects.create(
            service_order=self.order,
            folder=folder,
            s3_key=key,
            uploaded_by_id=self.user.id,
            **kwargs,
        )


class PhotoDeletePermissionTest(PhotoAPITestBase):
    def _url(self, photo_id: str) -> str:
        return f"/api/v1/service-orders/{self.order.id}/photos/{photo_id}/"

    def test_delete_consultant_retorna_403(self) -> None:
        photo = self.make_photo()
        self.auth("CONSULTANT")
        resp = self.client.delete(self._url(str(photo.id)))
        assert resp.status_code == 403
        photo.refresh_from_db()
        assert photo.is_active is True

    def test_delete_manager_soft_delete_204(self) -> None:
        photo = self.make_photo()
        self.auth("MANAGER")
        resp = self.client.delete(self._url(str(photo.id)))
        assert resp.status_code == 204
        photo.refresh_from_db()
        assert photo.is_active is False
        assert photo.s3_key  # preservado
