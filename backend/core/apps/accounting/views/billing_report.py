"""
Paddock Solutions — Faturamento View

GET /api/v1/accounting/faturamento/?start_date=...&end_date=...&group_by=customer
Agrupamento por cliente, origem ou mes.
"""
import logging
from datetime import date
from decimal import Decimal

from django.db.models import Count, Sum
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsManagerOrAbove

logger = logging.getLogger(__name__)


class FaturamentoView(APIView):
    """Faturamento agrupado por cliente, origem ou mes."""

    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    def get(self, request: Request) -> Response:
        """Retorna faturamento agregado para o periodo informado.

        Query params:
            start_date (opcional): YYYY-MM-DD (default: primeiro dia do mes)
            end_date (opcional): YYYY-MM-DD (default: hoje)
            group_by (opcional): customer | origin | month (default: customer)
        """
        from apps.accounts_receivable.models import ReceivableDocument

        start_str = request.query_params.get("start_date")
        end_str = request.query_params.get("end_date")
        group_by = request.query_params.get("group_by", "customer")

        today = date.today()
        start_date = date.fromisoformat(start_str) if start_str else today.replace(day=1)
        end_date = date.fromisoformat(end_str) if end_str else today

        base_qs = ReceivableDocument.objects.filter(
            created_at__date__range=(start_date, end_date),
            is_active=True,
            status__in=["open", "partial", "received", "overdue"],
        )

        if group_by == "customer":
            data = list(
                base_qs.values("customer_name")
                .annotate(
                    total=Sum("amount"),
                    count=Count("id"),
                    received=Sum("amount_received"),
                )
                .order_by("-total")[:20]
            )
        elif group_by == "origin":
            data = list(
                base_qs.values("origin")
                .annotate(
                    total=Sum("amount"),
                    count=Count("id"),
                )
                .order_by("-total")
            )
        elif group_by == "month":
            from django.db.models.functions import TruncMonth

            data = list(
                base_qs.annotate(month=TruncMonth("created_at"))
                .values("month")
                .annotate(
                    total=Sum("amount"),
                    count=Count("id"),
                    received=Sum("amount_received"),
                )
                .order_by("month")
            )
            for item in data:
                item["month"] = str(item["month"].date()) if item.get("month") else ""
        else:
            data = []

        # Convert Decimals to strings for JSON
        for item in data:
            for key in ["total", "received"]:
                if key in item and item[key] is not None:
                    item[key] = str(item[key])

        total_agg = base_qs.aggregate(
            total=Sum("amount"), received=Sum("amount_received")
        )

        return Response(
            {
                "period": {"start": str(start_date), "end": str(end_date)},
                "group_by": group_by,
                "items": data,
                "totals": {
                    "total": str(total_agg["total"] or 0),
                    "received": str(total_agg["received"] or 0),
                },
            }
        )
