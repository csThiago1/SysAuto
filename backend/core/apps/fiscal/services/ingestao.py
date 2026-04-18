"""
Paddock Solutions — Fiscal — NFeIngestaoService
Motor de Orçamentos (MO) — Sprint MO-5: Estoque Físico + NF-e Entrada

Cria UnidadeFisica (peças) e LoteInsumo (insumos) a partir de NFeEntradaItem
já reconciliados com o catálogo canônico.

P10: idempotência via NFeEntrada.estoque_gerado — nunca duplicar.
P1:  sempre usar item.valor_unitario_com_tributos, nunca valor_unitario_bruto.
"""
import logging
from decimal import Decimal

from django.db import transaction

logger = logging.getLogger(__name__)


class EstoqueJaGerado(Exception):
    """Levantada quando NFeEntrada.estoque_gerado já é True."""


class NFeIngestaoService:
    """Cria registros de estoque físico a partir de uma NF-e de entrada validada."""

    @staticmethod
    def criar_registros_estoque(nfe_id: str) -> dict:
        """
        Processa todos os itens da NF-e e cria UnidadeFisica / LoteInsumo.

        Args:
            nfe_id: UUID da NFeEntrada.

        Returns:
            dict com unidades_criadas, lotes_criados, pendentes_reconciliacao.

        Raises:
            EstoqueJaGerado: se nfe.estoque_gerado já é True (P10).
        """
        # Importações tardias para evitar circular import
        from apps.fiscal.models import NFeEntrada
        from apps.inventory.models import LoteInsumo, UnidadeFisica

        with transaction.atomic():
            nfe = NFeEntrada.objects.select_for_update().get(pk=nfe_id)

            # P10: idempotência — nunca duplicar
            if nfe.estoque_gerado:
                raise EstoqueJaGerado(
                    f"NF-e {nfe.numero}/{nfe.serie} já gerou estoque anteriormente."
                )

            unidades: list = []
            lotes: list = []
            pendentes: list = []

            for item in nfe.itens.select_related(
                "peca_canonica", "material_canonico", "codigo_fornecedor"
            ).all():
                if item.peca_canonica_id:
                    # Peça: cada unidade é um item físico individual
                    qtd_inteira = int(item.quantidade)
                    for _ in range(qtd_inteira):
                        u = UnidadeFisica.objects.create(
                            peca_canonica_id=item.peca_canonica_id,
                            codigo_fornecedor_id=item.codigo_fornecedor_id,
                            nfe_entrada_id=nfe_id,
                            # P1: valor COM tributação
                            valor_nf=item.valor_unitario_com_tributos,
                            status="available",
                        )
                        unidades.append(u.pk)

                elif item.material_canonico_id:
                    # Insumo: um lote com quantidade_base = quantidade × fator_conversao
                    quantidade_base = item.quantidade * item.fator_conversao
                    l = LoteInsumo.objects.create(
                        material_canonico_id=item.material_canonico_id,
                        nfe_entrada_id=nfe_id,
                        unidade_compra=item.unidade_compra,
                        quantidade_compra=item.quantidade,
                        fator_conversao=item.fator_conversao,
                        quantidade_base=quantidade_base,
                        saldo=quantidade_base,
                        # P1: valor COM tributação
                        valor_total_nf=item.valor_total_com_tributos,
                        # valor_unitario_base calculado automaticamente no save()
                        valor_unitario_base=Decimal("0"),  # placeholder, save() recalcula
                    )
                    lotes.append(l.pk)

                else:
                    pendentes.append(str(item.pk))

            # Marcar NF-e como estoque gerado
            nfe.estoque_gerado = True
            nfe.status = NFeEntrada.Status.ESTOQUE_GERADO
            nfe.save(update_fields=["estoque_gerado", "status"])

        logger.info(
            "NF-e %s/%s: %d unidades, %d lotes, %d pendentes",
            nfe.numero, nfe.serie, len(unidades), len(lotes), len(pendentes),
        )
        return {
            "unidades_criadas": len(unidades),
            "lotes_criados": len(lotes),
            "pendentes_reconciliacao": pendentes,
        }
