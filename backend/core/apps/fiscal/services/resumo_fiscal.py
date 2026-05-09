"""
Fiscal — Resumo Fiscal Mensal
Totais de impostos e documentos emitidos por periodo.
"""
import logging
from datetime import date

from django.db.models import Count, Q, Sum

logger = logging.getLogger(__name__)


class ResumoFiscalService:
    """Servico para gerar resumo fiscal mensal."""

    @classmethod
    def get_monthly_summary(cls, year: int, month: int) -> dict:
        """Retorna resumo fiscal para o mes/ano informados.

        Args:
            year: Ano do periodo.
            month: Mes do periodo (1-12).

        Returns:
            Dicionario com contadores e totais de NFS-e, NF-e,
            impostos agregados e documentos cancelados.
        """
        from apps.fiscal.models import FiscalDocument, FiscalDocumentItem

        docs = FiscalDocument.objects.filter(
            status="authorized",
            created_at__year=year,
            created_at__month=month,
            is_active=True,
        )

        nfse_agg = docs.filter(document_type="nfse").aggregate(
            count=Count("id"),
            total=Sum("total_value"),
        )
        nfe_agg = docs.filter(document_type="nfe").aggregate(
            count=Count("id"),
            total=Sum("total_value"),
        )

        # Tax totals from items
        items = FiscalDocumentItem.objects.filter(
            document__in=docs,
        )
        tax_agg = items.aggregate(
            total_iss=Sum("valor_iss"),
            total_icms=Sum("icms_valor"),
            total_pis=Sum("pis_valor"),
            total_cofins=Sum("cofins_valor"),
        )

        cancelled = FiscalDocument.objects.filter(
            status="cancelled",
            created_at__year=year,
            created_at__month=month,
            is_active=True,
        ).count()

        return {
            "year": year,
            "month": month,
            "nfse": {
                "count": nfse_agg["count"] or 0,
                "total": str(nfse_agg["total"] or 0),
            },
            "nfe": {
                "count": nfe_agg["count"] or 0,
                "total": str(nfe_agg["total"] or 0),
            },
            "impostos": {
                "iss": str(tax_agg["total_iss"] or 0),
                "icms": str(tax_agg["total_icms"] or 0),
                "pis": str(tax_agg["total_pis"] or 0),
                "cofins": str(tax_agg["total_cofins"] or 0),
            },
            "total_emitidas": (nfse_agg["count"] or 0) + (nfe_agg["count"] or 0),
            "total_canceladas": cancelled,
        }
