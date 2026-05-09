"""
Paddock Solutions — Financial Dashboard Service

Consolidated financial KPIs, cash flow projection, aging reports.
"""
import logging
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, F, Sum

logger = logging.getLogger(__name__)


class FinancialDashboardService:
    """Generates consolidated financial dashboard data."""

    @classmethod
    def get_summary(cls, start_date: date, end_date: date) -> dict:
        """Return all dashboard KPIs for the given period."""
        return {
            "receita_mes": cls._total_received(start_date, end_date),
            "despesa_mes": cls._total_paid(start_date, end_date),
            "ar_vencidos": cls._overdue_summary("AR"),
            "ap_vencidos": cls._overdue_summary("AP"),
            "fluxo_caixa_30d": cls._cash_flow_projection(),
            "notas_emitidas": cls._fiscal_summary_emitidas(start_date, end_date),
            "notas_recebidas": cls._fiscal_summary_recebidas(start_date, end_date),
            "notas_pendentes": cls._pending_fiscal_count(),
            "aging_ar": cls._aging_report("AR"),
            "aging_ap": cls._aging_report("AP"),
        }

    @classmethod
    def _total_received(cls, start_date: date, end_date: date) -> str:
        """Total received (baixas) in the period."""
        from apps.accounts_receivable.models import ReceivableReceipt

        total = ReceivableReceipt.objects.filter(
            receipt_date__range=(start_date, end_date),
            is_active=True,
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
        return str(total)

    @classmethod
    def _total_paid(cls, start_date: date, end_date: date) -> str:
        """Total paid (baixas) in the period."""
        from apps.accounts_payable.models import PayablePayment

        total = PayablePayment.objects.filter(
            payment_date__range=(start_date, end_date),
            is_active=True,
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
        return str(total)

    @classmethod
    def _overdue_summary(cls, tipo: str) -> dict:
        """Count and total remaining for overdue documents."""
        if tipo == "AR":
            from apps.accounts_receivable.models import ReceivableDocument

            qs = ReceivableDocument.objects.filter(
                status="overdue", is_active=True,
            )
            remaining_expr = F("amount") - F("amount_received")
        else:
            from apps.accounts_payable.models import PayableDocument

            qs = PayableDocument.objects.filter(
                status="overdue", is_active=True,
            )
            remaining_expr = F("amount") - F("amount_paid")

        agg = qs.aggregate(
            count=Count("id"),
            total_remaining=Sum(remaining_expr),
        )
        return {
            "count": agg["count"] or 0,
            "total": str(agg["total_remaining"] or 0),
        }

    @classmethod
    def _cash_flow_projection(cls) -> list[dict]:
        """4-week cash flow projection based on open AR/AP documents."""
        from apps.accounts_payable.models import PayableDocument
        from apps.accounts_receivable.models import ReceivableDocument

        weeks: list[dict] = []
        today = date.today()
        for i in range(4):
            week_start = today + timedelta(weeks=i)
            week_end = week_start + timedelta(days=6)

            entradas = ReceivableDocument.objects.filter(
                due_date__range=(week_start, week_end),
                status__in=["open", "partial", "overdue"],
                is_active=True,
            ).aggregate(
                total=Sum(F("amount") - F("amount_received"))
            )["total"] or Decimal("0")

            saidas = PayableDocument.objects.filter(
                due_date__range=(week_start, week_end),
                status__in=["open", "partial", "overdue"],
                is_active=True,
            ).aggregate(
                total=Sum(F("amount") - F("amount_paid"))
            )["total"] or Decimal("0")

            weeks.append({
                "semana": i + 1,
                "inicio": str(week_start),
                "fim": str(week_end),
                "entradas": str(entradas),
                "saidas": str(saidas),
                "saldo": str(entradas - saidas),
            })
        return weeks

    @classmethod
    def _fiscal_summary_emitidas(cls, start_date: date, end_date: date) -> dict:
        """Breakdown of authorized fiscal documents emitted in the period."""
        from apps.fiscal.models import FiscalDocument

        qs = FiscalDocument.objects.filter(
            status="authorized",
            created_at__date__range=(start_date, end_date),
            is_active=True,
        )
        by_type: dict[str, dict] = {}
        for doc_type in ["nfse", "nfe", "nfce"]:
            agg = qs.filter(document_type=doc_type).aggregate(
                count=Count("id"), total=Sum("total_value"),
            )
            by_type[doc_type] = {
                "count": agg["count"] or 0,
                "total": str(agg["total"] or 0),
            }
        total_agg = qs.aggregate(count=Count("id"), total=Sum("total_value"))
        return {
            "por_tipo": by_type,
            "total_count": total_agg["count"] or 0,
            "total_value": str(total_agg["total"] or 0),
        }

    @classmethod
    def _fiscal_summary_recebidas(cls, start_date: date, end_date: date) -> dict:
        """Count and total of incoming NF-e in the period."""
        from apps.fiscal.models import NFeEntrada

        agg = NFeEntrada.objects.filter(
            created_at__date__range=(start_date, end_date),
            is_active=True,
        ).aggregate(count=Count("id"), total=Sum("valor_total"))
        return {
            "count": agg["count"] or 0,
            "total": str(agg["total"] or 0),
        }

    @classmethod
    def _pending_fiscal_count(cls) -> int:
        """Number of fiscal documents still pending emission."""
        from apps.fiscal.models import FiscalDocument

        return FiscalDocument.objects.filter(
            status="pending", is_active=True,
        ).count()

    @classmethod
    def _aging_report(cls, tipo: str) -> list[dict]:
        """Aging report (0-30, 31-60, 61-90, 90+) for overdue documents."""
        if tipo == "AR":
            from apps.accounts_receivable.models import ReceivableDocument as Model

            amount_remaining_expr = F("amount") - F("amount_received")
        else:
            from apps.accounts_payable.models import PayableDocument as Model

            amount_remaining_expr = F("amount") - F("amount_paid")

        today = date.today()
        faixas = [
            ("0-30", today - timedelta(days=30), today),
            ("31-60", today - timedelta(days=60), today - timedelta(days=31)),
            ("61-90", today - timedelta(days=90), today - timedelta(days=61)),
            ("90+", date(2000, 1, 1), today - timedelta(days=91)),
        ]
        result: list[dict] = []
        for faixa, start, end in faixas:
            qs = Model.objects.filter(
                status="overdue",
                is_active=True,
                due_date__range=(start, end),
            )
            agg = qs.aggregate(
                count=Count("id"),
                total=Sum(amount_remaining_expr),
            )
            result.append({
                "faixa": faixa,
                "count": agg["count"] or 0,
                "total": str(agg["total"] or 0),
            })
        return result
