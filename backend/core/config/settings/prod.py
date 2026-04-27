from .base import *  # noqa: F401, F403

DEBUG = False

# Produção: apenas Keycloak RS256 — sem DevJWTAuthentication
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # type: ignore[name-defined]
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.authentication.backends.KeycloakJWTAuthentication",
    ],
}

# Produção: S3
DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
STATICFILES_STORAGE = "storages.backends.s3boto3.S3StaticStorage"

# Produção: email via SES
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

# Segurança
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
