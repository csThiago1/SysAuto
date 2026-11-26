"""
Paddock Solutions — Accounts Receivable Views

ViewSets para Contas a Receber.
Regras de negocio ficam em services.py — nunca aqui.
"""

import logging
from decimal import Decimal
from typing import Any

from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema

from django.db.models import F, Prefetch, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove

from .filters import ReceivableDocumentFilter
from .models import ReceivableDocument, ReceivableReceipt, ReceivableStatus
from .serializers import (
    CreateReceivableDocumentSerializer,
    ReceivableDocumentListSerializer,
    ReceivableDocumentSerializer,
    ReceivableReceiptSerializer,
    RecordReceiptBatchSerializer,
    RecordReceiptSerializer,
    ReverseReceiptSerializer,
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
    receive-batch POST /accounts-receivable/documents/receive-batch/ → RecordReceiptBatchSerializer
    reverse       POST /accounts-receivable/documents/{id}/receipts/{receipt_id}/reverse/
    """

    queryset = (
        ReceivableDocument.objects.filter(is_active=True)
        .select_related("cost_center", "cancelled_by")
        .prefetch_related(
            Prefetch("receipts", queryset=ReceivableReceipt.objects.select_related("reversed_by"))
        )
    )
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ReceivableDocumentFilter
    search_fields = ["description", "document_number", "customer_name"]
    ordering_fields = ["due_date", "amount", "status", "created_at"]
    ordering = ["due_date", "created_at"]

    def get_permissions(self) -> list:  # type: ignore[override]
        """Edicao do titulo e de gerente para cima."""
        if self.action in ("update", "partial_update"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return super().get_permissions()

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
            cost_center_id=(str(data["cost_center_id"]) if data.get("cost_center_id") else None),
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

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request: Request) -> Response:
        """
        Totais dos cartoes da lista, somados no banco sobre todos os titulos ativos.

        GET /accounts-receivable/documents/summary/

        Args:
            request: Request autenticado.

        Returns:
            Response com total_open, total_overdue, settled_this_month e due_today.
        """
        today = timezone.localdate()
        remaining = F("amount") - F("amount_received")
        is_open = Q(status__in=[ReceivableStatus.OPEN, ReceivableStatus.PARTIAL])
        totals = self.get_queryset().aggregate(
            total_open=Sum(remaining, filter=is_open),
            total_overdue=Sum(
                remaining,
                filter=Q(due_date__lt=today)
                & ~Q(status__in=[ReceivableStatus.RECEIVED, ReceivableStatus.CANCELLED]),
            ),
            settled_this_month=Sum(
                "amount_received",
                filter=Q(
                    status=ReceivableStatus.RECEIVED,
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
        Cria N titulos a receber com vencimentos escalonados (parcelamento).

        POST /accounts-receivable/documents/installments/
        Body: campos de CreateReceivableDocumentSerializer + num_parcelas + interval_days

        Args:
            request: Request com dados base do titulo + num_parcelas e interval_days.

        Returns:
            Response com lista de ReceivableDocumentListSerializer dos titulos criados.
        """
        data = request.data.copy()
        try:
            num_parcelas = int(data.pop("num_parcelas", 1))
            interval_days = int(data.pop("interval_days", 30))
        except (TypeError, ValueError, OverflowError):
            return Response(
                {"detail": ["num_parcelas e interval_days devem ser numeros inteiros."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if num_parcelas < 1 or num_parcelas > 12:
            return Response(
                {"num_parcelas": ["Deve ser entre 1 e 12."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not 1 <= interval_days <= 365:
            return Response(
                {"interval_days": ["Deve ser entre 1 e 365."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CreateReceivableDocumentSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        base_data = serializer.validated_data

        parcelas = ReceivableDocumentService.create_installments(
            base_data=base_data,
            num_parcelas=num_parcelas,
            interval_days=interval_days,
            user=request.user,
        )
        return Response(
            ReceivableDocumentListSerializer(parcelas, many=True).data,
            status=status.HTTP_201_CREATED,
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
        document = self.get_object()
        serializer = RecordReceiptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        receipt = ReceivableDocumentService.record_receipt(
            document_id=str(document.id),
            receipt_date=data["receipt_date"],
            amount=data["amount"],
            payment_method=data.get("payment_method", "pix"),
            bank_account=data.get("bank_account", ""),
            notes=data.get("notes", ""),
            user=request.user,
        )

        return Response(
            ReceivableReceiptSerializer(receipt).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        methods=["post"],
        detail=False,
        url_path="receive-batch",
        permission_classes=[IsAuthenticated, IsManagerOrAbove],
    )
    def receive_batch(self, request: Request) -> Response:
        """
        Baixa varios titulos pelo saldo, numa transacao so (ou todos ou nenhum).

        POST /accounts-receivable/documents/receive-batch/
        Body: { document_ids, receipt_date, payment_method, bank_account, notes }

        Args:
            request: Request com os ids dos titulos e os dados comuns da baixa.

        Returns:
            Response com count, total, without_journal_entry e os recebimentos.
        """
        serializer = RecordReceiptBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        receipts = ReceivableDocumentService.record_receipts_batch(
            **serializer.validated_data, user=request.user
        )

        return Response(
            {
                "count": len(receipts),
                "total": str(sum((receipt.amount for receipt in receipts), Decimal("0.00"))),
                "without_journal_entry": sum(1 for r in receipts if not r.journal_entry_id),
                "receipts": ReceivableReceiptSerializer(receipts, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(
        methods=["post"],
        detail=True,
        url_path=r"receipts/(?P<receipt_id>[0-9a-f-]{36})/reverse",
        permission_classes=[IsAuthenticated, IsManagerOrAbove],
    )
    def reverse_receipt(
        self, request: Request, pk: str | None = None, receipt_id: str | None = None
    ) -> Response:
        """
        Estorna uma baixa do titulo (a baixa fica inativa, nunca apagada).

        POST /accounts-receivable/documents/{id}/receipts/{receipt_id}/reverse/
        Body: { "reason": "..." }

        Args:
            request: Request com o motivo do estorno.
            pk: UUID do titulo a receber.
            receipt_id: UUID da baixa, que precisa ser desse titulo.

        Returns:
            Response com ReceivableDocumentSerializer do titulo recalculado.
        """
        document = self.get_object()
        get_object_or_404(document.receipts, id=receipt_id)
        serializer = ReverseReceiptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ReceivableDocumentService.reverse_receipt(
            document_id=str(document.id),
            receipt_id=str(receipt_id),
            reason=serializer.validated_data["reason"],
            user=request.user,
        )

        return Response(ReceivableDocumentSerializer(self.get_object()).data)

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
        document = self.get_object()
        # mesmo formato do motivo do estorno: obrigatorio, ate 200 (tamanho da coluna)
        serializer = ReverseReceiptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ReceivableDocumentService.cancel_receivable(
            document_id=str(document.id),
            reason=serializer.validated_data["reason"],
            user=request.user,
        )

        # busca de novo: as baixas estornadas vem com quem estornou, sem consulta por baixa
        return Response(ReceivableDocumentSerializer(self.get_object()).data)
