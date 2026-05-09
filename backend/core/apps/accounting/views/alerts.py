"""Due date alerts for AP and AR documents."""
import logging
from datetime import date, timedelta

from django.db.models import F, Sum, Count
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsConsultantOrAbove

logger = logging.getLogger(__name__)


class FinanceiroAlertasView(APIView):
    """GET /api/v1/accounting/alertas/
    Returns upcoming due dates and overdue counts for AP and AR.
    """
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get(self, request):
        today = date.today()
        alerts = []

        # AP alerts
        from apps.accounts_payable.models import PayableDocument
        for days in [0, 3, 7, 15]:
            target = today + timedelta(days=days)
            label = "hoje" if days == 0 else f"em {days} dias"
            qs = PayableDocument.objects.filter(
                due_date=target,
                status__in=["open", "partial"],
                is_active=True,
            )
            agg = qs.aggregate(count=Count("id"), total=Sum(F("amount") - F("amount_paid")))
            if agg["count"]:
                alerts.append({
                    "type": "AP",
                    "label": f"{agg['count']} titulo(s) a pagar vence(m) {label}",
                    "count": agg["count"],
                    "total": str(agg["total"] or 0),
                    "due_date": str(target),
                    "days": days,
                    "severity": "error" if days == 0 else "warning" if days <= 3 else "info",
                })

        # AR alerts
        from apps.accounts_receivable.models import ReceivableDocument
        for days in [0, 3, 7, 15]:
            target = today + timedelta(days=days)
            label = "hoje" if days == 0 else f"em {days} dias"
            qs = ReceivableDocument.objects.filter(
                due_date=target,
                status__in=["open", "partial"],
                is_active=True,
            )
            agg = qs.aggregate(count=Count("id"), total=Sum(F("amount") - F("amount_received")))
            if agg["count"]:
                alerts.append({
                    "type": "AR",
                    "label": f"{agg['count']} titulo(s) a receber vence(m) {label}",
                    "count": agg["count"],
                    "total": str(agg["total"] or 0),
                    "due_date": str(target),
                    "days": days,
                    "severity": "error" if days == 0 else "warning" if days <= 3 else "info",
                })

        # Overdue summary
        ap_overdue = PayableDocument.objects.filter(status="overdue", is_active=True).aggregate(
            count=Count("id"), total=Sum(F("amount") - F("amount_paid"))
        )
        ar_overdue = ReceivableDocument.objects.filter(status="overdue", is_active=True).aggregate(
            count=Count("id"), total=Sum(F("amount") - F("amount_received"))
        )

        return Response({
            "alerts": alerts,
            "overdue": {
                "ap": {"count": ap_overdue["count"] or 0, "total": str(ap_overdue["total"] or 0)},
                "ar": {"count": ar_overdue["count"] or 0, "total": str(ar_overdue["total"] or 0)},
            },
            "total_alerts": len(alerts),
        })
