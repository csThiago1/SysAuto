"""Throttle do login: por e-mail, com escopo próprio (não divide cota com o "anon")."""

from rest_framework.parsers import JSONParser
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from apps.authentication.views import AuthRateThrottle, RefreshView


def _req(body: dict, ip: str = "76.76.21.21") -> Request:
    raw = APIRequestFactory().post("/api/v1/auth/login/", body, format="json", REMOTE_ADDR=ip)
    return Request(raw, parsers=[JSONParser()])


def test_chave_por_email_e_nao_por_ip() -> None:
    t = AuthRateThrottle()
    a = t.get_cache_key(_req({"email": "Ana@DSCar.com"}), None)
    a2 = t.get_cache_key(_req({"email": "ana@dscar.com"}, ip="1.2.3.4"), None)
    b = t.get_cache_key(_req({"email": "bruno@dscar.com"}), None)
    assert a == a2  # mesmo e-mail, qualquer IP
    assert a != b  # mesmo IP (Vercel), pessoas diferentes não se travam
    assert a.startswith("throttle_auth_")  # não é a chave do throttle "anon"


def test_sem_email_cai_no_ip() -> None:
    assert AuthRateThrottle().get_cache_key(_req({}), None).startswith("throttle_auth_")


def test_refresh_sem_throttle() -> None:
    assert RefreshView.throttle_classes == []
