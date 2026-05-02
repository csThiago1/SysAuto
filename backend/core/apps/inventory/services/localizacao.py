"""
Paddock Solutions — Inventory — LocalizacaoService
Operações de localização: mover itens, consultar ocupação.
"""
import logging
from typing import Any
from uuid import UUID

from django.db import transaction

from apps.inventory.models_location import Armazem, Nivel, Rua
from apps.inventory.models_movement import MovimentacaoEstoque
from apps.inventory.models_physical import LoteInsumo, UnidadeFisica

logger = logging.getLogger(__name__)


class LocalizacaoService:
    """Operações sobre hierarquia de localização."""

    @staticmethod
    def endereco_completo(nivel: Nivel) -> str:
        """WMS-4: computed, nunca stored."""
        return nivel.endereco_completo

    @staticmethod
    @transaction.atomic
    def mover_unidade(
        unidade_fisica_id: UUID,
        nivel_destino_id: UUID,
        user_id: UUID,
    ) -> MovimentacaoEstoque:
        """Move uma UnidadeFisica para outra posição. Cria MovimentacaoEstoque(TRANSFERENCIA)."""
        unidade = UnidadeFisica.objects.select_for_update().get(
            pk=unidade_fisica_id, is_active=True,
        )
        nivel_destino = Nivel.objects.get(pk=nivel_destino_id, is_active=True)
        nivel_origem = unidade.nivel

        UnidadeFisica.objects.filter(pk=unidade.pk).update(nivel=nivel_destino)

        mov = MovimentacaoEstoque(
            tipo=MovimentacaoEstoque.Tipo.TRANSFERENCIA,
            unidade_fisica=unidade,
            quantidade=1,
            nivel_origem=nivel_origem,
            nivel_destino=nivel_destino,
            realizado_por_id=user_id,
        )
        mov.save()
        logger.info(
            "Unidade %s movida para %s por user %s",
            unidade.codigo_barras, nivel_destino, user_id,
        )
        return mov

    @staticmethod
    @transaction.atomic
    def mover_lote(
        lote_insumo_id: UUID,
        nivel_destino_id: UUID,
        user_id: UUID,
    ) -> MovimentacaoEstoque:
        """Move um LoteInsumo para outra posição."""
        lote = LoteInsumo.objects.select_for_update().get(
            pk=lote_insumo_id, is_active=True,
        )
        nivel_destino = Nivel.objects.get(pk=nivel_destino_id, is_active=True)
        nivel_origem = lote.nivel

        LoteInsumo.objects.filter(pk=lote.pk).update(nivel=nivel_destino)

        mov = MovimentacaoEstoque(
            tipo=MovimentacaoEstoque.Tipo.TRANSFERENCIA,
            lote_insumo=lote,
            quantidade=lote.saldo,
            nivel_origem=nivel_origem,
            nivel_destino=nivel_destino,
            realizado_por_id=user_id,
        )
        mov.save()
        logger.info(
            "Lote %s movido para %s por user %s",
            lote.codigo_barras, nivel_destino, user_id,
        )
        return mov

    @staticmethod
    def ocupacao_nivel(nivel_id: UUID) -> dict[str, Any]:
        """Retorna conteúdo de um nível."""
        unidades = UnidadeFisica.objects.filter(
            nivel_id=nivel_id, is_active=True,
        ).values("id", "codigo_barras", "peca_canonica_id", "status")
        lotes = LoteInsumo.objects.filter(
            nivel_id=nivel_id, is_active=True, saldo__gt=0,
        ).values("id", "codigo_barras", "material_canonico_id", "saldo")
        return {
            "total_unidades": unidades.count(),
            "total_lotes": lotes.count(),
            "unidades": list(unidades),
            "lotes": list(lotes),
        }

    @staticmethod
    def ocupacao_armazem(armazem_id: UUID) -> list[dict[str, Any]]:
        """Resumo de ocupação por rua de um armazém."""
        ruas = Rua.objects.filter(
            armazem_id=armazem_id, is_active=True,
        ).order_by("ordem", "codigo")

        resultado = []
        for rua in ruas:
            nivel_ids = Nivel.objects.filter(
                prateleira__rua=rua,
                prateleira__is_active=True,
                is_active=True,
            ).values_list("id", flat=True)

            total_unidades = UnidadeFisica.objects.filter(
                nivel_id__in=nivel_ids, is_active=True,
            ).count()
            total_lotes = LoteInsumo.objects.filter(
                nivel_id__in=nivel_ids, is_active=True, saldo__gt=0,
            ).count()
            total_niveis = len(nivel_ids)

            resultado.append({
                "rua_id": str(rua.id),
                "rua_codigo": rua.codigo,
                "descricao": rua.descricao,
                "total_niveis": total_niveis,
                "total_unidades": total_unidades,
                "total_lotes": total_lotes,
            })
        return resultado
