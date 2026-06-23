"""Parser de orçamento HTML da HDI Seguros → ParsedBudget DTO.

Schema do export do portal HDI (`https://www.hdi.com.br/.../dsp_rel_orcamento_sinistro.htm`):

Tabelas (em ordem):
  1. table-mo — Regulador + Sinistro + Laudo
  2. table-mo — Razão social HDI + CNPJ + endereço
  3. table-mo — Cliente + Veículo (placa, cor, chassis, km)
  4. table-mo — Oficina (DS Car)
  5. table-mo — Peças Oficina (Partnumber, Descrição, Qtd, Preço Unit, Total, Desconto%)
  6. table-mo — Peças HDI (mesma estrutura — fornecidas pela seguradora)
  7. table-mo-operacoes — Operações por peça (Recuperar, Pintar, Rem.Inst., Alinhar)
  8. table-mo — Resumo MO (Funilaria, Tap/Vid, Eletrica, Mecanica, Pintura, Recup)
  9. table-mo — Serviços adicionais (Descrição, Valor)
 10. table-mo-orcamento#resumovalores — Totalizador
 11. table-mo-fatura — Franquia/Avarias
 12. table-mo-fatura — NF Serviço/Peças
 13. table-mo — Pareceres
 14. table-mo-fatura — Resumo final
"""
from __future__ import annotations

import hashlib
import logging
import re
from decimal import Decimal
from typing import Any

from apps.cilia.dtos import ParsedBudget, ParsedItemDTO, ParsedParecerDTO


logger = logging.getLogger(__name__)


def _br_dec(text: str) -> Decimal:
    """Converte '1.291,20' (formato BR) → Decimal('1291.20')."""
    if not text or text.strip() in ("-", ""):
        return Decimal("0")
    cleaned = text.strip().replace(".", "").replace(",", ".")
    try:
        return Decimal(cleaned)
    except Exception:
        return Decimal("0")


