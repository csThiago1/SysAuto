"""Web Push — subscriptions e preferências por usuário (spec 2026-06-22)."""
from django.conf import settings
from django.db import models


class PushSubscription(models.Model):
    """Subscription Web Push de um device do usuário."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_subscriptions"
    )
    endpoint = models.URLField(max_length=500, unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    user_agent = models.CharField(max_length=300, blank=True, default="")
    device_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notifications_push_subscription"

    def __str__(self) -> str:
        return f"{self.user_id} · {self.endpoint[:40]}"


class NotificationPreference(models.Model):
    """Preferências de push por usuário — flags por tipo de evento."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_preference"
    )
    os_status_changes = models.BooleanField(default=True)
    os_assigned = models.BooleanField(default=True)
    approvals_pending = models.BooleanField(default=True)
    overdue_orders = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notifications_preference"


class NotificationLog(models.Model):
    """Auditoria de pushes enviados."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_logs"
    )
    title = models.CharField(max_length=120)
    body = models.CharField(max_length=300, blank=True, default="")
    url = models.CharField(max_length=300, blank=True, default="")
    success_count = models.PositiveSmallIntegerField(default=0)
    failure_count = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications_log"
        ordering = ["-created_at"]
