"""
Paddock Solutions — Inventory — MovimentacaoService
Consulta de historico de movimentacoes (read-only).
"""
import logging
from datetime import date
from typing import Any
from uuid import UUID

from django.db.models import Count, Q, QuerySet

from apps.inventory.models_movement import MovimentacaoEstoque

logger = logging.getLogger(__name__)


class MovimentacaoService:
    """Consultas sobre historico de movimentacoes."""

    @staticmethod
    def historico_item(
        *,
        unidade_fisica_id: UUID | None = None,
        lote_insumo_id: UUID | None = None,
    ) -> QuerySet[MovimentacaoEstoque]:
        """Timeline de movimentacoes de um item especifico."""
        qs = MovimentacaoEstoque.objects.filter(is_active=True)
        if unidade_fisica_id:
            qs = qs.filter(unidade_fisica_id=unidade_fisica_id)
        elif lote_insumo_id:
            qs = qs.filter(lote_insumo_id=lote_insumo_id)
        else:
            return MovimentacaoEstoque.objects.none()
        return qs.select_related(
            "nivel_origem",
            "nivel_destino",
            "realizado_por",
            "aprovado_por",
        ).order_by("-created_at")

    @staticmethod
    def historico_posicao(nivel_id: UUID) -> QuerySet[MovimentacaoEstoque]:
        """Movimentacoes que tiveram um nivel como origem ou destino."""
        return (
            MovimentacaoEstoque.objects.filter(
                is_active=True,
            )
            .filter(
                Q(nivel_origem_id=nivel_id) | Q(nivel_destino_id=nivel_id)
            )
            .select_related(
                "unidade_fisica",
                "lote_insumo",
                "realizado_por",
            )
            .order_by("-created_at")
        )

    @staticmethod
    def historico_os(ordem_servico_id: UUID) -> QuerySet[MovimentacaoEstoque]:
        """Movimentacoes vinculadas a uma OS."""
        return (
            MovimentacaoEstoque.objects.filter(
                is_active=True,
                ordem_servico_id=ordem_servico_id,
            )
            .select_related(
                "unidade_fisica",
                "lote_insumo",
                "nivel_origem",
                "nivel_destino",
                "realizado_por",
            )
            .order_by("-created_at")
        )

    @staticmethod
    def resumo_periodo(
        data_inicio: date, data_fim: date
    ) -> dict[str, Any]:
        """KPIs de movimentacao por tipo num periodo."""
        qs = MovimentacaoEstoque.objects.filter(
            is_active=True,
            created_at__date__gte=data_inicio,
            created_at__date__lte=data_fim,
        )
        totais = (
            qs.values("tipo").annotate(count=Count("id")).order_by("tipo")
        )
        return {
            "periodo": {
                "inicio": str(data_inicio),
                "fim": str(data_fim),
            },
            "por_tipo": {
                item["tipo"]: item["count"] for item in totais
            },
            "total": qs.count(),
        }
