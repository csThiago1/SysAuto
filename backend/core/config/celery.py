"""Celery app config para o ERP DS Car."""
import os

from celery import Celery
from django.conf import settings


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("dscar")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


# Beat schedule — Celery beat executa estas tasks periodicamente
app.conf.beat_schedule = {
    "expire-stale-budgets-daily": {
        "task": "apps.budgets.tasks.expire_stale_budgets",
        "schedule": 60 * 60 * 24,  # 1x por dia
    },
    "sync-active-cilia-os": {
        "task": "apps.imports.tasks.sync_active_cilia_os",
        "schedule": getattr(settings, "CILIA_POLLING_INTERVAL_MINUTES", 15) * 60,
    },
}
