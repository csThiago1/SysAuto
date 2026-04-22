from __future__ import annotations

from decimal import Decimal

from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.response import Response

from apps.service_orders.models import ServiceOrder

from .models import Payment
from .serializers import PaymentReadSerializer, RecordPaymentSerializer
from .services import PaymentService


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """Listagem de pagamentos. POST /service-orders/{pk}/payments/ para registrar."""

    serializer_class = PaymentReadSerializer
    filterset_fields = ["service_order", "payer_block", "method", "status"]

    def get_queryset(self):
        qs = Payment.objects.all()
        if "service_order_pk" in self.kwargs:
            qs = qs.filter(service_order_id=self.kwargs["service_order_pk"])
        return qs

    def create(self, request, service_order_pk: str | None = None) -> Response:
        os_instance = get_object_or_404(ServiceOrder, pk=service_order_pk)
        ser = RecordPaymentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        payment = PaymentService.record(
            service_order=os_instance,
            payer_block=ser.validated_data["payer_block"],
            amount=Decimal(str(ser.validated_data["amount"])),
            method=ser.validated_data["method"],
            reference=ser.validated_data.get("reference", ""),
            received_by=request.user.username,
        )
        # fiscal_doc_ref é aplicado separadamente (não é do domínio do service)
        if ser.validated_data.get("fiscal_doc_ref"):
            payment.fiscal_doc_ref = ser.validated_data["fiscal_doc_ref"]
            payment.save(update_fields=["fiscal_doc_ref"])
        return Response(PaymentReadSerializer(payment).data, status=status.HTTP_201_CREATED)
