from .base import *  # noqa: F401, F403
import hashlib
import logging
import warnings

import jwt as pyjwt
from jwt import PyJWKClient
from django_tenants.middleware.main import TenantMainMiddleware
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

# Suprime warning de tamanho de chave HMAC (chave intencional para dev)
warnings.filterwarnings("ignore", message=".*HMAC key.*", module="jwt")

logger = logging.getLogger(__name__)

DEBUG = True
ALLOWED_HOSTS = ["*"]

DEFAULT_FILE_STORAGE = "django.core.files.storage.FileSystemStorage"
STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
SENTRY_DSN = None
CORS_ALLOW_ALL_ORIGINS = True

INSTALLED_APPS += ["debug_toolbar"]  # type: ignore[name-defined]
INTERNAL_IPS = ["127.0.0.1"]


# ─── Dev Tenant Middleware ────────────────────────────────────────────────────
# Node.js fetch não encaminha headers Host customizados.
# O proxy Next.js envia X-Tenant-Domain para identificar o tenant.

class DevTenantMiddleware(TenantMainMiddleware):
    """
    Em dev, lê X-Tenant-Domain header como fonte do hostname do tenant.
    Permite que o proxy Next.js selecione o tenant sem depender do Host header.
    """

    def hostname_from_request(self, request) -> str:  # type: ignore[override]
        x_tenant = request.META.get("HTTP_X_TENANT_DOMAIN", "")
        if x_tenant:
            return x_tenant
        return super().hostname_from_request(request)


# Substitui TenantMainMiddleware pelo DevTenantMiddleware
MIDDLEWARE = [  # type: ignore[name-defined]
    "config.settings.dev.DevTenantMiddleware",
    *[m for m in MIDDLEWARE if m != "django_tenants.middleware.main.TenantMainMiddleware"],  # type: ignore[name-defined]
    "debug_toolbar.middleware.DebugToolbarMiddleware",
]


# ─── Dev JWT Authentication ───────────────────────────────────────────────────
_DEV_JWT_SECRET = "dscar-dev-secret-paddock-2025"


class DevJWTAuthentication(BaseAuthentication):
    """
    Autentica JWTs HS256 gerados pelo provider dev-credentials do Next.js.
    Cria o GlobalUser automaticamente se não existir.
    Retorna None para tokens não-HS256 → fallback para JWTAuthentication (Keycloak RS256).
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

        if unverified_header.get("alg") != "HS256":
            return None  # Token RS256 (Keycloak) — deixa JWTAuthentication tentar

        try:
            payload = pyjwt.decode(
                raw_token,
                _DEV_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        except pyjwt.exceptions.ExpiredSignatureError:
            raise AuthenticationFailed("Token dev expirado.")
        except pyjwt.exceptions.InvalidTokenError as exc:
            raise AuthenticationFailed(f"Token dev inválido: {exc}")

        email: str = payload.get("email", "")
        if not email:
            raise AuthenticationFailed("Claim 'email' ausente no token dev.")

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
            logger.info("Dev: usuário criado automaticamente para %s", email)

        return (user, payload)

    def authenticate_header(self, request) -> str:  # type: ignore[override]
        return "Bearer"


# ─── Keycloak JWKS Client (global, com cache) ────────────────────────────────
_KEYCLOAK_JWKS_URL = "http://keycloak:8080/realms/paddock/protocol/openid-connect/certs"
_keycloak_jwks_client: PyJWKClient | None = None


def _get_keycloak_jwks_client() -> PyJWKClient:
    """Lazy init do PyJWKClient global com cache de chaves."""
    global _keycloak_jwks_client
    if _keycloak_jwks_client is None:
        _keycloak_jwks_client = PyJWKClient(_KEYCLOAK_JWKS_URL, cache_keys=True)
    return _keycloak_jwks_client


# ─── Keycloak JWT Authentication ─────────────────────────────────────────────

class KeycloakJWTAuthentication(BaseAuthentication):
    """
    Autentica JWTs RS256 emitidos pelo Keycloak.
    Busca as chaves públicas do endpoint JWKS do Keycloak usando PyJWKClient.
    Retorna None para tokens não-RS256 (ex: HS256 dev) → sem colisão com DevJWTAuthentication.
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
            raise AuthenticationFailed("Claim 'email' ou 'preferred_username' ausente no token Keycloak.")

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


REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # type: ignore[name-defined]
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "config.settings.dev.DevJWTAuthentication",
        "config.settings.dev.KeycloakJWTAuthentication",
    ],
}
