"""IP do aparelho do cliente para a evidência da assinatura.

O navegador fala com o Django pelo proxy do Next (/api/proxy), então REMOTE_ADDR é o
servidor do Next (ou o Caddy). O proxy repassa o IP real em X-Client-IP junto com
X-Proxy-Secret; só com o segredo certo o header vale, senão qualquer um forjaria o IP.
"""

from __future__ import annotations

import hmac
import ipaddress

from django.conf import settings
from rest_framework.request import Request


def client_ip(request: Request) -> str | None:
    remote = request.META.get("REMOTE_ADDR")
    secret: str = getattr(settings, "PROXY_SHARED_SECRET", "")
    sent = request.META.get("HTTP_X_PROXY_SECRET", "")
    if not secret or not hmac.compare_digest(sent.encode(), secret.encode()):
        return remote
    forwarded = request.META.get("HTTP_X_CLIENT_IP", "").strip()
    try:
        return str(ipaddress.ip_address(forwarded))
    except ValueError:
        return remote
