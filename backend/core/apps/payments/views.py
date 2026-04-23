"""payments.views — ViewSet aninhado sob ServiceOrder."""
from decimal import Decimal

from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove
from apps.service_orders.models import ServiceOrder

from .models import Payment
from .serializers import PaymentSerializer
from .services import PaymentService


class PaymentViewSet(viewsets.GenericViewSet):
    """Pagamentos aninhados sob uma OS específica."""

    serializer_class = PaymentSerializer

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action == "create":
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def list(self, request: Request, service_order_pk: str | None = None) -> Response:
        """Lista pagamentos da OS especificada."""
        qs = Payment.objects.filter(
            service_order_id=service_order_pk,
            service_order__is_active=True,
        ).order_by("-created_at")
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    def create(self, request: Request, service_order_pk: str | None = None) -> Response:
        """Registra pagamento na OS especificada via PaymentService."""
        os_instance = ServiceOrder.objects.filter(pk=service_order_pk, is_active=True).first()
        if os_instance is None:
            return Response({"detail": "OS não encontrada."}, status=404)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        payment = PaymentService.record(
            service_order=os_instance,
            payer_block=d["payer_block"],
            amount=Decimal(str(d["amount"])),
            method=d["method"],
            reference=d.get("reference", ""),
            received_by=d.get("received_by", ""),
        )
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)
