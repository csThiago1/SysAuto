"""
Paddock Solutions — Followups Serializers
"""

from typing import Any

from rest_framework import serializers

from apps.followups.models import FollowUp, FollowUpOutcome, FollowUpRule


class FollowUpRuleSerializer(serializers.ModelSerializer):
    """CRUD das regras de retorno."""

    class Meta:
        model = FollowUpRule
        fields = [
            "id",
            "name",
            "trigger_event",
            "delay_hours",
            "channel",
            "message_template",
            "link",
            "os_types",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class FollowUpSerializer(serializers.ModelSerializer):
    """Retorno na fila de trabalho, com os dados da OS para exibição."""

    rule_name = serializers.CharField(source="rule.name", read_only=True)
    link = serializers.CharField(source="rule.link", read_only=True)
    os_number = serializers.IntegerField(source="service_order.number", read_only=True)
    plate = serializers.CharField(source="service_order.plate", read_only=True)
    customer_name = serializers.CharField(source="service_order.customer_name", read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    message = serializers.SerializerMethodField()

    class Meta:
        model = FollowUp
        fields = [
            "id",
            "rule",
            "rule_name",
            "service_order",
            "os_number",
            "plate",
            "customer_name",
            "due_at",
            "status",
            "channel",
            "assigned_to",
            "assigned_to_name",
            "dispatched_at",
            "completed_at",
            "outcome",
            "notes",
            "link",
            "message",
        ]
        # Situação e datas mudam só pelas ações complete/reschedule/skip.
        read_only_fields = [
            "id",
            "rule",
            "service_order",
            "status",
            "channel",
            "dispatched_at",
            "completed_at",
            "outcome",
        ]

    def get_assigned_to_name(self, obj: FollowUp) -> str:
        """Nome do responsável, ou vazio quando não há."""
        user = obj.assigned_to
        if user is None:
            return ""
        return user.get_full_name() or user.email

    def get_message(self, obj: FollowUp) -> str:
        """Mensagem da regra já renderizada com os dados da OS."""
        order = obj.service_order
        return obj.rule.render(
            customer=order.customer_name or "",
            plate=order.plate or "",
            os_number=order.number,
        )


class CompleteFollowUpSerializer(serializers.Serializer):
    """Entrada da ação complete."""

    outcome = serializers.ChoiceField(choices=FollowUpOutcome.choices)
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def update(self, instance: Any, validated_data: Any) -> Any:  # pragma: no cover
        raise NotImplementedError

    def create(self, validated_data: Any) -> Any:  # pragma: no cover
        raise NotImplementedError


class RescheduleFollowUpSerializer(serializers.Serializer):
    """Entrada da ação reschedule."""

    due_at = serializers.DateTimeField()

    def update(self, instance: Any, validated_data: Any) -> Any:  # pragma: no cover
        raise NotImplementedError

    def create(self, validated_data: Any) -> Any:  # pragma: no cover
        raise NotImplementedError
