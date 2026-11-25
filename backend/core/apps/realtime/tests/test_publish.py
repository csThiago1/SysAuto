"""publish_change: só depois do commit, desligado por padrão, nunca quebra a gravação."""

import hashlib
from unittest.mock import MagicMock, patch
from uuid import uuid4

from django.db import transaction
from django.test import override_settings
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.realtime.consumers import group_name
from apps.realtime.publish import publish_change
from apps.vehicle_catalog.tests.factories import make_catalog

LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


def _evento(obj_id: object) -> dict[str, object]:
    return {
        "type": "realtime.event",
        "event": {"entity": "service_order", "id": str(obj_id), "action": "changed"},
    }


@override_settings(CHANNEL_LAYERS=LAYERS)
class PublishTest(TenantTestCase):
    def _mocks(self, group_send: MagicMock | None = None) -> tuple[MagicMock, MagicMock]:
        send = group_send or MagicMock()
        a2s = MagicMock(return_value=send)
        return a2s, send

    @override_settings(REALTIME_ENABLED=False)
    def test_desligado_nao_publica(self) -> None:
        with (
            patch("apps.realtime.publish.async_to_sync") as a2s,
            patch("apps.realtime.publish.get_channel_layer") as layer,
        ):
            with self.captureOnCommitCallbacks(execute=True) as cbs:
                publish_change("service_order", uuid4())
        assert cbs == []
        a2s.assert_not_called()
        layer.assert_not_called()

    @override_settings(REALTIME_ENABLED=True)
    def test_ligado_publica_no_grupo_do_tenant(self) -> None:
        obj_id = uuid4()
        a2s, send = self._mocks()
        with patch("apps.realtime.publish.async_to_sync", a2s):
            with self.captureOnCommitCallbacks(execute=True):
                publish_change("service_order", obj_id)
        send.assert_called_once_with(group_name(self.tenant.schema_name), _evento(obj_id))

    @override_settings(REALTIME_ENABLED=True)
    def test_redis_fora_nao_quebra(self) -> None:
        a2s, _ = self._mocks(MagicMock(side_effect=ConnectionError("redis fora")))
        with patch("apps.realtime.publish.async_to_sync", a2s):
            with self.assertLogs("apps.realtime.publish", "WARNING"):
                with self.captureOnCommitCallbacks(execute=True):
                    publish_change("service_order", uuid4())

    @override_settings(REALTIME_ENABLED=True)
    def test_rollback_nao_publica(self) -> None:
        a2s, send = self._mocks()
        with patch("apps.realtime.publish.async_to_sync", a2s):
            with self.captureOnCommitCallbacks(execute=False) as cbs:
                try:
                    with transaction.atomic():
                        publish_change("service_order", uuid4())
                        raise RuntimeError("desfaz")
                except RuntimeError:
                    pass
            for cb in cbs:
                cb()
        send.assert_not_called()


@override_settings(CHANNEL_LAYERS=LAYERS, REALTIME_ENABLED=True)
class SalvarOsTest(TenantTestCase):
    def test_salvar_os_dispara_evento(self) -> None:
        email = "rt@dscar.com"
        user = GlobalUser.objects.create_user(
            email=email, email_hash=hashlib.sha256(email.encode()).hexdigest(), password="x"
        )
        client = APIClient()
        client.defaults["SERVER_NAME"] = self.domain.domain
        client.defaults["HTTP_HOST"] = self.domain.domain
        client.force_authenticate(user=user, token={"role": "ADMIN"})
        send = MagicMock()
        with patch("apps.realtime.publish.async_to_sync", MagicMock(return_value=send)):
            with self.captureOnCommitCallbacks(execute=True):
                r = client.post(
                    "/api/v1/service-orders/",
                    {
                        "plate": "RTM1D23",
                        "customer_name": "Cliente RT",
                        "catalog_family": make_catalog().modelo.familia_id,
                    },
                    format="json",
                )
        assert r.status_code == 201, r.data
        ids = [c.args[1]["event"]["id"] for c in send.call_args_list]
        assert str(r.data["id"]) in ids
