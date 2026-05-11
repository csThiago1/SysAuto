"""
Paddock Solutions — Fiscal — NFC-e Builder (Modelo 65)
Cupom Fiscal Eletrônico para vendas ao consumidor final.

NFC-e vs NF-e:
- Modelo 65 (NF-e usa 55)
- consumidor_final = 1 (sempre)
- presenca_comprador = 1 (presencial)
- local_destino = 1 (sempre interno)
- Destinatario opcional (pode emitir sem CPF para vendas < R$200)
- Sem frete (modalidade_frete = 9)
- Processamento sincrono (Focus retorna 201 direto, sem polling)
- CFOP sempre 5102 (venda interna consumidor)
"""

import logging
import zoneinfo
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal
from typing import TYPE_CHECKING, Any

from django.utils import timezone

if TYPE_CHECKING:
    from apps.fiscal.models import FiscalConfigModel

from apps.fiscal.exceptions import NfceBuilderError

logger = logging.getLogger(__name__)


@dataclass
class NfceItem:
    """Item de uma NFC-e."""

    codigo_produto: str
    descricao: str
    ncm: str                          # 8 digitos — obrigatorio
    unidade: str                       # "UN", "PC", "KG", "LT" ...
    quantidade: Decimal
    valor_unitario: Decimal
    valor_desconto: Decimal = field(default_factory=lambda: Decimal("0"))


@dataclass
class NfceTaxConfig:
    """Configuracao fiscal para NFC-e — simplificada em relacao a NF-e.

    Regime Normal: CST para ICMS + PIS/COFINS.
    Simples Nacional: CSOSN em vez de CST.
    """

    cst_icms: str
    icms_aliquota: Decimal
    cst_pis: str
    pis_aliquota: Decimal
    cst_cofins: str
    cofins_aliquota: Decimal