def _strip_tags(html: str) -> str:
    """Remove tags HTML e normaliza whitespace."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&")
    return re.sub(r"\s+", " ", text).strip()


_TABLE_RE = re.compile(r"<table([^>]*)>(.*?)</table>", re.DOTALL | re.IGNORECASE)
_ROW_RE = re.compile(r"<tr[^>]*>(.*?)</tr>", re.DOTALL | re.IGNORECASE)
_CELL_RE = re.compile(r"<t[dh][^>]*>(.*?)</t[dh]>", re.DOTALL | re.IGNORECASE)


class HdiHtmlParser:
    """Converte HTML da HDI em ParsedBudget DTO."""

    HOURLY_LABELS = ["funilaria", "tap_vidracaria", "eletrica", "mecanica", "pintura", "recuperacao"]

    @classmethod
    def parse(cls, html_bytes: bytes | str) -> ParsedBudget:
        if isinstance(html_bytes, bytes):
            # HDI normalmente é ISO-8859-1/windows-1252
            try:
                html = html_bytes.decode("utf-8")
            except UnicodeDecodeError:
                html = html_bytes.decode("windows-1252", errors="replace")
        else:
            html = html_bytes

        pb = ParsedBudget(source="hdi")
        pb.raw_hash = hashlib.sha256(
            html.encode("utf-8") if isinstance(html, str) else html_bytes
        ).hexdigest()
        pb.insurer_code = "hdi"

        tables = cls._extract_tables(html)
        if len(tables) < 10:
            raise ValueError(
                f"HTML HDI inválido: esperava >=10 tabelas, achou {len(tables)}",
            )

        cls._parse_header(pb, tables[0])
        # tables[1] (HDI razão) — não precisamos
        cls._parse_vehicle_client(pb, tables[2])
        # tables[3] (oficina DS Car) — não precisamos
        cls._parse_parts(pb, tables[4], supplier="OFICINA")
        cls._parse_parts(pb, tables[5], supplier="SEGURADORA")
        # tables[6] (operações por peça) — não preciso (já temos em pb.items)
        cls._parse_workforce_summary(pb, tables[7])
        cls._parse_additional_services(pb, tables[8])
        cls._parse_resumo(pb, tables[9])
        # tables[10] (Franquia/Avarias) — extrai franquia
        if len(tables) > 10:
            cls._parse_franquia(pb, tables[10])
        # tables[12] (Pareceres) — opcional
        if len(tables) > 12:
            cls._parse_pareceres(pb, tables[12])

        pb.raw_payload = {"_format": "hdi_html_v1"}
        return pb

    # ─────────────────────────────────────────────────── extractors

    @classmethod
    def _extract_tables(cls, html: str) -> list[str]:
        return [m.group(2) for m in _TABLE_RE.finditer(html)]

    @classmethod
    def _extract_rows(cls, table_html: str) -> list[list[str]]:
        """Retorna lista de células por linha."""
        rows = []
        for row_m in _ROW_RE.finditer(table_html):
            cells = [_strip_tags(c.group(1)) for c in _CELL_RE.finditer(row_m.group(1))]
            if cells:
                rows.append(cells)
        return rows

    @classmethod
    def _flatten(cls, table_html: str) -> str:
        return _strip_tags(table_html)

    # ─────────────────────────────────────────────────── parsers por tabela

    @classmethod
    def _parse_header(cls, pb: ParsedBudget, table_html: str) -> None:
        """Extrai Sinistro + Laudo (versão)."""
        text = cls._flatten(table_html)
        m = re.search(r"Sinistro:\s*(\S+)", text)
        if m:
            pb.casualty_number = m.group(1)
        m = re.search(r"Laudo:\s*(\S+)", text)
        if m:
            pb.external_budget_number = m.group(1)
        # Versão pode aparecer como "1.2 - 13/04/2026" — pega o ÚLTIMO número antes da última data
        versions = re.findall(r"(\d+(?:\.\d+)?)\s*-\s*\d{2}/\d{2}/\d{4}", text)
        if versions:
            pb.external_version = f"{pb.external_budget_number}.{versions[-1]}"

    @classmethod
    def _parse_vehicle_client(cls, pb: ParsedBudget, table_html: str) -> None:
        text = cls._flatten(table_html)
        m = re.search(r"Nome:\s*(.+?)\s+Telefone:", text)
        if m:
            pb.segurado_name = m.group(1).strip()
        m = re.search(r"Telefone:\s*(\([\d\s\-\(\)]+)?\s*Veiculo:", text)
        if m and m.group(1):
            phone = re.sub(r"\D", "", m.group(1) or "")
            if phone:
                pb.segurado_phone = phone
        # Veiculo: 0016545 - VOLKSWAGEN GOL 1.0MI TOTAL FLEX 8V 4P 2013
        m = re.search(r"Veiculo:\s*\S+\s*-\s*(.+?)\s+Placa:", text)
        if m:
            raw_model = m.group(1).strip()
            parts = raw_model.split()
            if parts:
                pb.vehicle_brand = parts[0]
                # Last token é o ano (ex: '2013')
                year_match = re.match(r"\d{4}", parts[-1])
                if year_match:
                    pb.vehicle_year = int(parts[-1])
                    pb.vehicle_model = " ".join(parts[1:-1])
                else:
                    pb.vehicle_model = " ".join(parts[1:])
        m = re.search(r"Placa:\s*([A-Z0-9]+)", text)
        if m:
            pb.vehicle_plate = m.group(1).upper()
        m = re.search(r"Cor:\s*([A-Za-zÀ-ú]+)", text)
        if m:
            pb.vehicle_color = m.group(1).title()
        m = re.search(r"Chassis:\s*(\S+)", text)
        if m:
            pb.vehicle_chassis = m.group(1).upper()
        m = re.search(r"KM:\s*([\d\.,]+)", text)
        if m:
            pb.vehicle_km = m.group(1)
        pb.vehicle_description = (
            f"{pb.vehicle_brand} {pb.vehicle_model} {pb.vehicle_year or ''}"
        ).strip()

    @classmethod
    def _parse_parts(cls, pb: ParsedBudget, table_html: str, supplier: str) -> None:
        """Parseia tabela de peças (Partnumber, Descrição, Qtd, Preço, Total, Desconto%).

        supplier='OFICINA' (peças oficina compra/cobra) ou 'SEGURADORA' (fornecidas).
        """
        rows = cls._extract_rows(table_html)
        if not rows:
            return
        # Pula header
        for row in rows[1:]:
            if len(row) < 5:
                continue
            partnumber, description, qty, _unit, total, *rest = row + [""]
            desconto_pct = rest[0] if rest else "0"
            qty_d = _br_dec(qty) if qty else Decimal("1")
            total_d = _br_dec(total)
            desc_pct_d = _br_dec(desconto_pct)

            # supplier=SEGURADORA → fornecida pela HDI, zerar preços (mesma regra do Cilia)
            if supplier == "SEGURADORA":
                pb.items.append(ParsedItemDTO(
                    item_type="PART",
                    description=description.strip(),
                    external_code=partnumber.strip(),
                    supplier=supplier,
                    quantity=qty_d,
                    unit_price=Decimal("0"),
                    discount_pct=Decimal("0"),
                    net_price=Decimal("0"),
                    payer_block="SEGURADORA",
                ))
            else:
                # Peça oficina: total = (unit × qty); desconto já incluso no Total?
                # HDI: Total é o valor BRUTO; desconto é pct separado.
                net = total_d * (Decimal("1") - desc_pct_d / 100)
                pb.items.append(ParsedItemDTO(
                    item_type="PART",
                    description=description.strip(),
                    external_code=partnumber.strip(),
                    supplier=supplier,
                    quantity=qty_d,
                    unit_price=total_d / qty_d if qty_d > 0 else total_d,
                    discount_pct=desc_pct_d,
                    net_price=net,
                    payer_block="SEGURADORA",
                ))

    @classmethod
    def _parse_workforce_summary(cls, pb: ParsedBudget, table_html: str) -> None:
        """Tabela 8: linha 'Qtd. hora' + linha 'Vlr. hora' + linha 'Total'.

        Gera 1 SERVICE por categoria (funilaria, pintura, etc.) com qty × rate.
        """
        rows = cls._extract_rows(table_html)
        if len(rows) < 3:
            return
        # Header: Funilaria, Tap./Vidracaria, Eletrica, Mecanica, Pintura, Recuperacao, Total
        headers = rows[0]
        # Linha "Qtd. hora": [Qtd. hora, h_fun, h_tap, h_ele, h_mec, h_pin, h_rec, total_h]
        qtd_row = rows[1]
        # Linha "Vlr. hora": [Vlr. hora (R$), v_fun, v_tap, v_ele, v_mec, v_pin, v_rec, ""]
        vlr_row = rows[2]

        if len(qtd_row) < 7 or len(vlr_row) < 7:
            return
        # Pula primeira coluna (label) e última (total)
        for i, label in enumerate(headers[:-1]):  # ignora "Total"
            try:
                qty = _br_dec(qtd_row[i + 1])
                rate = _br_dec(vlr_row[i + 1])
            except IndexError:
                continue
            if qty <= 0 or rate <= 0:
                continue
            net = qty * rate
            pb.items.append(ParsedItemDTO(
                item_type="SERVICE",
                description=label.strip(),
                external_code=f"MO:{label.upper()}",
                part_type=label.strip().title(),
                supplier="OFICINA",
                quantity=qty,
                unit_price=rate,
                discount_pct=Decimal("0"),
                net_price=net,
                payer_block="SEGURADORA",
            ))

        # Tarifas
        pb.hourly_rates = {
            "FUNILARIA": str(_br_dec(vlr_row[1]) if len(vlr_row) > 1 else 0),
            "PINTURA": str(_br_dec(vlr_row[5]) if len(vlr_row) > 5 else 0),
            "REPARACAO": str(_br_dec(vlr_row[6]) if len(vlr_row) > 6 else 0),
        }

    @classmethod
    def _parse_additional_services(cls, pb: ParsedBudget, table_html: str) -> None:
        """Tabela 9: Serviços adicionais (Descrição, Valor)."""
        rows = cls._extract_rows(table_html)
        if not rows:
            return
        for row in rows[1:]:
            if len(row) < 2:
                continue
            desc, value = row[0], row[1]
            if desc.lower().startswith("total"):
                continue
            v = _br_dec(value)
            if v <= 0:
                continue
            pb.items.append(ParsedItemDTO(
                item_type="SERVICE",
                description=desc.strip(),
                external_code=f"ADD:{desc.upper()[:30]}",
                part_type="Serviço",
                supplier="OFICINA",
                quantity=Decimal("1"),
                unit_price=v,
                discount_pct=Decimal("0"),
                net_price=v,
                payer_block="SEGURADORA",
            ))

    @classmethod
    def _parse_resumo(cls, pb: ParsedBudget, table_html: str) -> None:
        """Tabela 10 (resumovalores): totais oficiais HDI pra reconciliação.

        Formato esperado:
            Serviços (Serviços adicionais + Mão de obra) 1.956,00
            Peças Oficina ( 0,00 - 0,00 ) 0,00
            Peças HDI ( 3.585,19 - 541,19 ) 3.044,00
            Franquia 0,00
            Avarias 0,00
            Total Orçamento 5.000,00
        """
        text = cls._flatten(table_html)
        # Captura "Serviços ... X,XX"
        m = re.search(r"Serviços[^0-9]*([\d\.]+,\d{2})", text)
        if m:
            pb.source_services_total = _br_dec(m.group(1))
        # Peças Oficina + Peças HDI = source_parts_total
        # DS Car cobra ambas (Oficina = compra direto, HDI = compra da seguradora com desconto)
        # Peças Oficina (X - Y) Z → pega o Z (líquido)
        oficina_m = re.search(r"Peças Oficina[^)]*\)\s*([\d\.]+,\d{2})", text)
        hdi_m = re.search(r"Peças HDI[^)]*\)\s*([\d\.]+,\d{2})", text)
        parts_total = Decimal("0")
        if oficina_m:
            parts_total += _br_dec(oficina_m.group(1))
        if hdi_m:
            parts_total += _br_dec(hdi_m.group(1))
        pb.source_parts_total = parts_total
        # Total Orçamento (verdade absoluta)
        m = re.search(r"Total Orçamento\s*([\d\.]+,\d{2})", text)
        if m:
            pb.source_grand_total = _br_dec(m.group(1))

    @classmethod
    def _parse_franquia(cls, pb: ParsedBudget, table_html: str) -> None:
        text = cls._flatten(table_html)
        m = re.search(r"Franquia\s+([\d\.,]+)", text)
        if m:
            pb.franchise_amount = _br_dec(m.group(1))

    @classmethod
    def _parse_pareceres(cls, pb: ParsedBudget, table_html: str) -> None:
        text = cls._flatten(table_html)
        # Tudo após "Parecer Usuario --> Data" é texto livre
        m = re.search(r"Parecer\s+Usuario\s*-->\s*Data\s+(.+)", text, re.DOTALL)
        if m:
            body = m.group(1).strip()
            if body:
                pb.pareceres.append(ParsedParecerDTO(
                    source="hdi",
                    parecer_type="AUTORIZADO",
                    body=body[:2000],
                ))
