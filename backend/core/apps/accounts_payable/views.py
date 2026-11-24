"""
Paddock Solutions — Accounts Payable Views

ViewSets para Contas a Pagar.
Regras de negocio ficam em services.py — nunca aqui.
"""

import logging
from decimal import Decimal
from typing import Any

from django.db.models import F, Q, Sum
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.accounting.services.account_suggestion_service import remember as remember_account
from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove

from .filters import PayableDocumentFilter
from .models import DocumentStatus, PayableDocument
from .serializers import (
    CreatePayableDocumentSerializer,
    PayableDocumentListSerializer,
    PayableDocumentSerializer,
    RecordPaymentSerializer,
)
from .services import PayableDocumentService

logger = logging.getLogger(__name__)


class SupplierViewSet(ModelViewSet):
    """Endpoint deprecated — use /api/v1/persons/?role=SUPPLIER."""

    authentication_classes: list = []
    permission_classes: list = []
    queryset = PayableDocument.objects.none()
    serializer_class = PayableDocumentSerializer  # nunca usado, 410 antes

    def list(self, request, *args, **kwargs):
        return self._gone()

    def retrieve(self, request, *args, **kwargs):
        return self._gone()

    def create(self, request, *args, **kwargs):
        return self._gone()

    def update(self, request, *args, **kwargs):
        return self._gone()

    def partial_update(self, request, *args, **kwargs):
        return self._gone()

    def destroy(self, request, *args, **kwargs):
        return self._gone()

    @action(detail=True, methods=["get", "post"], url_path="contacts")
    def contacts(self, request, pk: str | None = None):
        return self._gone()

    @staticmethod
    def _gone() -> Response:
        return Response(
            {"detail": "Endpoint movido. Use /api/v1/persons/?role=SUPPLIER"},
            status=status.HTTP_410_GONE,
            headers={"Link": "</api/v1/persons/?role=SUPPLIER>; rel=successor-version"},
        )


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
    search_fields = ["description", "document_number", "supplier__full_name"]
    ordering_fields = ["due_date", "amount", "status", "created_at"]
    ordering = ["due_date"]

    @staticmethod
    def _remember_account(document: PayableDocument) -> None:
        """
        Memoriza descricao → conta de despesa como regra de sugestao.

        A escolha do humano vira regra permanente: o mesmo item nunca mais
        precisa de LLM. Falha aqui nunca derruba o salvamento do titulo.
        """
        if not document.description or document.expense_account_id is None:
            return
        try:
            remember_account(document.description, document.expense_account)
        except Exception as exc:
            logger.warning("Falha ao memorizar sugestao de conta: %s", type(exc).__name__)

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
            expense_account_id=(
                str(data["expense_account_id"]) if data.get("expense_account_id") else None
            ),
            notes=data.get("notes", ""),
            user=request.user,
        )

        self._remember_account(document)

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
        response = super().update(request, *args, **kwargs)
        self._remember_account(self.get_object())
        return response

    def partial_update(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """Edicao parcial permitida apenas para titulos em aberto."""
        document = self.get_object()
        if document.status not in ("open", "overdue"):
            return Response(
                {"detail": "Apenas titulos em aberto podem ser editados."},
                status=status.HTTP_405_METHOD_NOT_ALLOWED,
            )
        response = super().partial_update(request, *args, **kwargs)
        self._remember_account(self.get_object())
        return response

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """DELETE desabilitado — use a acao cancel."""
        return Response(
            {"detail": "Exclusao nao permitida. Use a acao /cancel/ para cancelar o titulo."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request: Request) -> Response:
        """
        Totais dos cartoes da lista, somados no banco sobre todos os titulos ativos.

        GET /accounts-payable/documents/summary/

        Args:
            request: Request autenticado.

        Returns:
            Response com total_open, total_overdue, settled_this_month e due_today.
        """
        today = timezone.localdate()
        remaining = F("amount") - F("amount_paid")
        is_open = Q(status__in=[DocumentStatus.OPEN, DocumentStatus.PARTIAL])
        totals = self.get_queryset().aggregate(
            total_open=Sum(remaining, filter=is_open),
            total_overdue=Sum(
                remaining,
                filter=Q(due_date__lt=today)
                & ~Q(status__in=[DocumentStatus.PAID, DocumentStatus.CANCELLED]),
            ),
            settled_this_month=Sum(
                "amount_paid",
                filter=Q(
                    status=DocumentStatus.PAID,
                    due_date__year=today.year,
                    due_date__month=today.month,
                ),
            ),
            due_today=Sum(remaining, filter=is_open & Q(due_date=today)),
        )
        return Response({key: str(value or Decimal("0.00")) for key, value in totals.items()})

    @action(
        detail=False,
        methods=["post"],
        url_path="installments",
        permission_classes=[IsAuthenticated, IsManagerOrAbove],
    )
    def create_installments_action(self, request: Request) -> Response:
        """
        Cria N titulos a pagar com vencimentos escalonados (parcelamento).

        POST /accounts-payable/documents/installments/
        Body: campos de CreatePayableDocumentSerializer + num_parcelas + interval_days

        Args:
            request: Request com dados base do titulo + num_parcelas e interval_days.

        Returns:
            Response com lista de PayableDocumentListSerializer dos titulos criados.
        """
        data = request.data.copy()
        num_parcelas = int(data.pop("num_parcelas", 1))
        interval_days = int(data.pop("interval_days", 30))

        if num_parcelas < 1 or num_parcelas > 12:
            return Response(
                {"num_parcelas": "Deve ser entre 1 e 12."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CreatePayableDocumentSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        base_data = serializer.validated_data

        parcelas = PayableDocumentService.create_installments(
            base_data=base_data,
            num_parcelas=num_parcelas,
            interval_days=interval_days,
            user=request.user,
        )
        return Response(
            PayableDocumentListSerializer(parcelas, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        methods=["post"],
        detail=True,
        url_path="pay",
        permission_classes=[IsAuthenticated, IsManagerOrAbove],
    )
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
