"""
Paddock Solutions — Pricing Engine — DespesaRecorrenteService
Motor de Orçamentos (MO) — Sprint 03: Adapters de Custo

Consulta apps.accounting.DespesaRecorrente e retorna totais vigentes
para o cálculo de rateio de custos fixos por hora produtiva.
"""

import logging
from datetime import date
from decimal import Decimal

from django.db.models import Q, Sum

logger = logging.getLogger(__name__)


class DespesaRecorrenteService:
    """Service de consulta de despesas recorrentes vigentes.

    Isola o motor de precificação da estrutura interna de apps.accounting.
    Sempre filtra por empresa_id — nunca agrega todas as empresas (P4 de MO-3).
    """

    @staticmethod
    def total_vigente(data: date, empresa_id: str) -> Decimal:
        """Soma valor_mensal das despesas recorrentes vigentes na data.

        Uma despesa é vigente em `data` se:
            vigente_desde <= data AND (vigente_ate IS NULL OR vigente_ate >= data)

        Args:
            data: Data de referência para verificar vigência.
            empresa_id: ID da Empresa (pricing_profile.Empresa). Obrigatório — P4.

        Returns:
            Decimal com a soma de valor_mensal. Retorna Decimal("0") se nenhuma
            despesa vigente for encontrada.
        """
        from apps.accounting.models import DespesaRecorrente

        total = (
            DespesaRecorrente.objects.filter(
                empresa_id=empresa_id,
                vigente_desde__lte=data,
                is_active=True,
            )
            .filter(Q(vigente_ate__isnull=True) | Q(vigente_ate__gte=data))
            .aggregate(total=Sum("valor_mensal"))["total"]
        )

        return total or Decimal("0")

    @staticmethod
    def decomposicao_vigente(data: date, empresa_id: str) -> list[dict]:
        """Lista itens de despesa vigentes para auditoria e debug.

        Retorna os registros ordenados por tipo para facilitar conferência
        no endpoint de debug `/pricing/debug/rateio/`.

        Args:
            data: Data de referência para verificar vigência.
            empresa_id: ID da Empresa. Obrigatório — P4.

        Returns:
            Lista de dicts com id, tipo, descricao, valor_mensal.
        """
        from apps.accounting.models import DespesaRecorrente

        qs = (
            DespesaRecorrente.objects.filter(
                empresa_id=empresa_id,
                vigente_desde__lte=data,
                is_active=True,
            )
            .filter(Q(vigente_ate__isnull=True) | Q(vigente_ate__gte=data))
            .order_by("tipo")
        )

        return [
            {
                "id": str(d.id),
                "tipo": d.tipo,
                "descricao": d.descricao,
                "valor_mensal": str(d.valor_mensal),
            }
            for d in qs
        ]
