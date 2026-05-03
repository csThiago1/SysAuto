"""
Paddock Solutions — Inventory — ContagemService
Abre, registra itens e finaliza contagens de inventario.
"""
import logging
from decimal import Decimal
from uuid import UUID

from django.db import transaction
from django.utils import timezone

from apps.inventory.models_counting import ContagemInventario, ItemContagem
from apps.inventory.models_location import Nivel
from apps.inventory.models_movement import MovimentacaoEstoque
from apps.inventory.models_physical import LoteInsumo, UnidadeFisica

logger = logging.getLogger(__name__)


class ContagemService:
    """Operacoes de contagem de inventario."""

    @staticmethod
    @transaction.atomic
    def abrir_contagem(
        *,
        tipo: str,
        user_id: UUID,
        armazem_id: UUID | None = None,
        rua_id: UUID | None = None,
    ) -> ContagemInventario:
        """Abre nova contagem e pre-popula ItemContagem com quantidade_sistema."""
        contagem = ContagemInventario(
            tipo=tipo,
            status=ContagemInventario.Status.ABERTA,
            armazem_id=armazem_id,
            rua_id=rua_id,
            iniciado_por_id=user_id,
        )
        contagem.save()

        # Determinar quais niveis cobrir
        if tipo == ContagemInventario.Tipo.TOTAL and armazem_id:
            niveis = Nivel.objects.filter(
                prateleira__rua__armazem_id=armazem_id,
                prateleira__rua__is_active=True,
                prateleira__is_active=True,
                is_active=True,
            )
        elif tipo == ContagemInventario.Tipo.CICLICA and rua_id:
            niveis = Nivel.objects.filter(
                prateleira__rua_id=rua_id,
                prateleira__is_active=True,
                is_active=True,
            )
        else:
            niveis = Nivel.objects.none()

        # Gerar itens para unidades fisicas e lotes com saldo
        itens_criados = 0
        for nivel in niveis:
            unidades = UnidadeFisica.objects.filter(
                nivel=nivel,
                is_active=True,
                status__in=[
                    UnidadeFisica.Status.AVAILABLE,
                    UnidadeFisica.Status.RESERVED,
                ],
            )
            for unidade in unidades:
                ItemContagem(
                    contagem=contagem,
                    nivel=nivel,
                    unidade_fisica=unidade,
                    quantidade_sistema=Decimal("1"),
                ).save()
                itens_criados += 1

            lotes = LoteInsumo.objects.filter(
                nivel=nivel,
                is_active=True,
                saldo__gt=0,
            )
            for lote in lotes:
                ItemContagem(
                    contagem=contagem,
                    nivel=nivel,
                    lote_insumo=lote,
                    quantidade_sistema=lote.saldo,
                ).save()
                itens_criados += 1

        logger.info(
            "Contagem %s aberta com %d itens por user %s",
            contagem.pk,
            itens_criados,
            user_id,
        )
        return contagem

    @staticmethod
    def registrar_item(
        *,
        item_id: UUID,
        quantidade_contada: Decimal,
        user_id: UUID,
        observacao: str = "",
    ) -> ItemContagem:
        """Registra quantidade contada para um item."""
        item = ItemContagem.objects.get(pk=item_id)
        item.quantidade_contada = quantidade_contada
        item.contado_por_id = user_id
        item.observacao = observacao
        item.save()  # divergencia computed in save()
        return item

    @staticmethod
    @transaction.atomic
    def finalizar_contagem(
        *,
        contagem_id: UUID,
        user_id: UUID,
    ) -> ContagemInventario:
        """MANAGER+: finaliza contagem e gera ajustes para divergencias."""
        contagem = ContagemInventario.objects.select_for_update().get(
            pk=contagem_id,
            is_active=True,
        )
        if contagem.status == ContagemInventario.Status.FINALIZADA:
            raise ValueError("Contagem ja finalizada.")

        # Gerar MovimentacaoEstoque(AJUSTE_INVENTARIO) para cada divergencia != 0
        itens_divergentes = contagem.itens.exclude(
            divergencia=Decimal("0"),
        ).exclude(
            quantidade_contada__isnull=True,
        )
        count_ajustes = 0
        for item in itens_divergentes:
            MovimentacaoEstoque(
                tipo=MovimentacaoEstoque.Tipo.AJUSTE_INVENTARIO,
                unidade_fisica=item.unidade_fisica,
                lote_insumo=item.lote_insumo,
                quantidade=abs(item.divergencia),
                nivel_origem=item.nivel if item.divergencia < 0 else None,
                nivel_destino=item.nivel if item.divergencia > 0 else None,
                motivo=(
                    f"Ajuste contagem #{contagem.pk}: "
                    f"divergencia {item.divergencia}"
                ),
                realizado_por_id=user_id,
            ).save()
            count_ajustes += 1

        # Atualizar contagem
        ContagemInventario.objects.filter(pk=contagem.pk).update(
            status=ContagemInventario.Status.FINALIZADA,
            data_fechamento=timezone.now(),
            fechado_por_id=user_id,
        )

        contagem.refresh_from_db()
        logger.info(
            "Contagem %s finalizada: %d divergencias por user %s",
            contagem.pk,
            count_ajustes,
            user_id,
        )
        return contagem

    @staticmethod
    @transaction.atomic
    def cancelar_contagem(
        *,
        contagem_id: UUID,
        user_id: UUID,
        motivo: str = "",
    ) -> ContagemInventario:
        """Cancela uma contagem aberta/em andamento."""
        contagem = ContagemInventario.objects.select_for_update().get(
            pk=contagem_id,
            is_active=True,
        )
        if contagem.status == ContagemInventario.Status.FINALIZADA:
            raise ValueError(
                "Contagem ja finalizada, nao pode ser cancelada."
            )

        ContagemInventario.objects.filter(pk=contagem.pk).update(
            status=ContagemInventario.Status.CANCELADA,
            data_fechamento=timezone.now(),
            fechado_por_id=user_id,
        )

        contagem.refresh_from_db()
        logger.info(
            "Contagem %s cancelada por user %s: %s",
            contagem.pk,
            user_id,
            motivo,
        )
        return contagem
