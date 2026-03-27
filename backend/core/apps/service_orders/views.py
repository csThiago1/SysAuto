from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import ServiceOrder
from .serializers import (
    ChangeStatusSerializer,
    ServiceOrderCreateSerializer,
    ServiceOrderDetailSerializer,
    ServiceOrderListSerializer,
)
from .services import ServiceOrderService


class ServiceOrderViewSet(viewsets.ModelViewSet):
    queryset = ServiceOrder.objects.filter(is_active=True).select_related("customer").order_by("-created_at")
    filterset_fields = ["status", "customer"]
    search_fields = ["os_number", "vehicle_plate", "vehicle_description", "customer__full_name"]

    def get_serializer_class(self):
        if self.action == "list":
            return ServiceOrderListSerializer
        if self.action == "create":
            return ServiceOrderCreateSerializer
        return ServiceOrderDetailSerializer

    @action(detail=True, methods=["post"], url_path="change-status")
    def change_status(self, request, pk=None):
        service_order = self.get_object()
        serializer = ChangeStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated = ServiceOrderService.change_status(
            service_order=service_order,
            new_status=serializer.validated_data["status"],
            changed_by=serializer.validated_data.get("changed_by", "Sistema"),
            notes=serializer.validated_data.get("notes", ""),
        )

        output = ServiceOrderDetailSerializer(updated)
        return Response(output.data, status=status.HTTP_200_OK)
