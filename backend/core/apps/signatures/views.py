from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.quotes.models import Orcamento
from apps.service_orders.models import ServiceOrder

from .models import Signature
from .serializers import (
    CaptureSignatureSerializer,
    SignatureDetailSerializer,
    SignatureReadSerializer,
)
from .services import SignatureService


class SignatureViewSet(viewsets.ReadOnlyModelViewSet):
    """Listagem/detalhe de assinaturas + action capture."""

    permission_classes = [IsAuthenticated]
    queryset = Signature.objects.select_related("service_order", "orcamento")
    filterset_fields = ["service_order", "orcamento", "document_type", "method"]
    ordering_fields = ["signed_at"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return SignatureDetailSerializer
        return SignatureReadSerializer

    @action(detail=False, methods=["post"])
    def capture(self, request):
        """Captura assinatura nova.

        Body JSON:
          {
            "document_type": "BUDGET_APPROVAL",
            "method": "CANVAS_TABLET",
            "signer_name": "João Cliente",
            "signature_png_base64": "iVBORw0KGgoAA...",
            "service_order_id": 42,  // ou orcamento_id
            "signer_cpf": "000.000.000-00"  // opcional
          }
        """
        ser = CaptureSignatureSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        service_order = None
        orcamento = None
        if ser.validated_data.get("service_order_id"):
            service_order = get_object_or_404(
                ServiceOrder, pk=ser.validated_data["service_order_id"],
            )
        if ser.validated_data.get("orcamento_id"):
            orcamento = get_object_or_404(Orcamento, pk=ser.validated_data["orcamento_id"])

        ip = request.META.get("REMOTE_ADDR")
        ua = request.META.get("HTTP_USER_AGENT", "")

        signature = SignatureService.capture(
            document_type=ser.validated_data["document_type"],
            method=ser.validated_data["method"],
            signer_name=ser.validated_data["signer_name"],
            signature_png_base64=ser.validated_data["signature_png_base64"],
            service_order=service_order,
            orcamento=orcamento,
            signer_cpf=ser.validated_data.get("signer_cpf", ""),
            ip_address=ip,
            user_agent=ua,
            notes=ser.validated_data.get("notes", ""),
        )

        return Response(
            SignatureDetailSerializer(signature).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"])
    def verify(self, request, pk=None):
        """Verifica integridade do hash."""
        sig = self.get_object()
        is_valid = SignatureService.verify_integrity(sig)
        return Response({
            "signature_id": sig.pk,
            "integrity_valid": is_valid,
            "stored_hash": sig.signature_hash,
        })
