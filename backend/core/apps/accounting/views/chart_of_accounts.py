"""
Paddock Solutions — Accounting: ViewSet do Plano de Contas
"""
import logging
from datetime import date
from typing import Any

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.accounting.filters import ChartOfAccountFilter
from apps.accounting.models.chart_of_accounts import ChartOfAccount
from apps.accounting.serializers.chart_of_accounts import (
    ChartOfAccountCreateSerializer,
    ChartOfAccountDetailSerializer,
    ChartOfAccountListSerializer,
    ChartOfAccountTreeSerializer,
)
from apps.accounting.services.balance_service import AccountBalanceService

logger = logging.getLogger(__name__)


class ChartOfAccountViewSet(ModelViewSet):
    """
    CRUD do plano de contas.

    list     GET  /accounting/chart-of-accounts/           → lista plana
    retrieve GET  /accounting/chart-of-accounts/{id}/      → detalhe com saldo
    tree     GET  /accounting/chart-of-accounts/tree/      → árvore hierárquica
    balance  GET  /accounting/chart-of-accounts/{id}/balance/?start=&end=
    """

    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ChartOfAccountFilter
    search_fields = ["code", "name"]
    ordering_fields = ["code", "name", "level"]

    def get_queryset(self) -> Any:
        """Retorna contas com select_related para parent."""
        return (
            ChartOfAccount.objects.select_related("parent")
            .filter(is_active=True)
            .order_by("code")
        )

    def get_serializer_class(self) -> Any:
        if self.action in ("create", "update", "partial_update"):
            return ChartOfAccountCreateSerializer
        if self.action == "retrieve":
            return ChartOfAccountDetailSerializer
        if self.action == "tree":
            return ChartOfAccountTreeSerializer
        return ChartOfAccountListSerializer

    def perform_create(self, serializer: ChartOfAccountCreateSerializer) -> None:
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["get"], url_path="tree")
    def tree(self, request: Request) -> Response:
        """
        Retorna a estrutura hierárquica completa do plano de contas.

        Retorna apenas contas raiz (parent=None); os filhos são aninhados.
        """
        roots = (
            ChartOfAccount.objects.filter(
                parent__isnull=True, is_active=True
            )
            .prefetch_related("children__children__children__children")
            .order_by("code")
        )
        serializer = ChartOfAccountTreeSerializer(
            roots, many=True, context={"request": request}
        )
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="balance")
    def balance(self, request: Request, pk: str | None = None) -> Response:
        """
        Retorna o saldo da conta para o período informado.

        Query params:
            start (YYYY-MM-DD): Data de início. Opcional.
            end   (YYYY-MM-DD): Data de fim.   Opcional.
        """
        account = self.get_object()

        start_date: date | None = None
        end_date: date | None = None

        start_str = request.query_params.get("start")
        end_str = request.query_params.get("end")

        try:
            if start_str:
                start_date = date.fromisoformat(start_str)
            if end_str:
                end_date = date.fromisoformat(end_str)
        except ValueError:
            return Response(
                {"detail": "Formato de data inválido. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        balance = AccountBalanceService.get_balance(
            account, start_date=start_date, end_date=end_date
        )
        return Response(
            {
                "account_id": str(account.id),
                "code": account.code,
                "name": account.name,
                "nature": account.nature,
                "balance": balance,
                "start_date": start_str,
                "end_date": end_str,
            }
        )
