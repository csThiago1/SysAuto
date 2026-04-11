"""
Paddock Solutions — Service Orders WebSocket Consumer (stub)
"""
from channels.generic.websocket import AsyncJsonWebsocketConsumer


class ServiceOrderConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self) -> None:
        if not self.scope["user"].is_authenticated:
            await self.close()
            return
        await self.accept()

    async def disconnect(self, close_code: int) -> None:
        pass

    async def receive_json(self, content: dict, **kwargs: object) -> None:
        pass
