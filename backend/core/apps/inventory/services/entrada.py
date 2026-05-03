"""
Paddock Solutions — Inventory — EntradaEstoqueService
Entrada manual de peças e lotes, devolução de peças.
Toda entrada cria MovimentacaoEstoque correspondente.
"""
import logging
from decimal import Decimal
from uuid import UUID

from django.db import transaction

from apps.inventory.models_location import Nivel
from apps.inventory.models_movement import MovimentacaoEstoque
from apps.inventory.models_physical import LoteInsumo, UnidadeFisica

logger = logging.getLogger(__name__)


class EntradaEstoqueService:
    """Operações de entrada de estoque."""

    @staticmethod
    @transaction.atomic
    def entrada_manual_peca(
        *,
        peca_canonica_id: UUID | None,
        valor_nf: Decimal,
        nivel_id: UUID,
        user_id: UUID,
        motivo: str,
        produto_peca_id: UUID | None = None,
        numero_serie: str = "",
    ) -> UnidadeFisica:
        """Cria UnidadeFisica + MovimentacaoEstoque(ENTRADA_MANUAL)."""
        nivel = Nivel.objects.get(pk=nivel_id, is_active=True)

        unidade = UnidadeFisica(
            peca_canonica_id=peca_canonica_id,
            valor_nf=valor_nf,
            nivel=nivel,
            status=UnidadeFisica.Status.AVAILABLE,
            created_by_id=user_id,
            numero_serie=numero_serie,
        )
        if produto_peca_id:
            unidade.produto_peca_id = produto_peca_id
        unidade.save()

        MovimentacaoEstoque(
            tipo=MovimentacaoEstoque.Tipo.ENTRADA_MANUAL,
            unidade_fisica=unidade,
            quantidade=1,
            nivel_destino=nivel,
            motivo=motivo,
            realizado_por_id=user_id,
        ).save()

        logger.info(
            "Entrada manual peça %s no nível %s por user %s",
            unidade.codigo_barras, nivel, user_id,
        )
        return unidade

    @staticmethod
    @transaction.atomic
    def entrada_manual_lote(
        *,
        material_canonico_id: UUID | None,
        quantidade_compra: Decimal,
        unidade_compra: str,
        fator_conversao: Decimal,
        valor_total_nf: Decimal,
        nivel_id: UUID,
        user_id: UUID,
        motivo: str,
        produto_insumo_id: UUID | None = None,
        validade: str | None = None,
    ) -> LoteInsumo:
        """Cria LoteInsumo + MovimentacaoEstoque(ENTRADA_MANUAL)."""
        nivel = Nivel.objects.get(pk=nivel_id, is_active=True)
        quantidade_base = quantidade_compra * fator_conversao

        lote = LoteInsumo(
            material_canonico_id=material_canonico_id,
            unidade_compra=unidade_compra,
            quantidade_compra=quantidade_compra,
            fator_conversao=fator_conversao,
            quantidade_base=quantidade_base,
            saldo=quantidade_base,
            valor_total_nf=valor_total_nf,
            valor_unitario_base=Decimal("0"),  # Calculated in save()
            nivel=nivel,
            created_by_id=user_id,
        )
        if produto_insumo_id:
            lote.produto_insumo_id = produto_insumo_id
        if validade:
            lote.validade = validade
        lote.save()

        MovimentacaoEstoque(
            tipo=MovimentacaoEstoque.Tipo.ENTRADA_MANUAL,
            lote_insumo=lote,
            quantidade=quantidade_base,
            nivel_destino=nivel,
            motivo=motivo,
            realizado_por_id=user_id,
        ).save()

        logger.info(
            "Entrada manual lote %s no nível %s por user %s",
            lote.codigo_barras, nivel, user_id,
        )
        return lote

    @staticmethod
    @transaction.atomic
    def registrar_devolucao(
        *,
        unidade_fisica_id: UUID,
        nivel_destino_id: UUID,
        user_id: UUID,
        motivo: str,
    ) -> MovimentacaoEstoque:
        """Devolução: consumed -> available, atribui nivel_destino."""
        unidade = UnidadeFisica.objects.select_for_update().get(
            pk=unidade_fisica_id, is_active=True,
        )
        if unidade.status != UnidadeFisica.Status.CONSUMED:
            raise ValueError(
                f"Só é possível devolver peça com status 'consumed'. "
                f"Status atual: {unidade.status}"
            )

        nivel_destino = Nivel.objects.get(pk=nivel_destino_id, is_active=True)
        os_origem = unidade.ordem_servico

        # Atualizar status
        UnidadeFisica.objects.filter(pk=unidade.pk).update(
            status=UnidadeFisica.Status.AVAILABLE,
            nivel=nivel_destino,
            ordem_servico=None,
            consumida_em=None,
        )

        mov = MovimentacaoEstoque(
            tipo=MovimentacaoEstoque.Tipo.ENTRADA_DEVOLUCAO,
            unidade_fisica=unidade,
            quantidade=1,
            nivel_destino=nivel_destino,
            ordem_servico=os_origem,
            motivo=motivo,
            realizado_por_id=user_id,
        )
        mov.save()

        logger.info(
            "Devolução peça %s para nível %s por user %s",
            unidade.codigo_barras, nivel_destino, user_id,
        )
        return mov
