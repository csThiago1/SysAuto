"""
Paddock Solutions — Accounts Payable Views

ViewSets para Contas a Pagar.
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

from .filters import PayableDocumentFilter, SupplierFilter
from .models import PayableDocument, Supplier
from .serializers import (
    CreatePayableDocumentSerializer,
    PayableDocumentListSerializer,
    PayableDocumentSerializer,
    RecordPaymentSerializer,
    SupplierListSerializer,
    SupplierSerializer,
)
from .services import PayableDocumentService

logger = logging.getLogger(__name__)


class SupplierViewSet(ModelViewSet):
    """
    CRUD de fornecedores.

    list     GET  /accounts-payable/suppliers/       → SupplierListSerializer
    retrieve GET  /accounts-payable/suppliers/{id}/  → SupplierSerializer
    create   POST /accounts-payable/suppliers/       → SupplierSerializer
    update   PUT  /accounts-payable/suppliers/{id}/  → SupplierSerializer
    destroy  DEL  /accounts-payable/suppliers/{id}/  → 204
    """

    queryset = Supplier.objects.filter(is_active=True)
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = SupplierFilter
    search_fields = ["name", "cnpj"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    def get_serializer_class(self) -> type:
        """Retorna serializer adequado para cada acao."""
        if self.action == "list":
            return SupplierListSerializer
        return SupplierSerializer

    def perform_create(self, serializer: Any) -> None:
        """Injeta usuario criador."""
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer: Any) -> None:
        """Injeta usuario atualizador."""
        serializer.save()


class PayableDocumentViewSet(ModelViewSet):
    """
    Gestao de titulos a pagar.

    list          GET  /accounts-payable/documents/            → PayableDocumentListSerializer
    retrieve      GET  /accounts-payable/documents/{id}/       → PayableDocumentSerializer
    create        POST /accounts-payable/documents/            → CreatePayableDocumentSerializer
    update        PUT  /accounts-payable/documents/{id}/       → 405 se status != 'open'
    partial_update PATCH /accounts-payable/documents/{id}/     → 405 se status != 'open'
    destroy       DELETE /accounts-payable/documents/{id}/     → 405 (usar cancel)
    pay           POST /accounts-payable/documents/{id}/pay/   → RecordPaymentSerializer
    cancel        POST /accounts-payable/documents/{id}/cancel/ → {"reason": "..."}
    """

    queryset = (
        PayableDocument.objects.filter(is_active=True)
        .select_related("supplier", "cost_center", "cancelled_by")
        .prefetch_related("payments")
    )
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = PayableDocumentFilter
    search_fields = ["description", "document_number", "supplier__name"]
    ordering_fields = ["due_date", "amount", "status", "created_at"]
    ordering = ["due_date"]

    def get_serializer_class(self) -> type:
        """Retorna serializer adequado para cada acao."""
        if self.action == "list":
            return PayableDocumentListSerializer
        if self.action == "create":
            return CreatePayableDocumentSerializer
        if self.action == "pay":
            return RecordPaymentSerializer
        return PayableDocumentSerializer

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """
        Cria novo titulo a pagar via PayableDocumentService.

        Args:
            request: Request com dados do titulo.

        Returns:
            Response com PayableDocumentSerializer do titulo criado.
        """
        serializer = CreatePayableDocumentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        document = PayableDocumentService.create_payable(
            supplier_id=str(data["supplier_id"]),
            description=data["description"],
            amount=data["amount"],
            due_date=data["due_date"],
            competence_date=data["competence_date"],
            document_number=data.get("document_number", ""),
            origin=data.get("origin", "MAN"),
            cost_center_id=str(data["cost_center_id"]) if data.get("cost_center_id") else None,
            notes=data.get("notes", ""),
            user=request.user,
        )

        out_serializer = PayableDocumentSerializer(document)
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

    @action(methods=["post"], detail=True, url_path="pay")
    def pay(self, request: Request, pk: str | None = None) -> Response:
        """
        Registra pagamento (baixa) de titulo a pagar.

        POST /accounts-payable/documents/{id}/pay/
        Body: { payment_date, amount, payment_method, bank_account, notes }

        Args:
            request: Request com dados do pagamento.
            pk: UUID do titulo a pagar.

        Returns:
            Response com dados do pagamento registrado.
        """
        serializer = RecordPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        payment = PayableDocumentService.record_payment(
            document_id=str(pk),
            payment_date=data["payment_date"],
            amount=data["amount"],
            payment_method=data.get("payment_method", "bank_transfer"),
            bank_account=data.get("bank_account", ""),
            notes=data.get("notes", ""),
            user=request.user,
        )

        from .serializers import PayablePaymentSerializer

        return Response(
            PayablePaymentSerializer(payment).data,
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
        Cancela titulo a pagar.

        POST /accounts-payable/documents/{id}/cancel/
        Body: { "reason": "..." }

        Args:
            request: Request com motivo do cancelamento.
            pk: UUID do titulo a pagar.

        Returns:
            Response com PayableDocumentSerializer do titulo cancelado.
        """
        reason = request.data.get("reason", "")
        if not reason:
            return Response(
                {"reason": "O motivo do cancelamento e obrigatorio."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        document = PayableDocumentService.cancel_payable(
            document_id=str(pk),
            reason=reason,
            user=request.user,
        )

        return Response(PayableDocumentSerializer(document).data)
