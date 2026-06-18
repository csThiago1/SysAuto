"""
Paddock Solutions — Django Settings Railway (production)
Herda de base.py. R2 para media, WhiteNoise para estáticos.
"""

from django.core.exceptions import ImproperlyConfigured
from django_tenants.middleware.main import TenantMainMiddleware

from .base import *  # noqa: F401, F403

DEBUG = False
ALLOWED_HOSTS = [
    ".up.railway.app",
    ".paddock.solutions",
    ".oficinadscar.com.br",
    ".vercel.app",
    "localhost",
]

# ─── Auth — NativeJWT ──────────────────────────────────────────────────────
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # type: ignore[name-defined]
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.authentication.backends.NativeJWTAuthentication",
    ],
}

# ─── Storage — Cloudflare R2 ───────────────────────────────────────────────
_R2_ACCOUNT_ID = config("R2_ACCOUNT_ID", default="")  # type: ignore[name-defined]
_R2_PUBLIC_URL = config("R2_PUBLIC_URL", default="")  # type: ignore[name-defined]

DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
AWS_S3_ENDPOINT_URL = f"https://{_R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
AWS_ACCESS_KEY_ID = config("R2_ACCESS_KEY_ID", default="")  # type: ignore[name-defined]
AWS_SECRET_ACCESS_KEY = config("R2_SECRET_ACCESS_KEY", default="")  # type: ignore[name-defined]
AWS_STORAGE_BUCKET_NAME = config("R2_BUCKET_NAME", default="")  # type: ignore[name-defined]
AWS_S3_CUSTOM_DOMAIN = _R2_PUBLIC_URL.removeprefix("https://").removeprefix("http://").rstrip("/")
AWS_DEFAULT_ACL = None          # R2 não suporta ACLs
AWS_QUERYSTRING_AUTH = False    # URLs públicas servidas via custom domain
AWS_S3_FILE_OVERWRITE = False   # nunca sobrescrever uploads
AWS_S3_REGION_NAME = "auto"     # R2 ignora region mas boto3 exige
AWS_S3_SIGNATURE_VERSION = "s3v4"

# ─── Static files — WhiteNoise ──────────────────────────────────────────────
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
STATIC_ROOT = BASE_DIR / "staticfiles"  # type: ignore[name-defined]


# ─── Tenant Middleware — resolve via X-Tenant-Domain header ────────────────
class RailwayTenantMiddleware(TenantMainMiddleware):
    """Resolve tenant pelo header X-Tenant-Domain (enviado pelo proxy Next.js)."""

    def hostname_from_request(self, request) -> str:  # type: ignore[override]
        x_tenant = request.META.get("HTTP_X_TENANT_DOMAIN", "")
        if x_tenant:
            return x_tenant
        return "dscar.localhost"


MIDDLEWARE = [
    "config.settings.railway.RailwayTenantMiddleware",
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

# ─── CORS — frontend Vercel (production + preview URLs) ───────────────────
# Remove o wildcard de antes; usa regex específicos para evitar CSRF.
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGIN_REGEXES = [
    *CORS_ALLOWED_ORIGIN_REGEXES,  # type: ignore[name-defined]  # herda paddock.solutions + localhost
    r"^https://sys-auto-dscar-web.*\.vercel\.app$",  # production + preview deploys
]

# ─── Security headers — Railway termina TLS no edge ───────────────────────
# Sem SECURE_PROXY_SSL_HEADER o Django acha que está em HTTP e nunca emite
# redirect/cookies Secure. Com Railway, o header é injetado pelo edge.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000  # 1 ano
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
X_FRAME_OPTIONS = "DENY"
CSRF_TRUSTED_ORIGINS = [
    "https://*.up.railway.app",
    "https://*.paddock.solutions",
    "https://*.vercel.app",
]

# ─── Email — console (sem Resend em staging gratuito) ──────────────────────
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# ─── Sentry — ativado via env var SENTRY_DSN ───────────────────────────────
# Sem o DSN configurado, init() é no-op — não impede o boot.
# send_default_pii=False mantém o app dentro de LGPD (sem IP/email/body em error reports).
SENTRY_DSN = config("SENTRY_DSN", default="")  # type: ignore[name-defined]
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.django import DjangoIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration(), CeleryIntegration()],
        traces_sample_rate=config("SENTRY_TRACES_SAMPLE_RATE", default=0.1, cast=float),  # type: ignore[name-defined]
        profiles_sample_rate=0.0,  # profiling tem custo extra — manter off
        send_default_pii=False,  # LGPD — não enviar email/IP/body do request
        environment=config("SENTRY_ENVIRONMENT", default="production"),  # type: ignore[name-defined]
    )

# ─── Guards — falha imediata se vars críticas estiverem ausentes ──────────────
_REQUIRED_R2_VARS = {
    "R2_ACCOUNT_ID": _R2_ACCOUNT_ID,
    "R2_ACCESS_KEY_ID": AWS_ACCESS_KEY_ID,
    "R2_SECRET_ACCESS_KEY": AWS_SECRET_ACCESS_KEY,
    "R2_BUCKET_NAME": AWS_STORAGE_BUCKET_NAME,
    "R2_PUBLIC_URL": _R2_PUBLIC_URL,
}
for _var, _val in _REQUIRED_R2_VARS.items():
    if not _val:
        raise ImproperlyConfigured(
            f"[railway] Variável obrigatória não configurada: {_var}"
        )
