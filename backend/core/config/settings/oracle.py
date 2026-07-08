"""Settings de produção na Oracle Free Tier — herda tudo do railway.py.

Só amplia ALLOWED_HOSTS: o host de borda é o sslip.io (até o DNS real)
e o IP público da VM.
"""
from .railway import *  # noqa: F401,F403
from .railway import ALLOWED_HOSTS as _RAILWAY_HOSTS

ALLOWED_HOSTS = [
    *_RAILWAY_HOSTS,
    ".sslip.io",
    "147.15.19.48",
]
