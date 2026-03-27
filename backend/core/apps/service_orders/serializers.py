from rest_framework import serializers

from .models import ServiceOrder, ServiceOrderStatusHistory


class ServiceOrderStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOrderStatusHistory
        fields = ["id", "from_status", "to_status", "changed_by", "notes", "changed_at"]
        read_only_fields = fields


class ServiceOrderListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)

    class Meta:
        model = ServiceOrder
        fields = [
            "id",
            "os_number",
            "customer",
            "customer_name",
            "vehicle_plate",
            "vehicle_description",
            "status",
            "total_value",
            "created_at",
        ]
        read_only_fields = fields


class ServiceOrderCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOrder
        fields = ["os_number", "customer", "vehicle_plate", "vehicle_description", "total_value", "notes"]


class ServiceOrderDetailSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    status_history = ServiceOrderStatusHistorySerializer(many=True, read_only=True)

    class Meta:
        model = ServiceOrder
        fields = [
            "id",
            "os_number",
            "customer",
            "customer_name",
            "vehicle_plate",
            "vehicle_description",
            "status",
            "total_value",
            "notes",
            "status_history",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "status_history"]


class ChangeStatusSerializer(serializers.Serializer):
    status = serializers.CharField()
    changed_by = serializers.CharField(required=False, allow_blank=True, default="Sistema")
    notes = serializers.CharField(required=False, allow_blank=True, default="")
