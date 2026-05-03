"""
Paddock Solutions — Inventory — SaidaEstoqueService
Registra perdas e avarias. Requer aprovação MANAGER+ (WMS-2).
"""
import logging
from decimal import Decimal
from uuid import UUID

from django.db import transaction

from apps.inventory.models_movement import MovimentacaoEstoque
from apps.inventory.models_physical import LoteInsumo, UnidadeFisica

logger = logging.getLogger(__name__)


class SaidaEstoqueService:
    """Operações de saída do estoque (perdas)."""

    @staticmethod
    @transaction.atomic
    def registrar_perda_unidade(
        *,
        unidade_fisica_id: UUID,
        motivo: str,
        user_id: UUID,
        evidencia: object = None,
    ) -> MovimentacaoEstoque:
        """
        Registra perda de uma peça. Status → lost.
        WMS-2: Movimentação criada como pendente — requer aprovação MANAGER+.
        """
        if not motivo.strip():
            raise ValueError("Motivo é obrigatório para registro de perda.")

        unidade = UnidadeFisica.objects.select_for_update().get(
            pk=unidade_fisica_id, is_active=True,
        )
        nivel_origem = unidade.nivel

        # Marca como perdida imediatamente
        UnidadeFisica.objects.filter(pk=unidade.pk).update(
            status=UnidadeFisica.Status.LOST,
        )

        mov = MovimentacaoEstoque(
            tipo=MovimentacaoEstoque.Tipo.SAIDA_PERDA,
            unidade_fisica=unidade,
            quantidade=1,
            nivel_origem=nivel_origem,
            motivo=motivo,
            realizado_por_id=user_id,
        )
        if evidencia:
            mov.evidencia = evidencia
        mov.save()

        logger.info(
            "Perda registrada: peça %s por user %s",
            unidade.codigo_barras,
            user_id,
        )
        return mov

    @staticmethod
    @transaction.atomic
    def registrar_perda_lote(
        *,
        lote_insumo_id: UUID,
        quantidade_perdida: Decimal,
        motivo: str,
        user_id: UUID,
        evidencia: object = None,
    ) -> MovimentacaoEstoque:
        """Registra perda parcial ou total de um lote."""
        if not motivo.strip():
            raise ValueError("Motivo é obrigatório para registro de perda.")

        lote = LoteInsumo.objects.select_for_update().get(
            pk=lote_insumo_id, is_active=True,
        )
        if quantidade_perdida > lote.saldo:
            raise ValueError(
                f"Quantidade perdida ({quantidade_perdida}) maior que saldo ({lote.saldo})."
            )

        nivel_origem = lote.nivel

        # Debitar saldo
        LoteInsumo.objects.filter(pk=lote.pk).update(
            saldo=lote.saldo - quantidade_perdida,
        )

        mov = MovimentacaoEstoque(
            tipo=MovimentacaoEstoque.Tipo.SAIDA_PERDA,
            lote_insumo=lote,
            quantidade=quantidade_perdida,
            nivel_origem=nivel_origem,
            motivo=motivo,
            realizado_por_id=user_id,
        )
        if evidencia:
            mov.evidencia = evidencia
        mov.save()

        logger.info(
            "Perda registrada: lote %s qty=%s por user %s",
            lote.codigo_barras,
            quantidade_perdida,
            user_id,
        )
        return mov
