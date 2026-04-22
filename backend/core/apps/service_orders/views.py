from __future__ import annotations

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    ServiceOrder,
    ServiceOrderEvent,
    ServiceOrderParecer,
    ServiceOrderVersion,
)
from .serializers import (
    AddComplementSerializer,
    ChangeStatusSerializer,
    InternalParecerSerializer,
    ServiceOrderEventSerializer,
    ServiceOrderParecerSerializer,
    ServiceOrderReadSerializer,
    ServiceOrderVersionReadSerializer,
)
from .services import ComplementoParticularService, ServiceOrderService


class ServiceOrderViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ServiceOrder.objects.filter(is_active=True).select_related(
        "customer", "insurer", "source_budget",
    ).prefetch_related(
        "versions__items__operations__operation_type",
        "versions__items__operations__labor_category",
    )
    serializer_class = ServiceOrderReadSerializer
    filterset_fields = ["customer_type", "status", "insurer", "is_active"]
    search_fields = ["os_number", "vehicle_plate", "casualty_number", "customer__full_name"]
    ordering_fields = ["created_at", "os_number", "status"]

    @action(detail=True, methods=["post"], url_path="change-status")
    def change_status(self, request, pk=None):
        os_instance = self.get_object()
        ser = ChangeStatusSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ServiceOrderService.change_status(
            service_order=os_instance,
            new_status=ser.validated_data["new_status"],
            changed_by=request.user.username,
            notes=ser.validated_data["notes"],
        )
        os_instance.refresh_from_db()
        return Response(ServiceOrderReadSerializer(os_instance).data)

    @action(detail=True, methods=["post"], url_path="complement")
    def complement(self, request, pk=None):
        os_instance = self.get_object()
        ser = AddComplementSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        from decimal import Decimal

        items_data = []
        for item in ser.validated_data["items"]:
            items_data.append({
                "description": item["description"],
                "quantity": Decimal(str(item["quantity"])),
                "unit_price": Decimal(str(item["unit_price"])),
                "net_price": Decimal(str(item["net_price"])),
                "item_type": item.get("item_type", "SERVICE"),
                "impact_area": item.get("impact_area"),
                "external_code": item.get("external_code", ""),
            })
        new_v = ComplementoParticularService.add_complement(
            service_order=os_instance,
            items_data=items_data,
            approved_by=ser.validated_data["approved_by"] or request.user.username,
        )
        return Response(
            ServiceOrderVersionReadSerializer(new_v).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"], url_path="events")
    def events(self, request, pk=None):
        os_instance = self.get_object()
        queryset = os_instance.events.all()
        event_type = request.query_params.get("event_type")
        if event_type:
            queryset = queryset.filter(event_type=event_type)
        serializer = ServiceOrderEventSerializer(queryset, many=True)
        return Response({"count": queryset.count(), "results": serializer.data})

    @action(detail=True, methods=["get", "post"], url_path="pareceres")
    def pareceres(self, request, pk=None):
        os_instance = self.get_object()
        if request.method == "GET":
            qs = os_instance.pareceres.all()
            return Response(
                ServiceOrderParecerSerializer(qs, many=True).data,
            )
        # POST — parecer interno
        ser = InternalParecerSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        version = None
        if ser.validated_data.get("version_id"):
            version = ServiceOrderVersion.objects.get(pk=ser.validated_data["version_id"])
        parecer = ServiceOrderParecer.objects.create(
            service_order=os_instance,
            version=version,
            source="internal",
            author_internal=request.user.username,
            parecer_type=ser.validated_data.get("parecer_type", "COMENTARIO_INTERNO"),
            body=ser.validated_data["body"],
        )
        from .events import OSEventLogger

        OSEventLogger.log_event(
            os_instance,
            "PARECER_ADDED",
            actor=request.user.username,
            payload={"parecer_id": parecer.pk, "source": "internal"},
        )
        return Response(
            ServiceOrderParecerSerializer(parecer).data, status=status.HTTP_201_CREATED,
        )


class ServiceOrderVersionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ServiceOrderVersionReadSerializer

    def get_queryset(self):
        return ServiceOrderVersion.objects.filter(
            service_order_id=self.kwargs["service_order_pk"],
        ).prefetch_related(
            "items__operations__operation_type",
            "items__operations__labor_category",
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, service_order_pk=None, pk=None):
        version = self.get_object()
        ServiceOrderService.approve_version(
            version=version, approved_by=request.user.username,
        )
        version.refresh_from_db()
        return Response(ServiceOrderVersionReadSerializer(version).data)