class NfceBuilder:
    """Constroi payload flat para Focus NFC-e /v2/nfce endpoint.

    Todas as vendas sao intra-estaduais (AM -> AM), CFOP fixo 5102.
    Destinatario opcional — CPF so obrigatorio para vendas >= R$200.
    """

    @classmethod
    def build(
        cls,
        items: list[NfceItem],
        config: "FiscalConfigModel",
        tax_config: NfceTaxConfig,
        ref: str,
        forma_pagamento: str = "01",
        cpf_destinatario: str = "",
        nome_destinatario: str = "",
        observacoes: str = "",
    ) -> dict[str, Any]:
        """Monta payload pronto para POST /v2/nfce.

        Args:
            items: lista de itens do cupom fiscal.
            config: configuracao fiscal do emissor.
            tax_config: configuracao de impostos (ICMS/PIS/COFINS).
            ref: referencia de idempotencia.
            forma_pagamento: codigo Focus (01=dinheiro, 03=credito, 04=debito, 05=pix).
            cpf_destinatario: CPF do consumidor (opcional).
            nome_destinatario: nome do consumidor (opcional).
            observacoes: texto livre para informacoes complementares.

        Returns:
            dict pronto para POST /v2/nfce.

        Raises:
            NfceBuilderError: dados insuficientes.
        """
        if not items:
            raise NfceBuilderError("NFC-e deve ter ao menos 1 item.")

        cls._validate_config(config)

        is_simples = str(config.regime_tributario) == "1"

        now = timezone.now().astimezone(
            zoneinfo.ZoneInfo("America/Manaus")
        )

        payload: dict[str, Any] = {
            "natureza_operacao": "Venda ao consumidor final",
            "data_emissao": now.isoformat(),
            "tipo_documento": "1",       # 1 = saida
            "finalidade_emissao": "1",    # 1 = normal
            "consumidor_final": "1",      # sempre 1 para NFC-e
            "presenca_comprador": "1",    # presencial
            "local_destino": "1",         # sempre interno
            "modalidade_frete": "9",      # sem frete
            # Emitente (flat)
            "cnpj_emitente": config.cnpj,
            "nome_emitente": config.razao_social,
            "nome_fantasia_emitente": config.nome_fantasia or config.razao_social,
            "inscricao_estadual_emitente": config.inscricao_estadual,
            "regime_tributario_emitente": str(config.regime_tributario),
            "logradouro_emitente": config.nfe_logradouro,
            "numero_emitente": config.nfe_numero or "S/N",
            "bairro_emitente": config.nfe_bairro,
            "municipio_emitente": config.nfe_municipio or "Manaus",
            "uf_emitente": config.nfe_uf or "AM",
            "cep_emitente": config.nfe_cep,
        }

        # Destinatario opcional para NFC-e
        if cpf_destinatario:
            payload["cpf_destinatario"] = cpf_destinatario.replace(".", "").replace("-", "")
        if nome_destinatario:
            payload["nome_destinatario"] = nome_destinatario

        # Build items
        payload_items = []
        valor_total_produtos = Decimal("0")
        for i, item in enumerate(items, start=1):
            item_dict = cls._build_item(item, i, tax_config, simples_nacional=is_simples)
            payload_items.append(item_dict)
            valor_total_produtos += Decimal(str(item_dict["valor_bruto"]))

        payload["items"] = payload_items

        # Pagamento
        payload["formas_pagamento"] = [
            {
                "forma_pagamento": forma_pagamento,
                "valor_pagamento": str(valor_total_produtos),
            }
        ]

        if observacoes:
            payload["informacoes_adicionais_contribuinte"] = observacoes[:2000]

        return payload

    # -- Helpers internos ---------------------------------------------------

    @classmethod
    def _validate_config(cls, config: "FiscalConfigModel") -> None:
        """Valida campos obrigatorios do emissor."""
        if not config.nfe_cep:
            raise NfceBuilderError(
                "FiscalConfigModel sem CEP do emitente — preencha nfe_cep no admin."
            )
        if not config.nfe_logradouro:
            raise NfceBuilderError(
                "FiscalConfigModel sem logradouro do emitente — preencha nfe_logradouro."
            )

    @classmethod
    def _build_item(
        cls,
        item: NfceItem,
        numero: int,
        tax_config: NfceTaxConfig,
        simples_nacional: bool = False,
    ) -> dict[str, Any]:
        """Monta um item da NFC-e com ICMS/PIS/COFINS calculados."""
        if not item.ncm:
            raise NfceBuilderError(
                f"Item '{item.descricao}' sem NCM — preencha o NCM antes de emitir."
            )

        valor_bruto = (item.quantidade * item.valor_unitario).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        valor_desconto = item.valor_desconto.quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        base_icms = (valor_bruto - valor_desconto).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        result: dict[str, Any] = {
            "numero_item": str(numero),
            "codigo_produto": item.codigo_produto or str(numero),
            "descricao": item.descricao,
            "cfop": "5102",  # sempre venda interna para NFC-e
            "unidade_comercial": item.unidade,
            "quantidade_comercial": float(item.quantidade),
            "valor_unitario_comercial": float(item.valor_unitario),
            "valor_bruto": float(valor_bruto),
            "unidade_tributavel": item.unidade,
            "quantidade_tributavel": float(item.quantidade),
            "valor_unitario_tributavel": float(item.valor_unitario),
            "codigo_ncm": item.ncm.replace(".", ""),
            "icms_origem": "0",
        }

        if simples_nacional:
            # Simples Nacional: CSOSN em vez de CST
            result["icms_situacao_tributaria"] = "102"  # 102 = sem credito
            result["pis_situacao_tributaria"] = "07"    # 07 = isento
            result["cofins_situacao_tributaria"] = "07"  # 07 = isento
        else:
            # Regime Normal: CST + base de calculo + aliquotas
            icms_valor = (base_icms * tax_config.icms_aliquota / 100).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            pis_valor = (valor_bruto * tax_config.pis_aliquota / 100).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            cofins_valor = (valor_bruto * tax_config.cofins_aliquota / 100).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            result.update({
                "icms_situacao_tributaria": tax_config.cst_icms,
                "icms_modalidade_base_calculo": "3",
                "icms_base_calculo": float(base_icms),
                "icms_aliquota": float(tax_config.icms_aliquota),
                "icms_valor": float(icms_valor),
                "pis_situacao_tributaria": tax_config.cst_pis,
                "pis_base_calculo": float(valor_bruto),
                "pis_aliquota_porcentual": float(tax_config.pis_aliquota),
                "pis_valor": float(pis_valor),
                "cofins_situacao_tributaria": tax_config.cst_cofins,
                "cofins_base_calculo": float(valor_bruto),
                "cofins_aliquota_porcentual": float(tax_config.cofins_aliquota),
                "cofins_valor": float(cofins_valor),
            })

        if valor_desconto > 0:
            result["valor_desconto"] = float(valor_desconto)

        return result

    @classmethod
    def tax_config_from_fiscal_config(cls, config: "FiscalConfigModel") -> NfceTaxConfig:
        """Cria NfceTaxConfig com os defaults do FiscalConfigModel."""
        return NfceTaxConfig(
            cst_icms=config.cst_icms_saida,
            icms_aliquota=config.icms_aliquota_intraestadual,
            cst_pis=config.cst_pis_saida,
            pis_aliquota=config.aliquota_pis,
            cst_cofins=config.cst_cofins_saida,
            cofins_aliquota=config.aliquota_cofins,
        )
