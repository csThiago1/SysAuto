from .base import *  # noqa: F401, F403
import hashlib
import logging

import warnings

import jwt as pyjwt
from jwt.exceptions import PyJWTError  # noqa: F401
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

# Suprime warning de tamanho de chave HMAC em dev (chave intencional para dev)
warnings.filterwarnings("ignore", message=".*HMAC key.*", module="jwt")
warnings.filterwarnings("ignore", category=pyjwt.warnings.InsecureKeyLengthWarning if hasattr(pyjwt, "warnings") else UserWarning)

logger = logging.getLogger(__name__)

DEBUG = True

# Dev: aceitar qualquer host local
ALLOWED_HOSTS = ["*"]

# Dev: usar armazenamento local de arquivos
DEFAULT_FILE_STORAGE = "django.core.files.storage.FileSystemStorage"
STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"

# Dev: email para console
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Dev: Sentry desativado
SENTRY_DSN = None

# Dev: CORS aberto para localhost
CORS_ALLOW_ALL_ORIGINS = True

INSTALLED_APPS += ["debug_toolbar"]  # type: ignore[name-defined]
MIDDLEWARE += ["debug_toolbar.middleware.DebugToolbarMiddleware"]  # type: ignore[name-defined]
INTERNAL_IPS = ["127.0.0.1"]

# ─── Dev JWT Authentication ───────────────────────────────────────────────────
# Valida tokens HS256 emitidos pelo provider dev-credentials do Next.js.
# Deixa RS256 (Keycloak) para o JWTAuthentication padrão.
_DEV_JWT_SECRET = "dscar-dev-secret-paddock-2025"


class DevJWTAuthentication(BaseAuthentication):
    """
    Autentica JWTs HS256 gerados pelo provider dev-credentials do Next.js.
    Cria o GlobalUser automaticamente se não existir (conveniência em dev).
    Retorna None para tokens não-HS256, permitindo fallback para JWTAuthentication.
    """

    def authenticate(self, request: object) -> tuple | None:  # type: ignore[override]
        from apps.authentication.models import GlobalUser

        auth_header: str = request.META.get("HTTP_AUTHORIZATION", "")  # type: ignore[union-attr]
        if not auth_header.startswith("Bearer "):
            return None

        raw_token = auth_header.split(" ", 1)[1]

        # Verifica se o header usa HS256 — ignora tokens RS256 (Keycloak)
        try:
            unverified_header = pyjwt.get_unverified_header(raw_token)
        except pyjwt.exceptions.DecodeError:
            return None

        if unverified_header.get("alg") != "HS256":
            return None  # Deixa JWTAuthentication (RS256 / Keycloak) tentar

        # Valida e decodifica
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

    def authenticate_header(self, request: object) -> str:  # type: ignore[override]
        return "Bearer"


# ─── REST Framework — Dev ─────────────────────────────────────────────────────
# DevJWTAuthentication vem PRIMEIRO: interpreta HS256 e cai fora para RS256.
# JWTAuthentication fica como fallback para tokens Keycloak (RS256).
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # type: ignore[name-defined]
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "config.settings.dev.DevJWTAuthentication",
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
}
