"""
Paddock Solutions — Celery Application
"""
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("paddock")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

# Filas por módulo
app.conf.task_queues = {
    "default": {"exchange": "default", "routing_key": "default"},
    "fiscal": {"exchange": "fiscal", "routing_key": "fiscal"},
    "crm": {"exchange": "crm", "routing_key": "crm"},
    "ai": {"exchange": "ai", "routing_key": "ai"},
}
app.conf.task_default_queue = "default"
