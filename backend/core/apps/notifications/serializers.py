from rest_framework import serializers

from apps.notifications.models import NotificationPreference, PushSubscription


class PushSubscribeSerializer(serializers.Serializer):
    """Body de POST /notifications/subscribe/ — formato PushSubscription do browser."""

    endpoint = serializers.URLField(max_length=500)
    keys = serializers.DictField(child=serializers.CharField())
    device_id = serializers.CharField(max_length=64, required=False, default="")

    def validate_keys(self, value: dict) -> dict:
        if "p256dh" not in value or "auth" not in value:
            raise serializers.ValidationError("keys deve conter p256dh e auth.")
        return value


class PushUnsubscribeSerializer(serializers.Serializer):
    endpoint = serializers.URLField(max_length=500)


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ["os_status_changes", "os_assigned", "approvals_pending", "overdue_orders"]


class PushSubscriptionListSerializer(serializers.ModelSerializer):
    class Meta:
        model = PushSubscription
        fields = ["id", "user_agent", "device_id", "created_at", "last_used_at"]
        read_only_fields = fields
