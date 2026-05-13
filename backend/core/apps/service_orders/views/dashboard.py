"""
Paddock Solutions — Service Orders: Dashboard Stats View

Retorna métricas do dashboard conforme role do JWT:
- MANAGER/ADMIN/OWNER: KPIs financeiros, pipeline, equipe, OS atrasadas
- CONSULTANT: métricas pessoais, pipeline, próximas entregas
- STOREKEEPER/fallback: fila pessoal, jornada do dia
"""
import logging
from datetime import timedelta
from decimal import Decimal

from django.core.cache import cache
from django.db.models import Avg, Count, F, Q, Sum
from django.db.models import DecimalField as DBDecimalField
from django.db.models import ExpressionWrapper
from django.db.models.functions import TruncMonth
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import _get_role
from ..models import ServiceOrder, ServiceOrderStatus

logger = logging.getLogger(__name__)

# Status terminais — reutilizados em várias queries
_TERMINAL = (ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELLED)


def _open_statuses() -> list[str]:
    """Retorna lista de status não-terminais."""
    return [s for s in ServiceOrderStatus.values if s not in _TERMINAL]


def _by_status_counts(qs: "QuerySet[ServiceOrder]") -> dict[str, int]:
    """Contagem de OS agrupada por status a partir de um queryset."""
    rows = qs.values("status").annotate(count=Count("id")).order_by("status")
    return {row["status"]: row["count"] for row in rows}


def _scheduled_today_count() -> int:
    """Conta OS com scheduling_date ou estimated_delivery_date para hoje."""
    today = timezone.localdate()
    return (
        ServiceOrder.objects.filter(is_active=True)
        .exclude(status__in=_TERMINAL)
        .filter(
            Q(scheduling_date__date=today) | Q(estimated_delivery_date=today)
        )
        .distinct()
        .count()
    )


