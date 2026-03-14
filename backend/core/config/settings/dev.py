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
