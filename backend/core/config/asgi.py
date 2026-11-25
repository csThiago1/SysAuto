"""
Paddock Solutions — ASGI Application
Suporta HTTP, WebSocket (Django Channels) e HTTP/2
"""

import os

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

django_asgi_app = get_asgi_application()

# Imports após setup do Django
from apps.realtime.routing import websocket_urlpatterns  # noqa: E402

# Sem AuthMiddlewareStack: a autenticação é o ticket assinado na query string.
application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(URLRouter(websocket_urlpatterns)),
    }
)
