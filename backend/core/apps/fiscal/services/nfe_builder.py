"""
Paddock Solutions — Fiscal — NFeBuilder
Ciclo 07A: NF-e de Produto (Mercadorias)

Builder genérico para NF-e produto via Focus NF-e (/v2/nfe).
Suporta qualquer UF destinatário — CFOP e alíquota interestadual
detectados automaticamente.

Regime: Normal (CST). Sem CSOSN.
"""

import logging
import zoneinfo
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal
from typing import TYPE_CHECKING

from django.utils import timezone

if TYPE_CHECKING:
    from apps.fiscal.models import FiscalConfigModel
    from apps.persons.models import Person

from apps.fiscal.exceptions import NfeBuilderError

logger = logging.getLogger(__name__)

# ─── Estados que recebem 7% nas operações interestaduais ─────────────────────
# Regra geral: Regiões Norte, Nordeste, Centro-Oeste (exceto DF) + ES.
# Demais estados (SP, RJ, MG, RS, PR, SC, DF): 12%.
UF_7_PERCENT: frozenset[str] = frozenset(
    {"AC", "AL", "AP", "BA", "CE", "ES", "GO", "MA", "MS", "MT",
     "PA", "PB", "PE", "PI", "RN", "RO", "RR", "SE", "TO"}
)

# Indicador de IE do destinatário
_IE_CONTRIBUINTE = "1"   # PJ com IE
_IE_NAO_CONTRIBUINTE = "9"  # PF ou PJ isenta


@dataclass
class NFeItem:
    """Representa um item (linha) da NF-e de produto."""

    codigo_produto: str
    descricao: str
    ncm: str                          # 8 dígitos — obrigatório para NF-e
    unidade: str                       # "UN", "PC", "KG", "LT" …
    quantidade: Decimal
    valor_unitario: Decimal
    valor_desconto: Decimal = field(default_factory=lambda: Decimal("0"))
    cfop: str = ""                    # preenchido pelo builder se vazio
    sku_interno: str = ""             # código interno opcional


@dataclass
class NFeTaxConfig:
    """
    Configuração de impostos por emissão.

    Instanciada a partir de FiscalConfigModel.defaults_tax_config() quando
    não sobrescrita pelo usuário no formulário.
    """

    cst_icms: str
    icms_aliquota: Decimal
    icms_modalidade_base_calculo: str
    cst_pis: str
    pis_aliquota: Decimal
    cst_cofins: str
    cofins_aliquota: Decimal


