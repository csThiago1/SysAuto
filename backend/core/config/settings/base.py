"""
Paddock Solutions — Django Settings Base
"""

import os
from pathlib import Path

from celery.schedules import crontab
from decouple import config

# ─── Caminhos ────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# ─── Segurança ───────────────────────────────────────────────────────────────
SECRET_KEY = config("DJANGO_SECRET_KEY")
DEBUG = config("DJANGO_DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = config("DJANGO_ALLOWED_HOSTS", default="localhost").split(",")

# ─── Multitenancy ── django-tenants ─────────────────────────────────────────
# Apps instalados no schema PUBLIC (compartilhados entre tenants)
SHARED_APPS = [
    "django_tenants",
    # Django contrib
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.admin",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "mozilla_django_oidc",
    "corsheaders",
    "drf_spectacular",
    "django_filters",
    "django_celery_results",
    "django_celery_beat",
    "channels",
    # Paddock apps (public schema)
    "apps.authentication",
    "apps.tenants",
    "apps.customers",
    "apps.insurers",
    "apps.vehicle_catalog",
]

# Apps instalados em cada SCHEMA DE TENANT
TENANT_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    # Paddock apps (por tenant)
    "apps.persons",
    "apps.service_orders",
    "apps.experts",
    "apps.inventory",
    "apps.fiscal",
    "apps.crm",
    "apps.store",
    "apps.ai",
    "apps.cilia",
    "apps.hr",
    "apps.accounting",
    "apps.accounts_payable",
    "apps.accounts_receivable",
    "apps.pricing_profile",
    "apps.pricing_catalog",
    "apps.pricing_engine",
    "apps.pricing_tech",
    "apps.quotes",
    "apps.pricing_benchmark",
]

INSTALLED_APPS = list(set(SHARED_APPS + TENANT_APPS))

# ─── Multitenancy config ──────────────────────────────────────────────────────
TENANT_MODEL = "tenants.Company"
TENANT_DOMAIN_MODEL = "tenants.Domain"
PUBLIC_SCHEMA_NAME = "public"

# ─── Middleware ───────────────────────────────────────────────────────────────
MIDDLEWARE = [
    "django_tenants.middleware.main.TenantMainMiddleware",  # PRIMEIRO SEMPRE
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ─── Templates ───────────────────────────────────────────────────────────────
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ─── Banco de dados ──────────────────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django_tenants.postgresql_backend",
        "NAME": config("DB_NAME", default="paddock_dev"),
        "USER": config("DB_USER", default="paddock"),
        "PASSWORD": config("DB_PASSWORD", default="paddock"),
        "HOST": config("DB_HOST", default="localhost"),
        "PORT": config("DB_PORT", default="5432"),
        # Mantém conexões abertas por até 10 min — evita handshake TCP a cada request
        "CONN_MAX_AGE": config("DB_CONN_MAX_AGE", default=600, cast=int),
        "OPTIONS": {
            "sslmode": config("DB_SSLMODE", default="disable"),
            "connect_timeout": 10,
        },
    }
}

DATABASE_ROUTERS = ("django_tenants.routers.TenantSyncRouter",)

# ─── Auth ─────────────────────────────────────────────────────────────────────
AUTH_USER_MODEL = "authentication.GlobalUser"

AUTHENTICATION_BACKENDS = [
    "mozilla_django_oidc.auth.OIDCAuthenticationBackend",
    "django.contrib.auth.backends.ModelBackend",
]

# ─── OIDC / Keycloak ─────────────────────────────────────────────────────────
OIDC_RP_CLIENT_ID = config("KEYCLOAK_CLIENT_ID", default="paddock-backend")
OIDC_RP_CLIENT_SECRET = config("KEYCLOAK_CLIENT_SECRET", default="")
OIDC_OP_JWKS_ENDPOINT = config("OIDC_OP_JWKS_ENDPOINT", default="")
OIDC_OP_AUTHORIZATION_ENDPOINT = config("OIDC_OP_AUTHORIZATION_ENDPOINT", default="")
OIDC_OP_TOKEN_ENDPOINT = config("OIDC_OP_TOKEN_ENDPOINT", default="")
OIDC_OP_USER_ENDPOINT = config("OIDC_OP_USER_ENDPOINT", default="")
OIDC_RP_SIGN_ALGO = "RS256"
OIDC_STORE_ACCESS_TOKEN = True
OIDC_STORE_ID_TOKEN = True

# ─── JWT (simplejwt) ─────────────────────────────────────────────────────────
from datetime import timedelta  # noqa: E402

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM": "RS256",
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "sub",
}

# ─── REST Framework ───────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "config.pagination.StandardPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
}

# ─── drf-spectacular (Swagger) ────────────────────────────────────────────────
SPECTACULAR_SETTINGS = {
    "TITLE": "Paddock Solutions API",
    "DESCRIPTION": "API do monorepo Grupo DS Car — Paddock Solutions",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": r"/api/v[0-9]",
}

