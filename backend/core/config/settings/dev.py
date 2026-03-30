from .base import *  # noqa: F401, F403

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

# Dev: JWT com HS256 para facilitar testes sem Keycloak
# O token é gerado pelo provider dev-credentials do Next.js
# USER_ID_FIELD/CLAIM = "email" para evitar dependência de UUID do Keycloak
SIMPLE_JWT = {
    **SIMPLE_JWT,  # type: ignore[name-defined]
    "ALGORITHM": "HS256",
    "SIGNING_KEY": "dscar-dev-secret-paddock-2025",
    "VERIFYING_KEY": None,
    "USER_ID_FIELD": "email",
    "USER_ID_CLAIM": "email",
}