@extend_schema(
    summary="Dashboard — métricas de OS",
    responses={
        200: {
            "type": "object",
            "properties": {
                "role": {"type": "string"},
                "by_status": {"type": "object"},
            },
        }
    },
)
class DashboardStatsView(APIView):
    """
    Endpoint de métricas do dashboard — retorno varia conforme role.

    MANAGER/ADMIN/OWNER → KPIs financeiros + pipeline + equipe
    CONSULTANT → métricas pessoais + pipeline + entregas
    STOREKEEPER/fallback → fila pessoal + jornada
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        """Retorna estatísticas do dashboard conforme role do JWT."""
        role = _get_role(request)

        if role in ("MANAGER", "ADMIN", "OWNER"):
            cached = cache.get("dashboard:manager")
            if cached is None:
                cached = self._manager_stats()
                cache.set("dashboard:manager", cached, timeout=120)
            return Response(cached)

        if role == "CONSULTANT":
            cache_key = f"dashboard:consultant:{request.user.pk}"
            cached = cache.get(cache_key)
            if cached is None:
                cached = self._consultant_stats(request)
                cache.set(cache_key, cached, timeout=60)
            return Response(cached)

        # STOREKEEPER e fallback — visão de técnico
        return Response(self._technician_stats(request))

    # ── Consultor ─────────────────────────────────────────────────────────────

    def _consultant_stats(self, request: Request) -> dict:
        """Métricas pessoais do consultor + pipeline + próximas entregas."""
        today = timezone.localdate()

        open_qs = ServiceOrder.objects.filter(
            is_active=True,
            created_by=request.user,
        ).exclude(status__in=_TERMINAL)

        my_open: int = open_qs.count()
        deliveries_today: int = open_qs.filter(estimated_delivery_date=today).count()
        overdue: int = open_qs.filter(estimated_delivery_date__lt=today).count()
        completed_week: int = ServiceOrder.objects.filter(
            is_active=True,
            created_by=request.user,
            status=ServiceOrderStatus.DELIVERED,
            delivered_at__date__gte=today - timedelta(days=7),
        ).count()

        # Novos campos — pipeline e contagens específicas
        my_by_status = _by_status_counts(open_qs)
        my_waiting_auth: int = open_qs.filter(
            status=ServiceOrderStatus.WAITING_AUTH
        ).count()
        my_waiting_parts: int = open_qs.filter(
            status=ServiceOrderStatus.WAITING_PARTS
        ).count()

        # Agendamentos do consultor para hoje
        my_scheduled_today: int = (
            open_qs.filter(
                Q(scheduling_date__date=today) | Q(estimated_delivery_date=today)
            )
            .distinct()
            .count()
        )

        # Próximas entregas — OS com estimated_delivery_date hoje ou futura
        next_deliveries_qs = (
            open_qs.filter(estimated_delivery_date__gte=today)
            .order_by("estimated_delivery_date")[:5]
        )
        my_next_deliveries = [
            {
                "id": str(os.id),
                "number": os.number,
                "plate": os.plate,
                "customer_name": os.customer_name,
                "status": os.status,
                "status_display": os.get_status_display(),
                "estimated_delivery_date": str(os.estimated_delivery_date),
            }
            for os in next_deliveries_qs
        ]

        # Recentes (mantém retrocompatibilidade)
        recent_os = open_qs.order_by("-opened_at")[:5]
        my_recent_os = [
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
            "my_by_status": my_by_status,
            "my_waiting_auth": my_waiting_auth,
            "my_waiting_parts": my_waiting_parts,
            "my_scheduled_today": my_scheduled_today,
            "my_next_deliveries": my_next_deliveries,
            "my_recent_os": my_recent_os,
        }

    # ── Gerente / Admin / Diretoria ───────────────────────────────────────────

    def _manager_stats(self) -> dict:
        """KPIs financeiros, pipeline, produtividade e OS atrasadas."""
        today = timezone.localdate()
        month_start = today.replace(day=1)

        # ── Pipeline (by_status) — global ─────────────────────────────────────
        all_open_qs = ServiceOrder.objects.filter(
            is_active=True, status__in=_open_statuses()
        )
        total_open: int = all_open_qs.count()
        by_status = _by_status_counts(all_open_qs)
        scheduled_today = _scheduled_today_count()

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

            billing_raw = (
                ReceivableDocument.objects
                .filter(competence_date__gte=month_start - timedelta(days=180))
                .annotate(month=TruncMonth("competence_date"))
                .values("month")
                .annotate(total=Sum("amount"))
                .order_by("month")
            )
            billing_last_6 = [
                {"month": row["month"].strftime("%b/%y"), "amount": str(row["total"] or 0)}
                for row in billing_raw
            ][-6:]

        except ImportError:
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
                insurer=Sum(total_expr, filter=Q(customer_type="insurer")),
                private_t=Sum(total_expr, filter=Q(customer_type="private")),
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
            .exclude(status__in=_TERMINAL)
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

        # ── Produtividade da equipe ────────────────────────────────────────────
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
            .exclude(status__in=_TERMINAL)
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
            "total_open": total_open,
            "by_status": by_status,
            "scheduled_today": scheduled_today,
            "billing_month": str(billing_month),
            "delivered_month": delivered_month,
            "avg_ticket": str(avg_ticket),
            "overdue_count": overdue_count,
            "billing_by_type": billing_by_type,
            "billing_last_6_months": billing_last_6,
            "team_productivity": team_productivity,
            "overdue_os": overdue_os,
        }

    # ── Técnico / STOREKEEPER ─────────────────────────────────────────────────

    def _technician_stats(self, request: Request) -> dict:
        """Fila pessoal, jornada do dia e stats de produtividade."""
        today = timezone.localdate()
        month_start = today.replace(day=1)

        # OS abertas atribuídas ao usuário (created_by como proxy de responsável)
        my_open_qs = ServiceOrder.objects.filter(
            is_active=True,
            created_by=request.user,
        ).exclude(status__in=_TERMINAL)

        my_open: int = my_open_qs.count()
        my_deliveries_today: int = my_open_qs.filter(
            estimated_delivery_date=today
        ).count()

        # Pipeline pessoal
        my_by_status = _by_status_counts(my_open_qs)

        # Fila ordenada — próximas OS por data de previsão
        queue_qs = my_open_qs.order_by(
            F("estimated_delivery_date").asc(nulls_last=True), "opened_at"
        )[:10]
        my_os = [
            {
                "id": str(os.id),
                "number": os.number,
                "plate": os.plate,
                "vehicle": f"{os.make} {os.model}".strip(),
                "status": os.status,
                "status_display": os.get_status_display(),
            }
            for os in queue_qs
        ]

        # Próxima OS da fila
        first = queue_qs.first()
        my_next_os = (
            {
                "plate": first.plate,
                "status": first.status,
                "status_display": first.get_status_display(),
            }
            if first
            else None
        )

        # Concluídas no mês
        my_completed_month: int = ServiceOrder.objects.filter(
            is_active=True,
            created_by=request.user,
            status=ServiceOrderStatus.DELIVERED,
            delivered_at__date__gte=month_start,
        ).count()

        # Tempo médio (dias) das OS entregues no mês
        avg_result = (
            ServiceOrder.objects.filter(
                is_active=True,
                created_by=request.user,
                status=ServiceOrderStatus.DELIVERED,
                delivered_at__date__gte=month_start,
                delivered_at__isnull=False,
            )
            .aggregate(avg_duration=Avg(F("delivered_at") - F("opened_at")))
        )
        avg_td = avg_result.get("avg_duration")
        my_avg_days: float = round(avg_td.total_seconds() / 86400, 1) if avg_td else 0

        # Global — distribuição geral (para contexto do técnico)
        total_open: int = ServiceOrder.objects.filter(
            is_active=True, status__in=_open_statuses()
        ).count()
        today_deliveries: int = ServiceOrder.objects.filter(
            is_active=True,
            estimated_delivery_date=today,
            status__in=_open_statuses(),
        ).count()

        return {
            "role": "technician",
            "total_open": total_open,
            "today_deliveries": today_deliveries,
            "my_open": my_open,
            "my_deliveries_today": my_deliveries_today,
            "my_by_status": my_by_status,
            "my_os": my_os,
            "my_next_os": my_next_os,
            "my_completed_month": my_completed_month,
            "my_avg_days": my_avg_days,
        }
