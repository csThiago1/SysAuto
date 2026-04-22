"""Parser do XML IFX (Porto/Azul/Itaú) → `ParsedBudget` DTO.

Schema: `IFX xsi:type="finalizacaoOrcamentoVO"` com seções:
  - dadosOrcamento (cliente, veículo, sinistro, apólice)
  - faturamento, maoDeObra, orcamento (totais agregados)
  - indicesDescontos (percentuais por categoria)
  - pecasTrocadas, pecasRecuperadas, pecasOverlap, pecasDNC, pecasMontagemDesmontagem
  - servicosTerceiros (serviços pagos a terceiros)
  - totalGeral* (contagens)
  - valoresMOPadrao (tabela MO por categoria)

Formato decimal: vírgula como separador decimal, ponto como separador de milhar
(ex: "2.548,69" → Decimal("2548.69")).
"""
from __future__ import annotations

import hashlib
import xml.etree.ElementTree as ET
from decimal import Decimal
from typing import Any

from apps.cilia.dtos import (
    ParsedBudget,
    ParsedItemDTO,
    ParsedParecerDTO,
)


# Mapeamento `tipoUso` XML → nosso `LaborCategory.code`
XML_TIPOUSO_TO_LABOR: dict[str, str] = {
    "FUNILARIA": "FUNILARIA",
    "PINTURA": "PINTURA",
    "MECANICA": "MECANICA",
    "ELETRICA": "ELETRICA",
    "TAPECARIA": "TAPECARIA",
    "ACABAMENTO": "ACABAMENTO",
    "VIDRACARIA": "VIDRACARIA",
}


# Mapeamento `pecaNegociada` XML → nosso `part_type`.
# F = Fornecida (original); G = Genuína; N = Não-original/outras
XML_PECA_NEGOCIADA_TO_PART: dict[str, str] = {
    "F": "ORIGINAL",
    "G": "GENUINA",
    "N": "OUTRAS_FONTES",
    "V": "VERDE",
}


