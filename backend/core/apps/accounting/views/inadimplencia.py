"""
Paddock Solutions — Inadimplencia View

GET /api/v1/accounting/inadimplencia/
Lista clientes com titulos vencidos, ordenados por saldo restante.
"""
import logging

from django.db.models import Count, F, Sum
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsManagerOrAbove

logger = logging.getLogger(__name__)


class InadimplenciaView(APIView):
    """Clientes inadimplentes — titulos vencidos agrupados por cliente."""

    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    def get(self, request: Request) -> Response:
        """Retorna lista de clientes com titulos vencidos.

        Agrupa por cliente, mostrando total e saldo restante.
        Limitado aos 50 maiores devedores.
        """
        from apps.accounts_receivable.models import ReceivableDocument

        overdue = (
            ReceivableDocument.objects.filter(
                status="overdue",
                is_active=True,
            )
            .values("customer_name", "customer_id")
            .annotate(
                total_amount=Sum("amount"),
                total_remaining=Sum(F("amount") - F("amount_received")),
                count=Count("id"),
            )
            .order_by("-total_remaining")[:50]
        )

        items = []
        for row in overdue:
            items.append(
                {
                    "customer_name": row["customer_name"],
                    "customer_id": row["customer_id"],
                    "total_amount": str(row["total_amount"] or 0),
                    "total_remaining": str(row["total_remaining"] or 0),
                    "count": row["count"],
                }
            )

        total_agg = ReceivableDocument.objects.filter(
            status="overdue",
            is_active=True,
        ).aggregate(
            total=Sum(F("amount") - F("amount_received")),
            count=Count("id"),
        )

        return Response(
            {
                "items": items,
                "totals": {
                    "total_remaining": str(total_agg["total"] or 0),
                    "count": total_agg["count"] or 0,
                },
            }
        )
