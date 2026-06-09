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

# ─── CORS — permitir frontend Vercel ────────────────────────────────────────
CORS_ALLOW_ALL_ORIGINS = True

# ─── Email — console (sem Resend em staging gratuito) ──────────────────────
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# ─── Sentry — desativado ───────────────────────────────────────────────────
SENTRY_DSN = None
