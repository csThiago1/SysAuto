"""
Paddock Solutions — Service Orders: Dashboard Stats View
"""
from django.db.models import Count, Q, Sum
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import _get_role
from ..models import ServiceOrder, ServiceOrderStatus


@extend_schema(
    summary="Dashboard — métricas de OS",
    responses={
        200: {
            "type": "object",
            "properties": {
                "total_open": {"type": "integer"},
                "by_status": {"type": "object"},
                "today_deliveries": {"type": "integer"},
            },
        }
    },
)
class DashboardStatsView(APIView):
    """
    Endpoint de métricas do dashboard — retorno varia conforme role.

    ?role=CONSULTANT → dados pessoais
    ?role=MANAGER|ADMIN|OWNER → KPIs financeiros + equipe
    Sem parâmetro → legacy (retrocompatibilidade)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        """Retorna estatísticas do dashboard conforme role do JWT (não query param)."""
        role = _get_role(request)

        if role == "CONSULTANT":
            return Response(self._consultant_stats(request))

        if role in ("MANAGER", "ADMIN", "OWNER"):
            return Response(self._manager_stats())

        # Legacy — STOREKEEPER e fallback
        return Response(self._legacy_stats())

    # ── Legacy ────────────────────────────────────────────────────────────────

    def _legacy_stats(self) -> dict:
        """Retorna métricas no formato legado (compatibilidade)."""
        open_statuses = [
            s
            for s in ServiceOrderStatus.values
            if s not in (ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELLED)
        ]
        active_qs = ServiceOrder.objects.filter(is_active=True, status__in=open_statuses)
        total_open: int = active_qs.count()
        by_status_qs = (
            active_qs.values("status").annotate(count=Count("id")).order_by("status")
        )
        by_status: dict[str, int] = {row["status"]: row["count"] for row in by_status_qs}
        today = timezone.localdate()
        today_deliveries: int = ServiceOrder.objects.filter(
            is_active=True,
            estimated_delivery_date=today,
            status__in=open_statuses,
        ).count()
        return {
            "total_open": total_open,
            "by_status": by_status,
            "today_deliveries": today_deliveries,
        }

    # ── Consultor ─────────────────────────────────────────────────────────────

    def _consultant_stats(self, request: Request) -> dict:
        """Retorna métricas pessoais do consultor."""
        from datetime import timedelta

        today = timezone.localdate()
        week_ago = today - timedelta(days=7)

        open_qs = ServiceOrder.objects.filter(
            is_active=True,
            created_by=request.user,
        ).exclude(
            status__in=(ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELLED)
        )
        my_open: int = open_qs.count()

        deliveries_today: int = open_qs.filter(
            estimated_delivery_date=today
        ).count()

        overdue: int = open_qs.filter(
            estimated_delivery_date__lt=today
        ).count()

        completed_week: int = ServiceOrder.objects.filter(
            is_active=True,
            created_by=request.user,
            status=ServiceOrderStatus.DELIVERED,
            delivered_at__date__gte=week_ago,
        ).count()

        recent_os = ServiceOrder.objects.filter(
            is_active=True,
            created_by=request.user,
        ).exclude(
            status__in=(ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELLED)
        ).order_by("-opened_at")[:5]

        recent_list = [
            {
                "id": str(os.id),
                "number": os.number,
                "plate": os.plate,
                "customer_name": os.customer_name,
                "status": os.status,
                "status_display": os.get_status_display(),
                "days_in_shop": (today - os.opened_at.date()).days,
            }
            for os in recent_os
        ]

        return {
            "role": "consultant",
            "my_open": my_open,
            "my_deliveries_today": deliveries_today,
            "my_overdue": overdue,
            "my_completed_week": completed_week,
            "my_recent_os": recent_list,
        }

    # ── Gerente / Admin / Diretoria ───────────────────────────────────────────

    def _manager_stats(self) -> dict:
        """Retorna KPIs financeiros e de produtividade para gerentes."""
        import calendar as cal_mod
        from decimal import Decimal

        from django.db.models import ExpressionWrapper, F, Sum
        from django.db.models import DecimalField as DBDecimalField

        today = timezone.localdate()
        month_start = today.replace(day=1)

        # ── Billing: tenta ReceivableDocument, fallback em OS totais ──────────
        billing_month = Decimal("0")
        billing_by_type: dict[str, str] = {"insurer": "0.00", "private": "0.00"}
        billing_last_6: list[dict] = []

        try:
            from apps.accounts_receivable.models import ReceivableDocument

            month_docs = ReceivableDocument.objects.filter(
                competence_date__gte=month_start,
                competence_date__lte=today,
            )
            billing_month = month_docs.aggregate(total=Sum("amount"))["total"] or Decimal("0")

            insurer_total = (
                month_docs.filter(origin="OS_INSURER").aggregate(t=Sum("amount"))["t"]
                or Decimal("0")
            )
            private_total = (
                month_docs.filter(origin="OS_PRIVATE").aggregate(t=Sum("amount"))["t"]
                or Decimal("0")
            )
            billing_by_type = {
                "insurer": str(insurer_total),
                "private": str(private_total),
            }

            for i in range(5, -1, -1):
                year = today.year if today.month - i > 0 else today.year - 1
                month = (today.month - i - 1) % 12 + 1
                m_start = today.replace(year=year, month=month, day=1)
                m_end = m_start.replace(day=cal_mod.monthrange(year, month)[1])
                total = (
                    ReceivableDocument.objects.filter(
                        competence_date__range=(m_start, m_end)
                    ).aggregate(t=Sum("amount"))["t"]
                    or Decimal("0")
                )
                billing_last_6.append({
                    "month": m_start.strftime("%b/%y"),
                    "amount": str(total),
                })

        except ImportError:
            # Fallback: soma services_total + parts_total das OS entregues no mês
            total_expr = ExpressionWrapper(
                F("services_total") + F("parts_total") - F("discount_total"),
                output_field=DBDecimalField(),
            )
            delivered_qs = ServiceOrder.objects.filter(
                status=ServiceOrderStatus.DELIVERED,
                delivered_at__date__gte=month_start,
            )
            totals = delivered_qs.aggregate(
                total=Sum(total_expr),
                insurer=Sum(
                    total_expr,
                    filter=Q(customer_type="insurer"),
                ),
                private_t=Sum(
                    total_expr,
                    filter=Q(customer_type="private"),
                ),
            )
            billing_month = totals["total"] or Decimal("0")
            billing_by_type = {
                "insurer": str(totals["insurer"] or 0),
                "private": str(totals["private_t"] or 0),
            }

        # ── Entregas do mês ────────────────────────────────────────────────────
        delivered_month: int = ServiceOrder.objects.filter(
            is_active=True,
            status=ServiceOrderStatus.DELIVERED,
            delivered_at__date__gte=month_start,
        ).count()

        avg_ticket = (
            (billing_month / delivered_month).quantize(Decimal("0.01"))
            if delivered_month > 0
            else Decimal("0")
        )

        # ── OS atrasadas ───────────────────────────────────────────────────────
        overdue_qs = (
            ServiceOrder.objects.filter(is_active=True, estimated_delivery_date__lt=today)
            .exclude(status__in=(ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELLED))
            .order_by("estimated_delivery_date")
        )
        overdue_count: int = overdue_qs.count()
        overdue_os = [
            {
                "id": str(os.id),
                "number": os.number,
                "plate": os.plate,
                "customer_name": os.customer_name,
                "estimated_delivery_date": str(os.estimated_delivery_date),
                "days_overdue": (today - os.estimated_delivery_date).days,
                "status": os.status,
                "status_display": os.get_status_display(),
            }
            for os in overdue_qs[:10]
        ]

        # ── Produtividade da equipe (proxy: created_by) ────────────────────────
        productivity_qs = (
            ServiceOrder.objects.filter(
                is_active=True,
                status=ServiceOrderStatus.DELIVERED,
                delivered_at__date__gte=month_start,
            )
            .values("created_by__email")
            .annotate(delivered=Count("id"))
            .order_by("-delivered")[:10]
        )

        open_by_user = (
            ServiceOrder.objects.filter(is_active=True)
            .exclude(
                status__in=(ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELLED)
            )
            .values("created_by__email")
            .annotate(open_count=Count("id"))
        )
        open_map: dict[str, int] = {
            row["created_by__email"]: row["open_count"] for row in open_by_user
        }

        team_productivity = [
            {
                "name": (row["created_by__email"] or "")
                .split("@")[0]
                .replace(".", " ")
                .title(),
                "delivered_month": row["delivered"],
                "open_count": open_map.get(row["created_by__email"], 0),
            }
            for row in productivity_qs
        ]

        return {
            "role": "manager",
            "billing_month": str(billing_month),
            "delivered_month": delivered_month,
            "avg_ticket": str(avg_ticket),
            "overdue_count": overdue_count,
            "billing_by_type": billing_by_type,
            "billing_last_6_months": billing_last_6,
            "team_productivity": team_productivity,
            "overdue_os": overdue_os,
        }
