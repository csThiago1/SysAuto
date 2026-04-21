"""Celery app config para o ERP DS Car."""
import os

from celery import Celery


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("dscar")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


# Beat schedule — Celery beat executa estas tasks periodicamente
# Cilia polling será adicionado no Ciclo 4
app.conf.beat_schedule = {
    "expire-stale-budgets-daily": {
        "task": "apps.budgets.tasks.expire_stale_budgets",
        "schedule": 60 * 60 * 24,  # 1x por dia
    },
}