class XmlIfxParser:
    """Converte bytes do XML IFX em `ParsedBudget` DTO."""

    @classmethod
    def parse(cls, xml_bytes: bytes, *, insurer_code: str) -> ParsedBudget:
        """Parse XML + mapeia para ParsedBudget.

        Args:
            xml_bytes: bytes do arquivo XML.
            insurer_code: code da seguradora (obrigatório — XML não identifica).

        Returns:
            ParsedBudget com source="xml_ifx", items, pareceres (vazio — XML não
            traz parecer estruturado), e snapshot completo.

        Raises:
            ET.ParseError: se XML malformado.
            ValueError: se root não é IFX/finalizacaoOrcamentoVO.
        """
        root = ET.fromstring(xml_bytes)
        if root.tag != "IFX":
            raise ValueError(f"Root tag '{root.tag}' não é 'IFX'")

        pb = ParsedBudget(source="xml_ifx")
        pb.insurer_code = insurer_code

        # --- dadosOrcamento ---
        dados = root.find("dadosOrcamento")
        if dados is not None:
            cls._populate_dados_orcamento(pb, dados)

        # --- Financeiro: franquia ---
        mo = root.find("maoDeObra")
        faturamento = root.find("faturamento")
        if mo is not None:
            franchise = cls._text(mo, "valorFranquia")
            if franchise is None and faturamento is not None:
                franchise = cls._text(faturamento, "valorFranquiaLiberada")
            pb.franchise_amount = cls._dec_br(franchise)

        # --- valoresMOPadrao → hourly_rates (convertidos pra formato dot-decimal) ---
        rates = root.find("valoresMOPadrao")
        if rates is not None:
            pb.hourly_rates = {
                "FUNILARIA": str(cls._dec_br(cls._text(rates, "funilaria"))),
                "PINTURA": str(cls._dec_br(cls._text(rates, "pintura"))),
                "MECANICA": str(cls._dec_br(cls._text(rates, "mecanica"))),
                "ELETRICA": str(cls._dec_br(cls._text(rates, "eletrica"))),
                "TAPECARIA": str(cls._dec_br(cls._text(rates, "tapecaria"))),
                "ACABAMENTO": str(cls._dec_br(cls._text(rates, "acabamento"))),
            }

        # --- Items (5 grupos + serviços terceiros) ---
        for group_name, operation in [
            ("pecasTrocadas", "TROCA"),
            ("pecasRecuperadas", "RECUPERACAO"),
            ("pecasOverlap", "OVERLAP"),
            ("pecasMontagemDesmontagem", "MONTAGEM_DESMONTAGEM"),
            ("pecasDNC", "DNC"),
        ]:
            group_node = root.find(group_name)
            if group_node is None:
                continue
            for peca in group_node.findall("peca"):
                pb.items.append(cls._parse_peca(peca, default_operation=operation))

        # Serviços terceiros
        svc_node = root.find("servicosTerceiros")
        if svc_node is not None:
            for svc in svc_node.findall("servico"):
                pb.items.append(cls._parse_servico_terceiro(svc))

        # --- Snapshot ---
        pb.raw_payload = cls._xml_to_dict(root)
        pb.raw_hash = hashlib.sha256(xml_bytes).hexdigest()

        return pb

    # ------------------------------------------------------------------ helpers
    @classmethod
    def _populate_dados_orcamento(cls, pb: ParsedBudget, dados: ET.Element) -> None:
        # Sinistro + apólice
        pb.casualty_number = cls._text(dados, "numSinistro") or ""
        pb.external_budget_number = pb.casualty_number  # XML não distingue budget de sinistro
        pb.external_numero_vistoria = cls._text(dados, "numeroVistoria") or ""
        pb.external_version = pb.external_numero_vistoria or pb.casualty_number

        # Cliente
        pb.segurado_name = cls._text(dados, "nomeSegurado") or ""
        ddd = cls._text(dados, "DDDTelefoneSegurado") or ""
        num = cls._text(dados, "telefoneSegurado") or ""
        pb.segurado_phone = f"{ddd.strip()}{num.strip()}".strip()

        # Veículo
        pb.vehicle_plate = (cls._text(dados, "licencaDoVeiculo") or "").upper()
        pb.vehicle_chassis = cls._text(dados, "nroChassiDoVeiculo") or ""
        pb.vehicle_km = cls._text(dados, "quilometragem") or ""
        model_year_str = cls._text(dados, "anoDoModeloDoVeiculo")
        if model_year_str and model_year_str.isdigit():
            pb.vehicle_year = int(model_year_str)
        pb.vehicle_description = (cls._text(dados, "descricaoModelo") or "").strip()
        pb.vehicle_brand = ""  # XML não separa brand — vem tudo em descricaoModelo

        # Status — XML é sempre "finalizado" (chega no final do fluxo)
        pb.external_status = "autorizado"

    @classmethod
    def _parse_peca(cls, peca: ET.Element, *, default_operation: str) -> ParsedItemDTO:
        descricao = cls._text(peca, "descricaoPeca") or cls._text(peca, "apelidoPeca") or ""
        codigo = (cls._text(peca, "codigoOriginalPeca") or "").strip()
        tipo_uso = cls._text(peca, "tipoUso") or "FUNILARIA"
        labor_cat = XML_TIPOUSO_TO_LABOR.get(tipo_uso, "FUNILARIA")

        # Preços — pecasTrocadas tem precoBruto/precoLiquido;
        # pecasRecuperadas/Overlap têm precoNegociado (valor de referência)
        preco_liquido = cls._text(peca, "precoLiquido") or cls._text(peca, "precoNegociado") or "0"
        preco_bruto = cls._text(peca, "precoBruto") or preco_liquido
        desconto_pct = cls._text(peca, "descontoOficina") or "0"

        # Fornecimento — pecaFornecida=false → oficina fornece (supplier=OFICINA)
        peca_fornecida = (cls._text(peca, "pecaFornecida") or "").lower() == "true"
        supplier = "SEGURADORA" if peca_fornecida else "OFICINA"

        # Part type
        part_type_code = (cls._text(peca, "pecaNegociada") or "").upper()
        part_type = XML_PECA_NEGOCIADA_TO_PART.get(part_type_code, "")

        # Divisão orçamento = impact_area
        divisao = cls._text(peca, "divisaoOrcamento")
        impact_area: int | None = int(divisao) if divisao and divisao.isdigit() else None

        qty = cls._dec_br(cls._text(peca, "quantidadePecasItemOrcamento") or "1")

        # Operations — tempoMaoDeObra + tempoPintura → 2 potenciais operations
        operations: list[dict[str, Any]] = []

        tempo_mo = cls._dec_br(cls._text(peca, "tempoMaoDeObra") or "0")
        if tempo_mo > 0 or default_operation in ("TROCA", "RECUPERACAO"):
            operations.append({
                "op_type": default_operation,
                "labor_cat": labor_cat,
                "hours": str(tempo_mo),
                "rate": "0",
            })

        tempo_pintura = cls._dec_br(cls._text(peca, "tempoPintura") or "0")
        if tempo_pintura > 0:
            operations.append({
                "op_type": "PINTURA",
                "labor_cat": "PINTURA",
                "hours": str(tempo_pintura),
                "rate": "0",
            })

        return ParsedItemDTO(
            bucket="IMPACTO",
            payer_block="SEGURADORA",
            impact_area=impact_area,
            item_type="PART",
            description=descricao,
            external_code=codigo,
            part_type=part_type,
            supplier=supplier,
            quantity=qty,
            unit_price=cls._dec_br(preco_bruto),
            discount_pct=cls._dec_br(desconto_pct),
            net_price=cls._dec_br(preco_liquido),
            operations=operations,
        )

    @classmethod
    def _parse_servico_terceiro(cls, svc: ET.Element) -> ParsedItemDTO:
        return ParsedItemDTO(
            bucket="IMPACTO",
            payer_block="SEGURADORA",
            item_type="EXTERNAL_SERVICE",
            description=cls._text(svc, "descricaoServico") or "",
            quantity=Decimal("1"),
            unit_price=cls._dec_br(cls._text(svc, "valorBruto") or "0"),
            net_price=cls._dec_br(cls._text(svc, "valorLiquido") or "0"),
            flag_servico_manual=True,
            impact_area=(
                int(cls._text(svc, "divisaoOrcamento"))
                if (cls._text(svc, "divisaoOrcamento") or "").isdigit()
                else None
            ),
        )

    # ------------------------------------------------------------------ utils
    @staticmethod
    def _text(parent: ET.Element, tag: str) -> str | None:
        """Retorna texto do filho com tag `tag`, ou None."""
        el = parent.find(tag)
        if el is None or el.text is None:
            return None
        return el.text.strip()

    @staticmethod
    def _dec_br(value: str | None) -> Decimal:
        """Converte string em formato BR ('2.548,69') para Decimal.

        Formato brasileiro: ponto = milhar, vírgula = decimal.
        Strings vazias, None ou não-numéricas retornam Decimal('0').
        """
        if value is None:
            return Decimal("0")
        s = str(value).strip()
        if not s:
            return Decimal("0")
        # Remove pontos (milhar), troca vírgula por ponto
        s = s.replace(".", "").replace(",", ".")
        try:
            return Decimal(s)
        except Exception:
            return Decimal("0")

    @classmethod
    def _xml_to_dict(cls, element: ET.Element) -> dict[str, Any]:
        """Converte ElementTree em dict recursivo pra armazenar em JSONField.

        Estratégia:
          - Folha: retorna texto (ou "")
          - Nó com 1 tipo de filho repetido: retorna list
          - Nó com filhos heterogêneos: retorna dict
        """
        children = list(element)
        if not children:
            return (element.text or "").strip()  # type: ignore[return-value]

        # Se todos os filhos têm a mesma tag → lista
        tags = [c.tag for c in children]
        if len(set(tags)) == 1 and len(tags) > 1:
            return [cls._xml_to_dict(c) for c in children]  # type: ignore[return-value]

        # Dict: chave = tag (se repetida, vira lista)
        result: dict[str, Any] = {}
        for child in children:
            value = cls._xml_to_dict(child)
            if child.tag in result:
                existing = result[child.tag]
                if isinstance(existing, list):
                    existing.append(value)
                else:
                    result[child.tag] = [existing, value]
            else:
                result[child.tag] = value
        return result
