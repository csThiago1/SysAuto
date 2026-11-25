"""Consumer do websocket de tempo real: um grupo por tenant, só avisa; não toca o banco."""

import logging
from typing import Any
from urllib.parse import parse_qs

from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.realtime.tickets import read_ticket

logger = logging.getLogger(__name__)


def group_name(schema: str) -> str:
    return f"tenant_{schema}"


class RealtimeConsumer(AsyncJsonWebsocketConsumer):
    group: str | None = None

    async def connect(self) -> None:
        query = parse_qs(self.scope["query_string"].decode())
        lido = read_ticket((query.get("ticket") or [""])[0])
        if lido is None:
            logger.info("realtime: ticket inválido ou vencido")
            await self.close(code=4401)
            return
        self.group = group_name(lido[1])
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code: int) -> None:
        if self.group:
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def realtime_event(self, message: dict[str, Any]) -> None:
        await self.send_json(message["event"])
