"""
Paddock Solutions — Django Settings Railway (staging gratuito)
Herda de base.py. Sem R2, sem debug_toolbar. WhiteNoise para estáticos.
"""

from django_tenants.middleware.main import TenantMainMiddleware

from .base import *  # noqa: F401, F403

DEBUG = False
ALLOWED_HOSTS = ["*"]

# ─── Auth — NativeJWT ──────────────────────────────────────────────────────
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # type: ignore[name-defined]
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.authentication.backends.NativeJWTAuthentication",
    ],
}

# ─── Storage — local (sem R2 em staging gratuito) ──────────────────────────
DEFAULT_FILE_STORAGE = "django.core.files.storage.FileSystemStorage"

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
