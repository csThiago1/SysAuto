"""
Paddock Solutions — Pricing Engine — RH Adapter
Motor de Orçamentos (MO) — Sprint 03: Adapters de Custo

Adapter sobre apps.hr — isola o motor do acoplamento direto com RH.
Consulta Employee e Payslip para calcular o custo mensal por categoria
de mão de obra.

Regras críticas:
- Apenas Payslip com is_closed=True entram no cálculo (P5 de MO-3).
- Sempre filtrar por empresa_id (P4 de MO-3): hoje empresa_id é usado para
  filtrar Employee via position, mas não há FK direta. Mantém-se o parâmetro
  para evolução futura e documentação de intenção.
- is_active=True em toda query.
"""

import logging
from datetime import date
from decimal import Decimal

from django.db.models import Sum

logger = logging.getLogger(__name__)


class RHAdapter:
    """Adapter sobre apps.hr — isola o motor do acoplamento direto com RH."""

    @staticmethod
    def total_mensal_categoria(
        categoria_codigo: str,
        data: date,
        empresa_id: str,
    ) -> Decimal | None:
        """Soma gross_pay dos contracheques fechados para colaboradores ativos nessa categoria.

        Considera apenas Payslip com is_closed=True (folha aberta não conta — P5).
        Retorna None se não há colaboradores ativos para a categoria (indica que
        CustoHoraService deve tentar o fallback).

        Args:
            categoria_codigo: Código da CategoriaMaoObra (ex: "funileiro", "pintor").
            data: Data de referência. O mês é calculado como o 1º dia do mês de data.
            empresa_id: ID da Empresa (pricing_profile). Nunca agregar todas — P4.

        Returns:
            Decimal com a soma de gross_pay, ou None se sem colaboradores ativos.
        """
        from apps.hr.models import Employee, Payslip
        from apps.pricing_engine.constants import MAPEAMENTO_CATEGORIA_POSITION

        positions = MAPEAMENTO_CATEGORIA_POSITION.get(categoria_codigo, [])
        if not positions:
            logger.debug(
                "RHAdapter: categoria '%s' sem mapeamento de position — retorna None",
                categoria_codigo,
            )
            return None

        ref = data.replace(day=1)

        employees = Employee.objects.filter(
            position__in=positions,
            status="active",
            hire_date__lte=data,
            is_active=True,
        )

        if not employees.exists():
            logger.debug(
                "RHAdapter: nenhum Employee ativo para categoria='%s' em %s",
                categoria_codigo,
                data,
            )
            return None

        agg = Payslip.objects.filter(
            employee__in=employees,
            reference_month=ref,
            is_closed=True,
            is_active=True,
        ).aggregate(total=Sum("gross_pay"))

        total = agg["total"]
        if total is None:
            logger.debug(
                "RHAdapter: sem Payslip fechado para categoria='%s' ref=%s — retorna Decimal(0)",
                categoria_codigo,
                ref,
            )
            return Decimal("0")

        return total

    @staticmethod
    def qtd_funcionarios_categoria(
        categoria_codigo: str,
        data: date,
        empresa_id: str,
    ) -> int:
        """Conta colaboradores ativos para a categoria na data.

        Args:
            categoria_codigo: Código da CategoriaMaoObra.
            data: Data de referência (filtra hire_date <= data).
            empresa_id: ID da Empresa (reservado para filtro futuro — P4).

        Returns:
            Quantidade de colaboradores ativos (int, nunca negativo).
        """
        from apps.hr.models import Employee
        from apps.pricing_engine.constants import MAPEAMENTO_CATEGORIA_POSITION

        positions = MAPEAMENTO_CATEGORIA_POSITION.get(categoria_codigo, [])
        if not positions:
            return 0

        return Employee.objects.filter(
            position__in=positions,
            status="active",
            hire_date__lte=data,
            is_active=True,
        ).count()
