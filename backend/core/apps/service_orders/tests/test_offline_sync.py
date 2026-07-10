"""Testes da camada offline sync — idempotência client_uuid e If-Match (PWA onda 5)."""
import hashlib
from types import SimpleNamespace

from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.persons.models import Person, PersonRole
from apps.service_orders.models import ServiceOrder, ServiceOrderStatus
from apps.service_orders.offline import Conflict, check_if_match, find_by_client_uuid

CLIENT_UUID = "0198c0de-aaaa-7000-8000-000000000001"


class OfflineSyncTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        email = "offline@dscar.com"
        self.user = GlobalUser.objects.create_user(
            email=email,
            email_hash=hashlib.sha256(email.encode()).hexdigest(),
            password="x",
        )
        person = Person.objects.create(person_kind="PF", full_name="Cliente Offline")
        PersonRole.objects.create(person=person, role="CLIENT")
        self.order = ServiceOrder.objects.create(
            number=9901,
            plate="OFF1L23",
            customer=person,
            customer_name=person.full_name,
            customer_type="private",
            status=ServiceOrderStatus.RECEPTION,
            created_by=self.user,
            client_uuid=CLIENT_UUID,
        )

    @staticmethod
    def _request(data: dict | None = None, headers: dict | None = None) -> SimpleNamespace:
        return SimpleNamespace(data=data or {}, headers=headers or {})

    def test_find_by_client_uuid_retorna_existente(self) -> None:
        req = self._request({"client_uuid": CLIENT_UUID})
        assert find_by_client_uuid(ServiceOrder, req) == self.order

    def test_find_by_client_uuid_sem_campo_retorna_none(self) -> None:
        assert find_by_client_uuid(ServiceOrder, self._request()) is None
        assert find_by_client_uuid(ServiceOrder, self._request({"client_uuid": ""})) is None

    def test_if_match_igual_passa(self) -> None:
        self.order.refresh_from_db()
        req = self._request(headers={"If-Match": self.order.updated_at.isoformat()})
        check_if_match(self.order, req)  # não deve levantar

    def test_if_match_divergente_levanta_conflict(self) -> None:
        req = self._request(headers={"If-Match": "2020-01-01T00:00:00+00:00"})
        with self.assertRaises(Conflict):
            check_if_match(self.order, req)

    def test_sem_if_match_passa(self) -> None:
        check_if_match(self.order, self._request())  # header ausente = sem verificação
