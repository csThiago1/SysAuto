"""
Paddock Solutions — Service Orders WebSocket Consumer (stub)
"""
from channels.generic.websocket import AsyncJsonWebsocketConsumer


class ServiceOrderConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self) -> None:
        await self.accept()

    async def disconnect(self, close_code: int) -> None:
        pass

    async def receive_json(self, content: dict, **kwargs: object) -> None:
        pass