class NFeBuilder:
    """
    Constrói payload Focus NF-e produto (/v2/nfe) de forma genérica.

    Funciona para qualquer par (UF emitente, UF destinatário):
    - Intraestadual (AM→AM): CFOP 5102, local_destino=1
    - Interestadual (AM→SP): CFOP 6102, local_destino=2

    Raises:
        NfeBuilderError: dados insuficientes (NCM ausente, sem endereço, etc.)
    """

    @classmethod
    def build(
        cls,
        items: list[NFeItem],
        config: "FiscalConfigModel",
        destinatario: "Person",
        tax_config: NFeTaxConfig,
        ref: str,
        forma_pagamento: str = "01",
        observacoes: str = "",
    ) -> dict:
        """
        Monta payload pronto para POST /v2/nfe.

        Args:
            items: lista de itens do documento
            config: configuração fiscal do emissor
            destinatario: Person destinatário (com PersonDocument + PersonAddress)
            tax_config: configuração de impostos (ICMS/PIS/COFINS)
            ref: referência de idempotência (ex: "12345678-NFE-20260424-000001")
            forma_pagamento: código Focus (01=dinheiro, 03=crédito, 04=débito, 99=outros)
            observacoes: texto livre para informações complementares
        """
        if not items:
            raise NfeBuilderError("NF-e deve ter ao menos um item.")

        cls._validate_config(config)
        dest_data = cls._get_destinatario(destinatario)
        uf_dest = dest_data["uf"]
        uf_emitente = config.nfe_uf or "AM"

        local_destino = "1" if uf_emitente == uf_dest else "2"

        # Resolve alíquota ICMS por UF (sobrescreve tax_config.icms_aliquota)
        icms_aliquota = cls._get_icms_aliquota(config, uf_dest)
        resolved_tax = NFeTaxConfig(
            cst_icms=tax_config.cst_icms,
            icms_aliquota=icms_aliquota,
            icms_modalidade_base_calculo=tax_config.icms_modalidade_base_calculo,
            cst_pis=tax_config.cst_pis,
            pis_aliquota=tax_config.pis_aliquota,
            cst_cofins=tax_config.cst_cofins,
            cofins_aliquota=tax_config.cofins_aliquota,
        )

        is_simples = str(config.regime_tributario) == "1"

        payload_items = []
        valor_total_produtos = Decimal("0")
        for i, item in enumerate(items, start=1):
            item_dict = cls._build_item(
                item, i, resolved_tax, uf_emitente, uf_dest,
                simples_nacional=is_simples,
            )
            payload_items.append(item_dict)
            valor_total_produtos += Decimal(str(item_dict["valor_bruto"]))

        valor_total_nf = valor_total_produtos  # sem frete / seguro / outr. desp.

        # Focus NF-e v2 usa campos flat (cnpj_emitente, nome_destinatario, etc.)
        emitente = cls._get_emitente(config)
        payload: dict = {
            "natureza_operacao": config.nfe_natureza_operacao or "Venda de mercadoria",
            "data_emissao": timezone.now().astimezone(
                zoneinfo.ZoneInfo("America/Manaus")
            ).isoformat(),
            "tipo_documento": "1",   # 1=saída
            "finalidade_emissao": "1",  # 1=normal
            "local_destino": local_destino,
            "consumidor_final": config.nfe_indicador_consumidor_final or "1",
            "presenca_comprador": config.nfe_indicador_presenca or "1",
            "modalidade_frete": "9",  # 9=sem frete
            # Emitente (flat)
            "cnpj_emitente": emitente["cnpj"],
            "nome_emitente": config.razao_social,
            "nome_fantasia_emitente": emitente.get("nome_fantasia", ""),
            "inscricao_estadual_emitente": emitente.get("inscricao_estadual", ""),
            "logradouro_emitente": emitente["logradouro"],
            "numero_emitente": emitente.get("numero", "S/N"),
            "bairro_emitente": emitente.get("bairro", ""),
            "municipio_emitente": emitente.get("municipio", ""),
            "uf_emitente": emitente.get("uf", "AM"),
            "cep_emitente": emitente.get("cep", ""),
            "regime_tributario_emitente": emitente.get("regime_tributario", "1"),
        }

        # Destinatário (flat)
        for key, value in dest_data.items():
            if key == "indicador_ie_destinatario":
                payload["indicador_inscricao_estadual_destinatario"] = value
            else:
                payload[f"{key}_destinatario"] = value

        payload["items"] = payload_items
        payload["formas_pagamento"] = [
            {
                "forma_pagamento": forma_pagamento,
                "valor_pagamento": str(valor_total_nf),
            }
        ]

        if observacoes:
            payload["informacoes_adicionais_contribuinte"] = observacoes[:2000]

        return payload

    # ── Helpers internos ─────────────────────────────────────────────────────

    @classmethod
    def _validate_config(cls, config: "FiscalConfigModel") -> None:
        if not config.nfe_cep:
            raise NfeBuilderError(
                "FiscalConfigModel sem CEP do emitente — preencha nfe_cep no admin."
            )
        if not config.nfe_logradouro:
            raise NfeBuilderError(
                "FiscalConfigModel sem logradouro do emitente — preencha nfe_logradouro."
            )

    @classmethod
    def _get_cfop(cls, uf_emitente: str, uf_dest: str) -> str:
        """Retorna CFOP base: '5102' (intraestadual) ou '6102' (interestadual)."""
        return "5102" if uf_emitente == uf_dest else "6102"

    @classmethod
    def _get_icms_aliquota(cls, config: "FiscalConfigModel", uf_dest: str) -> Decimal:
        """Resolve alíquota ICMS conforme UF de destino."""
        uf_emitente = config.nfe_uf or "AM"
        if uf_dest == uf_emitente:
            return config.icms_aliquota_intraestadual
        if uf_dest in UF_7_PERCENT:
            return config.icms_aliquota_interestadual_7
        return config.icms_aliquota_interestadual_12

    @classmethod
    def _get_emitente(cls, config: "FiscalConfigModel") -> dict:
        return {
            "cnpj": config.cnpj,
            "nome_fantasia": config.nome_fantasia or config.razao_social,
            "logradouro": config.nfe_logradouro,
            "numero": config.nfe_numero or "S/N",
            "bairro": config.nfe_bairro,
            "municipio": config.nfe_municipio or "Manaus",
            "uf": config.nfe_uf or "AM",
            "cep": config.nfe_cep,
            "regime_tributario": str(config.regime_tributario),  # "3"=Normal
            "inscricao_estadual": config.inscricao_estadual,
        }

    @classmethod
    def _get_destinatario(cls, person: "Person") -> dict:
        """
        Monta bloco destinatário a partir de Person + PersonDocument + PersonAddress.

        Raises:
            NfeBuilderError: sem documento primário ou sem endereço.
        """
        from apps.persons.models import PersonAddress, PersonDocument

        # Documento primário (CPF ou CNPJ)
        doc = (
            PersonDocument.objects.filter(person=person, is_primary=True)
            .select_related("person")
            .first()
        )
        if not doc:
            raise NfeBuilderError(
                f"Person '{person.full_name}' sem documento primário (CPF/CNPJ)."
            )

        # Endereço primário
        addr = PersonAddress.objects.filter(person=person, is_primary=True).first()
        if not addr:
            raise NfeBuilderError(
                f"Person '{person.full_name}' sem endereço primário."
            )

        # Indicador IE: PJ com IE → contribuinte; demais → não contribuinte
        tem_ie = PersonDocument.objects.filter(
            person=person, doc_type="IE"
        ).exists()
        indicador_ie = _IE_CONTRIBUINTE if (doc.doc_type == "CNPJ" and tem_ie) else _IE_NAO_CONTRIBUINTE

        dest: dict = {
            "nome": person.full_name,
            "logradouro": addr.street or "",
            "numero": addr.number or "S/N",
            "bairro": addr.neighborhood or "",
            "municipio": addr.city or "",
            "uf": addr.state or "",
            "cep": (addr.zip_code or "").replace("-", ""),
            "indicador_ie_destinatario": indicador_ie,
        }
        if addr.complement:
            dest["complemento"] = addr.complement

        if doc.doc_type == "CPF":
            dest["cpf"] = doc.value  # valor decriptografado
        else:
            dest["cnpj"] = doc.value

        # E-mail (pega primeiro contato tipo email, se existir)
        from apps.persons.models import PersonContact
        email_contact = PersonContact.objects.filter(
            person=person, contact_type__iexact="email"
        ).first()
        if email_contact:
            dest["email"] = email_contact.value

        return dest

    @classmethod
    def _build_item(
        cls,
        item: NFeItem,
        numero: int,
        tax_config: NFeTaxConfig,
        uf_emitente: str,
        uf_dest: str,
        simples_nacional: bool = False,
    ) -> dict:
        """Monta um item da NF-e com ICMS/PIS/COFINS calculados."""
        if not item.ncm:
            raise NfeBuilderError(
                f"Item '{item.descricao}' sem NCM — preencha o NCM antes de emitir."
            )

        cfop = item.cfop or cls._get_cfop(uf_emitente, uf_dest)

        valor_bruto = (item.quantidade * item.valor_unitario).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        valor_desconto = item.valor_desconto.quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        base_icms = (valor_bruto - valor_desconto).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        result: dict = {
            "numero_item": str(numero),
            "codigo_produto": item.codigo_produto or str(numero),
            "descricao": item.descricao,
            "cfop": cfop,
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
            result["icms_situacao_tributaria"] = "102"  # 102=sem crédito
            result["pis_situacao_tributaria"] = "07"    # 07=isento
            result["cofins_situacao_tributaria"] = "07"  # 07=isento
        else:
            # Regime Normal: CST + base de cálculo + alíquotas
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
                "icms_modalidade_base_calculo": tax_config.icms_modalidade_base_calculo,
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
    def tax_config_from_fiscal_config(cls, config: "FiscalConfigModel") -> NFeTaxConfig:
        """Cria NFeTaxConfig com os defaults do FiscalConfigModel."""
        return NFeTaxConfig(
            cst_icms=config.cst_icms_saida,
            icms_aliquota=config.icms_aliquota_intraestadual,  # sobrescrito por _get_icms_aliquota
            icms_modalidade_base_calculo=config.icms_modalidade_base_calculo,
            cst_pis=config.cst_pis_saida,
            pis_aliquota=config.aliquota_pis,
            cst_cofins=config.cst_cofins_saida,
            cofins_aliquota=config.aliquota_cofins,
        )
