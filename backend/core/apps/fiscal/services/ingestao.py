"""
Paddock Solutions — Fiscal — NFeIngestaoService
Motor de Orçamentos (MO) — Sprint MO-5: Estoque Físico + NF-e Entrada

Cria UnidadeFisica (peças) e LoteInsumo (insumos) a partir de NFeEntradaItem
já reconciliados com o catálogo canônico.

P10: idempotência via NFeEntrada.estoque_gerado — nunca duplicar.
P1:  sempre usar item.valor_unitario_com_tributos, nunca valor_unitario_bruto.
"""

import logging
from datetime import date
from decimal import Decimal

from django.db import transaction

logger = logging.getLogger(__name__)


class EstoqueJaGerado(Exception):
    """Levantada quando NFeEntrada.estoque_gerado já é True."""


class NFeIngestaoService:
    """Cria registros de estoque físico a partir de uma NF-e de entrada validada."""

    @staticmethod
    def criar_registros_estoque(
        nfe_id: str, realizado_por_id: str | None = None
    ) -> dict:
        """
        Processa todos os itens da NF-e e cria UnidadeFisica / LoteInsumo.

        Para cada registro criado, gera um MovimentacaoEstoque(ENTRADA_NF)
        como audit trail — requer ``realizado_por_id`` (WMS-3).

        Args:
            nfe_id: UUID da NFeEntrada.
            realizado_por_id: UUID do GlobalUser que disparou a ação.
                Se omitido, MovimentacaoEstoque NÃO é criada (warning no log).

        Returns:
            dict com unidades_criadas, lotes_criados, pendentes_reconciliacao.

        Raises:
            EstoqueJaGerado: se nfe.estoque_gerado já é True (P10).
        """
        # Importações tardias para evitar circular import
        from apps.fiscal.models import NFeEntrada
        from apps.inventory.models import LoteInsumo, UnidadeFisica
        from apps.inventory.models_movement import MovimentacaoEstoque

        if not realizado_por_id:
            logger.warning(
                "criar_registros_estoque chamado sem realizado_por_id — "
                "MovimentacaoEstoque não será criada para NF-e %s.",
                nfe_id,
            )

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
                        if realizado_por_id:
                            MovimentacaoEstoque(
                                tipo=MovimentacaoEstoque.Tipo.ENTRADA_NF,
                                unidade_fisica=u,
                                quantidade=1,
                                nivel_destino=u.nivel,
                                nfe_entrada=nfe,
                                realizado_por_id=realizado_por_id,
                            ).save()

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
                    if realizado_por_id:
                        MovimentacaoEstoque(
                            tipo=MovimentacaoEstoque.Tipo.ENTRADA_NF,
                            lote_insumo=l,
                            quantidade=quantidade_base,
                            nivel_destino=l.nivel,
                            nfe_entrada=nfe,
                            realizado_por_id=realizado_por_id,
                        ).save()

                else:
                    pendentes.append(str(item.pk))

            # Marcar NF-e como estoque gerado
            nfe.estoque_gerado = True
            nfe.status = NFeEntrada.Status.ESTOQUE_GERADO
            nfe.save(update_fields=["estoque_gerado", "status"])

        # ── S4: Auto-create Conta a Pagar ─────────────────────────────────
        if not nfe.payable_document_id:
            try:
                from apps.accounts_payable.models import Supplier
                from apps.accounts_payable.services import PayableDocumentService
                from apps.authentication.models import GlobalUser
                from datetime import timedelta

                # Resolve user object (required by PayableDocumentService.create_payable)
                realizado_por = None
                if realizado_por_id:
                    try:
                        realizado_por = GlobalUser.objects.get(pk=realizado_por_id)
                    except GlobalUser.DoesNotExist:
                        pass

                # Get or create supplier by CNPJ (cnpj not unique in DB — use filter/first)
                supplier = Supplier.objects.filter(cnpj=nfe.emitente_cnpj).first()
                if supplier is None:
                    supplier = Supplier.objects.create(
                        cnpj=nfe.emitente_cnpj,
                        name=nfe.emitente_nome or nfe.emitente_cnpj,
                    )

                emissao_date = nfe.data_emissao if nfe.data_emissao else date.today()
                payable = PayableDocumentService.create_payable(
                    supplier_id=str(supplier.pk),
                    description=f"NF-e {nfe.numero}/{nfe.serie} — {nfe.emitente_nome}",
                    amount=nfe.valor_total,
                    due_date=emissao_date + timedelta(days=30),
                    competence_date=emissao_date,
                    origin="NFE_E",
                    document_number=nfe.chave_acesso[-8:] if nfe.chave_acesso else (nfe.numero or ""),
                    user=realizado_por,
                )
                nfe.payable_document = payable
                nfe.save(update_fields=["payable_document"])
                logger.info(
                    "Auto-AP created for NFeEntrada %s: AP %s", nfe.pk, payable.pk
                )
            except Exception as e:
                logger.warning(
                    "Auto-AP creation failed for NFeEntrada %s: %s", nfe.pk, e
                )

        # ── S4: Auto-match with Purchase Order ────────────────────────────
        if not nfe.purchase_order_id and nfe.emitente_cnpj:
            try:
                from apps.fiscal.services.matching import PurchaseOrderMatchingService

                matches = PurchaseOrderMatchingService.find_matches(nfe)
                if len(matches) == 1:
                    # Auto-link only if exactly one match (avoids ambiguity)
                    PurchaseOrderMatchingService.link(nfe, str(matches[0].pk))
            except Exception as e:
                logger.warning(
                    "Auto PO matching failed for NFeEntrada %s: %s", nfe.pk, e
                )

        logger.info(
            "NF-e %s/%s: %d unidades, %d lotes, %d pendentes",
            nfe.numero,
            nfe.serie,
            len(unidades),
            len(lotes),
            len(pendentes),
        )
        return {
            "unidades_criadas": len(unidades),
            "lotes_criados": len(lotes),
            "pendentes_reconciliacao": pendentes,
        }
