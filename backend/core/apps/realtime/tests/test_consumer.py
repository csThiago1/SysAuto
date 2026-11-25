import pytest
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator

from apps.realtime.consumers import RealtimeConsumer, group_name
from apps.realtime.tickets import make_ticket

EV = {"entity": "service_order", "id": "00000000-0000-0000-0000-000000000001", "action": "changed"}


@pytest.fixture(autouse=True)
def _layer(settings):
    settings.CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


def _comm(query: str) -> WebsocketCommunicator:
    return WebsocketCommunicator(RealtimeConsumer.as_asgi(), f"/ws/realtime/{query}")


@pytest.mark.asyncio
async def test_ticket_valido_conecta_e_recebe():
    c = _comm(f"?ticket={make_ticket('u1', 'tenant_a')}")
    connected, _ = await c.connect()
    assert connected is True
    await get_channel_layer().group_send(
        group_name("tenant_a"), {"type": "realtime.event", "event": EV}
    )
    assert await c.receive_json_from() == EV
    await c.disconnect()


@pytest.mark.asyncio
@pytest.mark.parametrize("query", ["", "?ticket=forjado"])
async def test_ticket_ausente_ou_forjado_fecha_4401(query: str):
    connected, code = await _comm(query).connect()
    assert connected is False
    assert code == 4401


@pytest.mark.asyncio
async def test_nao_recebe_de_outro_tenant():
    c = _comm(f"?ticket={make_ticket('u1', 'tenant_a')}")
    await c.connect()
    await get_channel_layer().group_send(
        group_name("tenant_b"), {"type": "realtime.event", "event": EV}
    )
    assert await c.receive_nothing() is True
    await c.disconnect()
