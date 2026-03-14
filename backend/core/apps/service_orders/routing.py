"""
Paddock Solutions — Service Orders Routing (WebSocket)
"""
from django.urls import path

from apps.service_orders.consumers import ServiceOrderConsumer

websocket_urlpatterns = [
    path("ws/service-orders/<uuid:order_id>/", ServiceOrderConsumer.as_asgi()),
]
