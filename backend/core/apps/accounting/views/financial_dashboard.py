"""
Paddock Solutions — Financial Dashboard View

GET /api/v1/accounting/dashboard/?start_date=2026-05-01&end_date=2026-05-31
"""
import logging
from datetime import date, datetime
from decimal import Decimal

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounting.services.financial_dashboard import FinancialDashboardService
from apps.authentication.permissions import IsManagerOrAbove

logger = logging.getLogger(__name__)


class FinancialDashboardView(APIView):
    """Consolidated financial dashboard with KPIs, cash flow, and aging."""

    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    def get(self, request: Request) -> Response:
        """Return dashboard data for the given period.

        Query params:
            start_date (optional): YYYY-MM-DD (defaults to 1st of current month)
            end_date (optional): YYYY-MM-DD (defaults to today)
        """
        start_str = request.query_params.get("start_date")
        end_str = request.query_params.get("end_date")

        if not start_str or not end_str:
            today = date.today()
            start_date = today.replace(day=1)
            end_date = today
        else:
            try:
                start_date = datetime.strptime(start_str, "%Y-%m-%d").date()
                end_date = datetime.strptime(end_str, "%Y-%m-%d").date()
            except ValueError:
                return Response(
                    {"detail": "Formato de data invalido. Use YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if start_date > end_date:
                return Response(
                    {"detail": "start_date nao pode ser posterior a end_date."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        data = FinancialDashboardService.get_summary(start_date, end_date)
        data["saldo"] = str(
            Decimal(data["receita_mes"]) - Decimal(data["despesa_mes"])
        )
        return Response(data, status=status.HTTP_200_OK)
