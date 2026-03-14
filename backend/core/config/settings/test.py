from .base import *  # noqa: F401, F403

DEBUG = False

# Testes: banco de dados em memória não é compatível com django-tenants
# Usa o mesmo banco mas com prefixo de teste
DATABASES["default"]["TEST"] = {"NAME": "paddock_test"}  # type: ignore[name-defined]

# Testes: Celery síncrono (sem worker)
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Testes: email mock
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Testes: storage em memória
DEFAULT_FILE_STORAGE = "django.core.files.storage.InMemoryStorage"
