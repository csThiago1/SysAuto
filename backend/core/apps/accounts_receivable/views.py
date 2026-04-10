"""
Paddock Solutions — Accounts Receivable Views

ViewSets para Contas a Receber.
Regras de negocio ficam em services.py — nunca aqui.
"""
import logging
from typing import Any

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove

from .filters import ReceivableDocumentFilter
from .models import ReceivableDocument
from .serializers import (
    CreateReceivableDocumentSerializer,
    ReceivableDocumentListSerializer,
    ReceivableDocumentSerializer,
    RecordReceiptSerializer,
)
from .services import ReceivableDocumentService

logger = logging.getLogger(__name__)


class ReceivableDocumentViewSet(ModelViewSet):
    """
    Gestao de titulos a receber.

    list          GET  /accounts-receivable/documents/              → ReceivableDocumentListSerializer
    retrieve      GET  /accounts-receivable/documents/{id}/         → ReceivableDocumentSerializer
    create        POST /accounts-receivable/documents/              → CreateReceivableDocumentSerializer
    update        PUT  /accounts-receivable/documents/{id}/         → 405 se status != 'open'
    partial_update PATCH /accounts-receivable/documents/{id}/       → 405 se status != 'open'
    destroy       DELETE /accounts-receivable/documents/{id}/       → 405 (usar cancel)
    receive       POST /accounts-receivable/documents/{id}/receive/ → RecordReceiptSerializer
    cancel        POST /accounts-receivable/documents/{id}/cancel/  → {"reason": "..."}
    """

    queryset = (
        ReceivableDocument.objects.filter(is_active=True)
        .select_related("cost_center", "cancelled_by")
        .prefetch_related("receipts")
    )
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ReceivableDocumentFilter
    search_fields = ["description", "document_number", "customer_name"]
    ordering_fields = ["due_date", "amount", "status", "created_at"]
    ordering = ["due_date"]

    def get_serializer_class(self) -> type:
        """Retorna serializer adequado para cada acao."""
        if self.action == "list":
            return ReceivableDocumentListSerializer
        if self.action == "create":
            return CreateReceivableDocumentSerializer
        if self.action == "receive":
            return RecordReceiptSerializer
        return ReceivableDocumentSerializer

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """
        Cria novo titulo a receber via ReceivableDocumentService.

        Args:
            request: Request com dados do titulo.

        Returns:
            Response com ReceivableDocumentSerializer do titulo criado.
        """
        serializer = CreateReceivableDocumentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        document = ReceivableDocumentService.create_receivable(
            customer_id=str(data["customer_id"]),
            customer_name=data["customer_name"],
            description=data["description"],
            amount=data["amount"],
            due_date=data["due_date"],
            competence_date=data["competence_date"],
            origin=data.get("origin", "MAN"),
            service_order_id=(
                str(data["service_order_id"]) if data.get("service_order_id") else None
            ),
            document_number=data.get("document_number", ""),
            cost_center_id=(
                str(data["cost_center_id"]) if data.get("cost_center_id") else None
            ),
            notes=data.get("notes", ""),
            user=request.user,
        )

        out_serializer = ReceivableDocumentSerializer(document)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """Edicao permitida apenas para titulos em aberto."""
        document = self.get_object()
        if document.status not in ("open", "overdue"):
            return Response(
                {"detail": "Apenas titulos em aberto podem ser editados."},
                status=status.HTTP_405_METHOD_NOT_ALLOWED,
            )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """Edicao parcial permitida apenas para titulos em aberto."""
        document = self.get_object()
        if document.status not in ("open", "overdue"):
            return Response(
                {"detail": "Apenas titulos em aberto podem ser editados."},
                status=status.HTTP_405_METHOD_NOT_ALLOWED,
            )
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """DELETE desabilitado — use a acao cancel."""
        return Response(
            {"detail": "Exclusao nao permitida. Use a acao /cancel/ para cancelar o titulo."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(
        methods=["post"],
        detail=True,
        url_path="receive",
        permission_classes=[IsAuthenticated, IsManagerOrAbove],
    )
    def receive(self, request: Request, pk: str | None = None) -> Response:
        """
        Registra recebimento (baixa) de titulo a receber.

        POST /accounts-receivable/documents/{id}/receive/
        Body: { receipt_date, amount, payment_method, bank_account, notes }

        Args:
            request: Request com dados do recebimento.
            pk: UUID do titulo a receber.

        Returns:
            Response com dados do recebimento registrado.
        """
        serializer = RecordReceiptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        receipt = ReceivableDocumentService.record_receipt(
            document_id=str(pk),
            receipt_date=data["receipt_date"],
            amount=data["amount"],
            payment_method=data.get("payment_method", "pix"),
            bank_account=data.get("bank_account", ""),
            notes=data.get("notes", ""),
            user=request.user,
        )

        from .serializers import ReceivableReceiptSerializer

        return Response(
            ReceivableReceiptSerializer(receipt).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        methods=["post"],
        detail=True,
        url_path="cancel",
        permission_classes=[IsAuthenticated, IsManagerOrAbove],
    )
    def cancel(self, request: Request, pk: str | None = None) -> Response:
        """
        Cancela titulo a receber.

        POST /accounts-receivable/documents/{id}/cancel/
        Body: { "reason": "..." }

        Args:
            request: Request com motivo do cancelamento.
            pk: UUID do titulo a receber.

        Returns:
            Response com ReceivableDocumentSerializer do titulo cancelado.
        """
        reason = request.data.get("reason", "")
        if not reason:
            return Response(
                {"reason": "O motivo do cancelamento e obrigatorio."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        document = ReceivableDocumentService.cancel_receivable(
            document_id=str(pk),
            reason=reason,
            user=request.user,
        )

        return Response(ReceivableDocumentSerializer(document).data)
