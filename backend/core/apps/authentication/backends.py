"""
Backends de autenticação JWT para produção (Keycloak RS256).
Extraído de config/settings/dev.py para reutilização em prod.
"""

import hashlib
import logging

import jwt as pyjwt
from jwt import PyJWKClient
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

logger = logging.getLogger(__name__)

_keycloak_jwks_client: PyJWKClient | None = None


def _get_keycloak_jwks_client() -> PyJWKClient:
    """Lazy init do PyJWKClient global com cache de chaves."""
    from django.conf import settings

    global _keycloak_jwks_client
    if _keycloak_jwks_client is None:
        _keycloak_jwks_client = PyJWKClient(settings.OIDC_OP_JWKS_ENDPOINT, cache_keys=True)
    return _keycloak_jwks_client


class KeycloakJWTAuthentication(BaseAuthentication):
    """
    Autentica JWTs RS256 emitidos pelo Keycloak.
    Busca as chaves públicas do endpoint JWKS via OIDC_OP_JWKS_ENDPOINT.
    Retorna None para tokens não-RS256 → sem colisão com DevJWTAuthentication.
    """

    def authenticate(self, request) -> tuple | None:  # type: ignore[override]
        from apps.authentication.models import GlobalUser

        auth_header: str = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Bearer "):
            return None

        raw_token = auth_header.split(" ", 1)[1]

        try:
            unverified_header = pyjwt.get_unverified_header(raw_token)
        except pyjwt.exceptions.DecodeError:
            return None

        if unverified_header.get("alg") != "RS256":
            return None  # Token HS256 (dev) — deixa DevJWTAuthentication tratar

        try:
            jwks_client = _get_keycloak_jwks_client()
            signing_key = jwks_client.get_signing_key_from_jwt(raw_token)
            payload = pyjwt.decode(
                raw_token,
                signing_key.key,
                algorithms=["RS256"],
                options={"verify_aud": False},
            )
        except pyjwt.exceptions.ExpiredSignatureError:
            raise AuthenticationFailed("Token Keycloak expirado.")
        except Exception as exc:
            logger.warning("KeycloakJWTAuthentication: falha ao validar token RS256 — %s", exc)
            return None

        email: str = payload.get("email") or payload.get("preferred_username", "")
        if not email:
            raise AuthenticationFailed(
                "Claim 'email' ou 'preferred_username' ausente no token Keycloak."
            )

        email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
        user, created = GlobalUser.objects.get_or_create(
            email_hash=email_hash,
            defaults={
                "email": email,
                "name": payload.get("name", email.split("@")[0]),
                "is_active": True,
            },
        )
        if created:
            logger.info("Keycloak: usuário criado automaticamente para %s", email)

        return (user, payload)

    def authenticate_header(self, request) -> str:  # type: ignore[override]
        return "Bearer"
