"""
Paddock Solutions — Django Settings Railway (staging gratuito)
Herda de base.py. Sem R2, sem debug_toolbar. WhiteNoise para estáticos.
"""

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

# ─── CORS — permitir frontend Vercel ────────────────────────────────────────
CORS_ALLOW_ALL_ORIGINS = True

# ─── Email — console (sem Resend em staging gratuito) ──────────────────────
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# ─── Sentry — desativado ───────────────────────────────────────────────────
SENTRY_DSN = None
