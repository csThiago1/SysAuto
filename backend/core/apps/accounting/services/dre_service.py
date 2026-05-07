"""
Paddock Solutions — DRE (Demonstração do Resultado do Exercício)

Agrega saldos do plano de contas por grupo para gerar DRE.
Estrutura contábil DS Car:
  4.x — Receita
  5.x — Custos (CMV/CSP)
  6.x — Despesas Operacionais
  7.x — Resultado Financeiro (futuro)
"""
import logging
from datetime import date
from decimal import Decimal

from django.db.models import Q, Sum

from apps.accounting.models.chart_of_accounts import ChartOfAccount
from apps.accounting.models.journal_entry import JournalEntryLine

logger = logging.getLogger(__name__)

ZERO = Decimal("0.00")

# Prefixos do plano de contas para cada grupo do DRE
DRE_GROUPS = {
    "receita_bruta": "4.1",
    "deducoes_receita": "4.2",
    "custos": "5",
    "despesas_operacionais": "6",
    "resultado_financeiro": "7",
    "impostos_resultado": "8",
}


class DREService:
    """Gera Demonstração do Resultado do Exercício a partir dos lançamentos."""

    @classmethod
    def generate(
        cls,
        start_date: date,
        end_date: date,
        cost_center_id: str | None = None,
    ) -> dict:
        """Calcula DRE para o período.

        Args:
            start_date: Início do período (inclusive).
            end_date: Fim do período (inclusive).
            cost_center_id: Filtrar por centro de custo (opcional).

        Returns:
            Dict com totais por grupo e resultado líquido.
        """
        # Busca todas as linhas aprovadas e não estornadas no período
        base_qs = JournalEntryLine.objects.filter(
            entry__is_approved=True,
            entry__is_reversed=False,
            entry__competence_date__gte=start_date,
            entry__competence_date__lte=end_date,
        ).select_related("account", "entry")

        if cost_center_id:
            base_qs = base_qs.filter(cost_center_id=cost_center_id)

        def _sum_group(prefix: str) -> Decimal:
            """Soma saldos de contas com o prefixo (credora: C-D, devedora: D-C)."""
            qs = base_qs.filter(account__code__startswith=prefix)
            agg = qs.aggregate(
                total_debit=Sum("debit_amount"),
                total_credit=Sum("credit_amount"),
            )
            d = agg["total_debit"] or ZERO
            c = agg["total_credit"] or ZERO
            # Contas 4.x são credoras (receita), 5.x/6.x devedoras (custo/despesa)
            if prefix.startswith("4"):
                return c - d  # receita positiva quando crédito > débito
            return d - c  # custo/despesa positivo quando débito > crédito

        def _detail_group(prefix: str) -> list[dict]:
            """Detalha saldos por conta analítica dentro do grupo."""
            qs = (
                base_qs.filter(account__code__startswith=prefix)
                .values("account__code", "account__name")
                .annotate(
                    total_debit=Sum("debit_amount"),
                    total_credit=Sum("credit_amount"),
                )
                .order_by("account__code")
            )
            result = []
            for row in qs:
                d = row["total_debit"] or ZERO
                c = row["total_credit"] or ZERO
                if prefix.startswith("4"):
                    balance = c - d
                else:
                    balance = d - c
                if balance != ZERO:
                    result.append({
                        "code": row["account__code"],
                        "name": row["account__name"],
                        "balance": str(balance),
                    })
            return result

        # ── Cálculos ────────────────────────────────────────────────
        receita_bruta = _sum_group("4.1")
        deducoes = _sum_group("4.2")
        receita_liquida = receita_bruta - deducoes

        custos = _sum_group("5")
        lucro_bruto = receita_liquida - custos

        despesas_op = _sum_group("6")
        resultado_operacional = lucro_bruto - despesas_op

        resultado_financeiro = _sum_group("7")
        resultado_antes_ir = resultado_operacional + resultado_financeiro

        impostos = _sum_group("8")
        resultado_liquido = resultado_antes_ir - impostos

        dre = {
            "periodo": {
                "inicio": str(start_date),
                "fim": str(end_date),
            },
            "receita_bruta": {
                "total": str(receita_bruta),
                "detail": _detail_group("4.1"),
            },
            "deducoes_receita": {
                "total": str(deducoes),
                "detail": _detail_group("4.2"),
            },
            "receita_liquida": str(receita_liquida),
            "custos": {
                "total": str(custos),
                "detail": _detail_group("5"),
            },
            "lucro_bruto": str(lucro_bruto),
            "despesas_operacionais": {
                "total": str(despesas_op),
                "detail": _detail_group("6"),
            },
            "resultado_operacional": str(resultado_operacional),
            "resultado_financeiro": {
                "total": str(resultado_financeiro),
                "detail": _detail_group("7"),
            },
            "resultado_antes_ir": str(resultado_antes_ir),
            "impostos_resultado": {
                "total": str(impostos),
                "detail": _detail_group("8"),
            },
            "resultado_liquido": str(resultado_liquido),
        }

        logger.info(
            "DREService.generate: período %s a %s — resultado líquido R$%s",
            start_date, end_date, resultado_liquido,
        )
        return dre
