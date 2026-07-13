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

    def test_delete_manager_em_os_entregue_retorna_422(self) -> None:
        photo = self.make_photo()
        self.order.status = ServiceOrderStatus.DELIVERED
        self.order.save(update_fields=["status"])
        self.auth("MANAGER")
        resp = self.client.delete(self._url(str(photo.id)))
        assert resp.status_code == 422
        photo.refresh_from_db()
        assert photo.is_active is True


class PhotoBulkDeleteTest(PhotoAPITestBase):
    def _url(self) -> str:
        return f"/api/v1/service-orders/{self.order.id}/photos/bulk-delete/"

    def test_manager_bulk_delete_soft_e_log_unico(self) -> None:
        p1 = self.make_photo(folder="vistoria_inicial")
        p2 = self.make_photo(folder="documentos")
        self.auth("MANAGER")
        resp = self.client.post(
            self._url(), {"photo_ids": [str(p1.id), str(p2.id)]}, format="json"
        )
        assert resp.status_code == 200
        assert resp.json() == {"deleted": 2}
        p1.refresh_from_db()
        p2.refresh_from_db()
        assert p1.is_active is False and p2.is_active is False
        assert p1.s3_key and p2.s3_key  # preservados
        logs = ServiceOrderActivityLog.objects.filter(
            service_order=self.order, activity_type=ActivityType.FILE_DELETED
        )
        assert logs.count() == 1
        assert "2 foto" in logs.first().description

    def test_consultant_retorna_403(self) -> None:
        photo = self.make_photo()
        self.auth("CONSULTANT")
        resp = self.client.post(self._url(), {"photo_ids": [str(photo.id)]}, format="json")
        assert resp.status_code == 403

    def test_foto_de_outra_os_retorna_400(self) -> None:
        other_order = ServiceOrder.objects.create(
            number=9951,
            plate="FOT0B22",
            customer_name="Outro Cliente",
            status=ServiceOrderStatus.RECEPTION,
            created_by=self.user,
        )
        alheia = ServiceOrderPhoto.objects.create(
            service_order=other_order,
            folder="vistoria_inicial",
            s3_key="x/y.jpg",
            uploaded_by_id=self.user.id,
        )
        minha = self.make_photo()
        self.auth("MANAGER")
        resp = self.client.post(
            self._url(), {"photo_ids": [str(minha.id), str(alheia.id)]}, format="json"
        )
        assert resp.status_code == 400
        minha.refresh_from_db()
        assert minha.is_active is True  # nada foi excluído

    def test_lista_vazia_retorna_400(self) -> None:
        self.auth("MANAGER")
        resp = self.client.post(self._url(), {"photo_ids": []}, format="json")
        assert resp.status_code == 400

    def test_manager_bulk_delete_em_os_cancelada_retorna_422(self) -> None:
        p1 = self.make_photo(folder="vistoria_inicial")
        p2 = self.make_photo(folder="documentos")
        self.order.status = ServiceOrderStatus.CANCELLED
        self.order.save(update_fields=["status"])
        self.auth("MANAGER")
        resp = self.client.post(
            self._url(), {"photo_ids": [str(p1.id), str(p2.id)]}, format="json"
        )
        assert resp.status_code == 422
        p1.refresh_from_db()
        p2.refresh_from_db()
        assert p1.is_active is True and p2.is_active is True


class PhotoDownloadZipTest(PhotoAPITestBase):
    def _url(self) -> str:
        return f"/api/v1/service-orders/{self.order.id}/photos/download/"

    def _zip_from(self, resp) -> zipfile.ZipFile:
        content = b"".join(resp.streaming_content)
        return zipfile.ZipFile(io.BytesIO(content))

    def test_download_zip_agrupado_por_pasta(self) -> None:
        p1 = self.make_photo(folder="vistoria_inicial", content=b"foto-um")
        p2 = self.make_photo(folder="documentos", content=b"foto-dois")
        self.auth("CONSULTANT")  # download é leitura — qualquer role com os.view
        resp = self.client.post(
            self._url(), {"photo_ids": [str(p1.id), str(p2.id)]}, format="json"
        )
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/zip"
        assert "OS-9950-fotos.zip" in resp["Content-Disposition"]
        zf = self._zip_from(resp)
        names = sorted(zf.namelist())
        assert len(names) == 2
        assert any(n.startswith("Vistoria Inicial/") for n in names)
        assert any(n.startswith("Documentos/") for n in names)
        contents = {zf.read(n) for n in names}
        assert contents == {b"foto-um", b"foto-dois"}

    def test_foto_inativa_retorna_400(self) -> None:
        photo = self.make_photo()
        photo.is_active = False
        photo.save(update_fields=["is_active"])
        self.auth("CONSULTANT")
        resp = self.client.post(self._url(), {"photo_ids": [str(photo.id)]}, format="json")
        assert resp.status_code == 400

    def test_foto_de_outra_os_retorna_400(self) -> None:
        other_order = ServiceOrder.objects.create(
            number=9952,
            plate="FOT0C33",
            customer_name="Terceiro",
            status=ServiceOrderStatus.RECEPTION,
            created_by=self.user,
        )
        alheia = ServiceOrderPhoto.objects.create(
            service_order=other_order,
            folder="vistoria_inicial",
            s3_key="x/z.jpg",
            uploaded_by_id=self.user.id,
        )
        self.auth("CONSULTANT")
        resp = self.client.post(self._url(), {"photo_ids": [str(alheia.id)]}, format="json")
        assert resp.status_code == 400

    def test_foto_orfa_no_storage_e_pulada_sem_500(self) -> None:
        orfa = ServiceOrderPhoto.objects.create(
            service_order=self.order,
            folder="vistoria_inicial",
            s3_key="caminho/inexistente.jpg",
            uploaded_by_id=self.user.id,
        )
        normal = self.make_photo(folder="documentos", content=b"foto-normal")
        self.auth("CONSULTANT")
        resp = self.client.post(
            self._url(), {"photo_ids": [str(orfa.id), str(normal.id)]}, format="json"
        )
        assert resp.status_code == 200
        zf = self._zip_from(resp)
        names = zf.namelist()
        assert len(names) == 1
        assert zf.read(names[0]) == b"foto-normal"
