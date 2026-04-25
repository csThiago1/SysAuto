"""
Paddock Solutions — Django Settings Homolog
Herda de base.py. Base para prod.py futuro.
"""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401, F403

DEBUG = False

# ─── Auth — apenas Keycloak RS256 em homolog ─────────────────────────────────
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # type: ignore[name-defined]
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.authentication.backends.KeycloakJWTAuthentication",
    ],
}

# ─── Storage — Cloudflare R2 ─────────────────────────────────────────────────
_R2_ACCOUNT_ID = config("R2_ACCOUNT_ID", default="")  # type: ignore[name-defined]
_R2_PUBLIC_URL = config("R2_PUBLIC_URL", default="")  # type: ignore[name-defined]

DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
AWS_S3_ENDPOINT_URL = f"https://{_R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
AWS_ACCESS_KEY_ID = config("R2_ACCESS_KEY_ID", default="")  # type: ignore[name-defined]
AWS_SECRET_ACCESS_KEY = config("R2_SECRET_ACCESS_KEY", default="")  # type: ignore[name-defined]
AWS_STORAGE_BUCKET_NAME = config("R2_BUCKET_NAME", default="")  # type: ignore[name-defined]
AWS_S3_CUSTOM_DOMAIN = _R2_PUBLIC_URL.removeprefix("https://").removeprefix("http://").rstrip("/")  # sem scheme
AWS_DEFAULT_ACL = None          # R2 não suporta ACLs
AWS_QUERYSTRING_AUTH = False    # URLs públicas
AWS_S3_FILE_OVERWRITE = False   # nunca sobrescrever uploads

# ─── Static files — WhiteNoise ────────────────────────────────────────────────
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
STATIC_ROOT = BASE_DIR / "staticfiles"  # type: ignore[name-defined]

# WhiteNoise logo após SecurityMiddleware
MIDDLEWARE = [
    "django_tenants.middleware.main.TenantMainMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# ─── Segurança ────────────────────────────────────────────────────────────────
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# ─── Fiscal — ambiente de homologação ────────────────────────────────────────
# SEFAZ_ENV herdado de base.py via env var (default="homologation") — não alterar aqui.

# ─── Guards — falha imediata se vars críticas estiverem ausentes ──────────────
_REQUIRED_VARS = {
    "FIELD_ENCRYPTION_KEY": config("FIELD_ENCRYPTION_KEY", default=""),  # type: ignore[name-defined]
    "R2_ACCOUNT_ID": _R2_ACCOUNT_ID,
    "R2_ACCESS_KEY_ID": AWS_ACCESS_KEY_ID,
    "R2_SECRET_ACCESS_KEY": AWS_SECRET_ACCESS_KEY,
    "R2_BUCKET_NAME": AWS_STORAGE_BUCKET_NAME,
    "R2_PUBLIC_URL": _R2_PUBLIC_URL,
}

for _var, _val in _REQUIRED_VARS.items():
    if not _val:
        raise ImproperlyConfigured(
            f"[homolog] Variável obrigatória não configurada: {_var}"
        )
