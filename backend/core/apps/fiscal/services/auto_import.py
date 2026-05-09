"""
Fiscal — Auto Import Service
Importa NF-e recebidas automaticamente via webhook Focus.
"""
import logging
from decimal import Decimal

from django.db import transaction

from apps.fiscal.models import NFeEntrada, NFeEntradaItem

logger = logging.getLogger(__name__)


class NFeEntradaAutoImportService:
    """Cria NFeEntrada automaticamente a partir de dados de NF-e recebida."""

    @staticmethod
    @transaction.atomic
    def import_from_webhook(chave: str, nfe_data: dict) -> NFeEntrada | None:
        """Cria NFeEntrada a partir de dados de webhook nfe_recebida.

        Idempotente: se já existe NFeEntrada com esta chave, retorna None.

        Args:
            chave: Chave de acesso de 44 dígitos.
            nfe_data: Dados da NF-e do webhook/API Focus.

        Returns:
            NFeEntrada criada ou None se já existia.
        """
        if NFeEntrada.objects.filter(chave_acesso=chave).exists():
            logger.info("auto_import: NFeEntrada já existe para chave %s", chave[-8:])
            return None

        nfe_entrada = NFeEntrada.objects.create(
            chave_acesso=chave,
            numero=str(nfe_data.get("numero", "")),
            serie=str(nfe_data.get("serie", "")),
            emitente_cnpj=nfe_data.get("cnpj_emitente", ""),
            emitente_nome=nfe_data.get("nome_emitente", ""),
            data_emissao=nfe_data.get("data_emissao"),
            valor_total=Decimal(str(nfe_data.get("valor_total", "0"))),
            status="importada",
            auto_imported=True,
        )

        # Import items if available
        items = nfe_data.get("itens") or nfe_data.get("items") or []
        for item in items:
            try:
                NFeEntradaItem.objects.create(
                    nfe_entrada=nfe_entrada,
                    numero_item=item.get("numero_item", 0),
                    descricao_original=item.get("descricao", "")[:300],
                    codigo_produto_nf=item.get("codigo_produto", "")[:60],
                    ncm=item.get("codigo_ncm", "")[:8],
                    unidade_compra=item.get("unidade_comercial", "UN")[:20],
                    quantidade=Decimal(str(item.get("quantidade_comercial", "1"))),
                    valor_unitario_bruto=Decimal(str(item.get("valor_unitario_comercial", "0"))),
                    valor_unitario_com_tributos=Decimal(
                        str(
                            item.get(
                                "valor_unitario_tributavel",
                                item.get("valor_unitario_comercial", "0"),
                            )
                        )
                    ),
                    valor_total_com_tributos=Decimal(str(item.get("valor_bruto", "0"))),
                )
            except Exception as e:
                logger.warning(
                    "auto_import: erro ao importar item %s: %s",
                    item.get("numero_item"),
                    e,
                )

        logger.info(
            "auto_import: NFeEntrada #%s criada (chave %s, %d itens)",
            nfe_entrada.pk,
            chave[-8:],
            len(items),
        )
        return nfe_entrada