# ─── Celery ───────────────────────────────────────────────────────────────────
CELERY_BROKER_URL = config("CELERY_BROKER_URL", default="redis://localhost:6379/1")
CELERY_RESULT_BACKEND = "django-db"
CELERY_CACHE_BACKEND = "default"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "America/Manaus"
CELERY_TASK_ALWAYS_EAGER = False
CELERY_TASK_ROUTES = {
    "apps.fiscal.*": {"queue": "fiscal"},
    "apps.crm.*": {"queue": "crm"},
    "apps.ai.*": {"queue": "ai"},
}

CELERY_BEAT_SCHEDULE = {
    # Módulo Contábil — tarefas periódicas
    "accounting-update-overdue": {
        "task": "apps.accounting.tasks.update_overdue_entries",
        "schedule": crontab(hour=6, minute=0),  # Todo dia às 06:00
    },
    # Módulo Financeiro — atualização de vencidos (AP + AR)
    "ap-refresh-overdue": {
        "task": "apps.accounts_payable.tasks.task_refresh_overdue_payables_all_tenants",
        "schedule": crontab(hour=6, minute=15),  # Todo dia às 06:15
    },
    "ar-refresh-overdue": {
        "task": "apps.accounts_receivable.tasks.task_refresh_overdue_receivables_all_tenants",
        "schedule": crontab(hour=6, minute=15),  # Todo dia às 06:15
    },
}

# ─── Django Channels ─────────────────────────────────────────────────────────
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [config("CHANNEL_LAYERS_URL", default="redis://localhost:6379/2")],
        },
    },
}

# ─── Cache ────────────────────────────────────────────────────────────────────
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": config("REDIS_URL", default="redis://localhost:6379/0"),
    }
}

# ─── CORS ────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.paddock\.solutions$",
    r"^http://localhost:[0-9]+$",
]
CORS_ALLOW_CREDENTIALS = True

# ─── Criptografia (LGPD) ─────────────────────────────────────────────────────
FIELD_ENCRYPTION_KEY = config("FIELD_ENCRYPTION_KEY", default="")

# ─── Storage (AWS S3) ────────────────────────────────────────────────────────
AWS_ACCESS_KEY_ID = config("AWS_ACCESS_KEY_ID", default="")
AWS_SECRET_ACCESS_KEY = config("AWS_SECRET_ACCESS_KEY", default="")
AWS_DEFAULT_REGION = config("AWS_DEFAULT_REGION", default="sa-east-1")
AWS_STORAGE_BUCKET_NAME = config("AWS_S3_BUCKET", default="paddock-dev-storage")
AWS_S3_REGION_NAME = AWS_DEFAULT_REGION
AWS_S3_FILE_OVERWRITE = False
AWS_DEFAULT_ACL = None
DW_S3_BUCKET = config("DW_S3_BUCKET", default="paddock-dev-datalake")

# Storage condicional: local em dev, S3 em prod
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ─── Internacionalização ──────────────────────────────────────────────────────
LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Manaus"
USE_I18N = True
USE_TZ = True

# ─── Arquivos estáticos ───────────────────────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# ─── Logging ─────────────────────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {name} {module} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "apps": {"handlers": ["console"], "level": "DEBUG", "propagate": False},
    },
}

# ─── Claude / IA ─────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY = config("ANTHROPIC_API_KEY", default="")
AI_DEFAULT_MODEL = "claude-sonnet-4-5"
AI_HEAVY_MODEL = "claude-opus-4-5"

# ─── Cilia Web Service ───────────────────────────────────────────────────────
CILIA_BASE_URL = config("CILIA_BASE_URL", default="https://sistema.cilia.com.br")
CILIA_AUTH_TOKEN = config("CILIA_AUTH_TOKEN", default="")

# ─── Focus NF-e ──────────────────────────────────────────────────────────────
FOCUS_NFE_TOKEN = config("FOCUS_NFE_TOKEN", default="")
FOCUS_NFE_AMBIENTE = config("FOCUS_NFE_AMBIENTE", default="homologacao")
FOCUS_NFE_BASE_URL = (
    "https://homologacao.focusnfe.com.br"
    if FOCUS_NFE_AMBIENTE == "homologacao"
    else "https://api.focusnfe.com.br"
)
FOCUS_NFE_TIMEOUT_SECONDS = config("FOCUS_NFE_TIMEOUT_SECONDS", default=60, cast=int)
FOCUS_NFE_WEBHOOK_SECRET = config("FOCUS_NFE_WEBHOOK_SECRET", default="")
CNPJ_EMISSOR = config("CNPJ_EMISSOR", default="")

if FOCUS_NFE_AMBIENTE == "producao" and DEBUG:
    from django.core.exceptions import ImproperlyConfigured  # noqa: E402

    raise ImproperlyConfigured("FOCUS_NFE_AMBIENTE=producao não é permitido quando DEBUG=True.")
