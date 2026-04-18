"""
Paddock Solutions — Inventory — ZPLService
Motor de Orçamentos (MO) — Sprint MO-5: Estoque Físico + NF-e Entrada

Geração e envio de etiquetas ZPL para impressoras Zebra/Argox/Elgin.
P6: impressão SEMPRE via Celery — nunca direto no viewset.
P9: endpoint pode ser IP interno da LAN (ex: http://10.0.0.15:9100).
"""
import logging

import httpx

logger = logging.getLogger(__name__)

ZPL_TEMPLATE_PECA = """\
^XA
^FO20,20^A0N,24,24^FD{nome_peca}^FS
^FO20,60^A0N,20,20^FDCod: {codigo_barras}^FS
^FO20,90^BY2^BCN,60,Y,N,N^FD{codigo_barras}^FS
^FO20,170^A0N,18,18^FDNF {nfe_numero} · R$ {valor_nf}^FS
^XZ"""

ZPL_TEMPLATE_LOTE = """\
^XA
^FO20,20^A0N,24,24^FD{nome_material}^FS
^FO20,60^A0N,20,20^FDLote: {codigo_barras}^FS
^FO20,90^BY2^BCN,60,Y,N,N^FD{codigo_barras}^FS
^FO20,170^A0N,18,18^FD{quantidade_compra} {unidade_compra} · Val {validade}^FS
^XZ"""


class ZPLService:
    """Gera e envia ZPL para impressoras de etiqueta."""

    @staticmethod
    def gerar_zpl_peca(unidade: object) -> str:
        """Gera payload ZPL para uma UnidadeFisica."""
        nfe_numero = (
            unidade.nfe_entrada.numero  # type: ignore[union-attr]
            if unidade.nfe_entrada_id  # type: ignore[union-attr]
            else "—"
        )
        return ZPL_TEMPLATE_PECA.format(
            nome_peca=unidade.peca_canonica.nome[:40],  # type: ignore[union-attr]
            codigo_barras=unidade.codigo_barras,  # type: ignore[union-attr]
            nfe_numero=nfe_numero,
            valor_nf=f"{unidade.valor_nf:.2f}",  # type: ignore[union-attr]
        )

    @staticmethod
    def gerar_zpl_lote(lote: object) -> str:
        """Gera payload ZPL para um LoteInsumo."""
        validade = (
            lote.validade.strftime("%d/%m/%Y")  # type: ignore[union-attr]
            if lote.validade  # type: ignore[union-attr]
            else "—"
        )
        return ZPL_TEMPLATE_LOTE.format(
            nome_material=lote.material_canonico.nome[:40],  # type: ignore[union-attr]
            codigo_barras=lote.codigo_barras,  # type: ignore[union-attr]
            quantidade_compra=lote.quantidade_compra,  # type: ignore[union-attr]
            unidade_compra=lote.unidade_compra,  # type: ignore[union-attr]
            validade=validade,
        )

    @staticmethod
    def imprimir(zpl: str, impressora: object) -> None:
        """
        Envia ZPL para a impressora via HTTP POST (Zebra direct print).
        P6: chamar sempre via Celery para não bloquear request.
        P9: timeout=5s — impressora offline não deve travar o worker.
        """
        try:
            with httpx.Client(timeout=5) as client:
                resp = client.post(
                    impressora.endpoint,  # type: ignore[union-attr]
                    content=zpl.encode("utf-8"),
                )
                resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.error(
                "Erro ao imprimir etiqueta na impressora %s: %s",
                impressora.nome,  # type: ignore[union-attr]
                type(e).__name__,
            )
            raise
