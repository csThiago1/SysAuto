"""
Paddock Solutions — Inventory — AprovacaoEstoqueService
Fluxo de aprovacao para perdas e ajustes (WMS-2: MANAGER+ obrigatorio).
"""
import logging
from uuid import UUID

from django.db import transaction
from django.db.models import F, QuerySet
from django.utils import timezone

from apps.inventory.models_movement import MovimentacaoEstoque

logger = logging.getLogger(__name__)


class AprovacaoEstoqueService:
    """Aprovacao/rejeicao de movimentacoes que requerem MANAGER+."""

    @staticmethod
    def pendentes() -> QuerySet[MovimentacaoEstoque]:
        """Lista movimentacoes pendentes de aprovacao (PERDA e AJUSTE sem aprovado_por)."""
        return (
            MovimentacaoEstoque.objects.filter(
                is_active=True,
                tipo__in=[
                    MovimentacaoEstoque.Tipo.SAIDA_PERDA,
                    MovimentacaoEstoque.Tipo.AJUSTE_INVENTARIO,
                ],
                aprovado_por__isnull=True,
            )
            .select_related(
                "unidade_fisica",
                "lote_insumo",
                "realizado_por",
                "nivel_origem",
                "nivel_destino",
            )
            .order_by("-created_at")
        )

    @staticmethod
    @transaction.atomic
    def aprovar(movimentacao_id: UUID, user_id: UUID) -> MovimentacaoEstoque:
        """MANAGER+: aprova uma movimentacao pendente."""
        mov = MovimentacaoEstoque.objects.select_for_update().get(
            pk=movimentacao_id,
            is_active=True,
        )
        if mov.aprovado_por_id is not None:
            raise ValueError("Movimentacao ja aprovada.")

        MovimentacaoEstoque.objects.filter(pk=mov.pk).update(
            aprovado_por_id=user_id,
            aprovado_em=timezone.now(),
        )
        logger.info(
            "Movimentacao %s aprovada por user %s", mov.pk, user_id
        )

        mov.refresh_from_db()
        return mov

    @staticmethod
    @transaction.atomic
    def rejeitar(movimentacao_id: UUID, user_id: UUID, motivo: str) -> None:
        """MANAGER+: rejeita uma movimentacao pendente (soft delete + reversao)."""
        mov = MovimentacaoEstoque.objects.select_for_update().get(
            pk=movimentacao_id,
            is_active=True,
        )
        if mov.aprovado_por_id is not None:
            raise ValueError(
                "Movimentacao ja aprovada, nao pode ser rejeitada."
            )

        # Reverter o efeito da movimentacao
        if mov.tipo == MovimentacaoEstoque.Tipo.SAIDA_PERDA:
            if mov.unidade_fisica_id:
                from apps.inventory.models_physical import UnidadeFisica

                UnidadeFisica.objects.filter(pk=mov.unidade_fisica_id).update(
                    status=UnidadeFisica.Status.AVAILABLE,
                )
            elif mov.lote_insumo_id:
                from apps.inventory.models_physical import LoteInsumo

                LoteInsumo.objects.filter(pk=mov.lote_insumo_id).update(
                    saldo=F("saldo") + mov.quantidade,
                )

        # Soft delete da movimentacao
        MovimentacaoEstoque.objects.filter(pk=mov.pk).update(is_active=False)
        logger.info(
            "Movimentacao %s rejeitada por user %s: %s",
            mov.pk,
            user_id,
            motivo,
        )
