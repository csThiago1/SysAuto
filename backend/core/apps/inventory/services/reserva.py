"""
Paddock Solutions — Inventory — ReservaUnidadeService + BaixaInsumoService
Motor de Orçamentos (MO) — Sprint MO-5: Estoque Físico + NF-e Entrada

ReservaUnidadeService: reserva N unidades de uma peça para uma OS.
BaixaInsumoService: consome insumo de lotes por FIFO (criado_em ASC).

P5: select_for_update(skip_locked=True) — concorrência sem deadlock.
P6: A6 — forcar_mais_caro é escape hatch para situações raras (ADMIN+, auditoria obrigatória).
"""
import logging
from decimal import Decimal

from django.db import transaction

logger = logging.getLogger(__name__)


class ReservaIndisponivel(Exception):
    """Levantada quando não há unidades/saldo suficiente para a operação."""


class ReservaUnidadeService:
    """Reserva unidades físicas de peça para uma OS."""

    @staticmethod
    def reservar(
        peca_canonica_id: str,
        quantidade: int,
        ordem_servico_id: str,
        forcar_mais_caro: bool = False,
        user_id: str | None = None,
    ) -> list:
        """
        Reserva N unidades de uma peça canônica para a OS.

        Por padrão: ordena valor_nf ASC (consome as mais baratas primeiro).
        forcar_mais_caro=True → DESC (A6: escape hatch — ADMIN+ com auditoria).

        Args:
            peca_canonica_id: UUID da PecaCanonica.
            quantidade: número de unidades a reservar.
            ordem_servico_id: UUID da ServiceOrder.
            forcar_mais_caro: se True, reserva unidades mais caras primeiro (A6).
            user_id: UUID do usuário (para auditoria de forcar_mais_caro).

        Returns:
            Lista de UnidadeFisica reservadas.

        Raises:
            ReservaIndisponivel: se não há unidades suficientes disponíveis.
        """
        from apps.inventory.models import UnidadeFisica

        # P7: log obrigatório para forcar_mais_caro
        if forcar_mais_caro:
            logger.warning(
                "forcar_mais_caro=True: peca=%s os=%s user=%s",
                peca_canonica_id, ordem_servico_id, user_id,
            )

        ordem = "-valor_nf" if forcar_mais_caro else "valor_nf"

        with transaction.atomic():
            # P5: skip_locked — segundo operador pega próxima unidade, não bloqueia
            disponiveis = list(
                UnidadeFisica.objects
                .select_for_update(skip_locked=True)
                .filter(peca_canonica_id=peca_canonica_id, status="available")
                .order_by(ordem)[:quantidade]
            )

            if len(disponiveis) < quantidade:
                raise ReservaIndisponivel(
                    f"Pedidas {quantidade} unidades de peça {peca_canonica_id}, "
                    f"disponíveis {len(disponiveis)}."
                )

            for u in disponiveis:
                u.status = "reserved"
                u.ordem_servico_id = ordem_servico_id
                u.save(update_fields=["status", "ordem_servico_id"])

        return disponiveis

    @staticmethod
    def liberar(unidade_fisica_id: str) -> None:
        """Libera uma unidade reservada de volta para available."""
        from apps.inventory.models import UnidadeFisica

        with transaction.atomic():
            u = UnidadeFisica.objects.select_for_update().get(
                pk=unidade_fisica_id, status="reserved"
            )
            u.status = "available"
            u.ordem_servico_id = None
            u.save(update_fields=["status", "ordem_servico_id"])

    @staticmethod
    def baixar_por_bipagem(codigo_barras: str, ordem_servico_id: str) -> object:
        """
        Resolve codigo_barras → UnidadeFisica e reserva para a OS.
        Usado na tela de bipagem.
        """
        from apps.inventory.models import UnidadeFisica

        with transaction.atomic():
            try:
                u = UnidadeFisica.objects.select_for_update(skip_locked=True).get(
                    codigo_barras=codigo_barras, status="available"
                )
            except UnidadeFisica.DoesNotExist:
                raise ReservaIndisponivel(
                    f"Código {codigo_barras} não encontrado ou não disponível."
                )
            u.status = "reserved"
            u.ordem_servico_id = ordem_servico_id
            u.save(update_fields=["status", "ordem_servico_id"])
        return u


class BaixaInsumoService:
    """Consome insumo de lotes por FIFO (criado_em ASC)."""

    @staticmethod
    def baixar(
        material_canonico_id: str,
        quantidade_base: Decimal,
        ordem_servico_id: str,
        user_id: str | None = None,
    ) -> list:
        """
        FIFO: consome lotes por criado_em ASC até zerar quantidade_base.

        Args:
            material_canonico_id: UUID do MaterialCanonico.
            quantidade_base: quantidade em unidade_base a consumir.
            ordem_servico_id: UUID da ServiceOrder.
            user_id: UUID do usuário para auditoria.

        Returns:
            Lista de ConsumoInsumo criados.

        Raises:
            ReservaIndisponivel: se saldo total insuficiente.
        """
        from apps.inventory.models import ConsumoInsumo, LoteInsumo

        restante = Decimal(str(quantidade_base))
        consumos: list = []

        with transaction.atomic():
            # P5: skip_locked — concorrência sem deadlock
            lotes = list(
                LoteInsumo.objects
                .select_for_update(skip_locked=True)
                .filter(material_canonico_id=material_canonico_id, saldo__gt=0)
                .order_by("created_at")  # FIFO
            )

            for lote in lotes:
                if restante <= 0:
                    break
                consome = min(lote.saldo, restante)
                c = ConsumoInsumo.objects.create(
                    lote=lote,
                    ordem_servico_id=ordem_servico_id,
                    quantidade_base=consome,
                    # P8: snapshot imutável do custo no momento da baixa
                    valor_unitario_na_baixa=lote.valor_unitario_base,
                    criado_por_id=user_id,
                )
                lote.saldo -= consome
                lote.save(update_fields=["saldo"])
                consumos.append(c)
                restante -= consome

            if restante > 0:
                raise ReservaIndisponivel(
                    f"Material {material_canonico_id}: pedido {quantidade_base}, "
                    f"insuficiente — faltam {restante} em unidade_base."
                )

        return consumos
