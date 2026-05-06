"""Parser do payload JSON da Cilia → `ParsedBudget` DTO.

Mapeamentos principais:
    - `insurer.trade` → nosso `Insurer.code` (catálogo interno)
    - `budgetings[]` → lista de `ParsedItemDTO` com operations inferidas
    - `conclusion` → `ParsedParecerDTO` (1 por versão)
    - `totals.franchise` → `ParsedBudget.franchise_amount`
    - `standard_labor` → `hourly_rates` dict

Referência do schema: `docs/superpowers/plans/2026-04-21-ciclo-04-importador-cilia.md` + fixtures reais.
"""
from __future__ import annotations

import hashlib
import json
from decimal import Decimal
from typing import Any

from apps.cilia.dtos import (
    ParsedBudget,
    ParsedItemDTO,
    ParsedParecerDTO,
)


# Mapeamento Cilia `insurer.trade` → nosso `Insurer.code`.
# Chave é o texto exato que a Cilia retorna no campo `insurer.trade`.
INSURER_TRADE_TO_CODE: dict[str, str] = {
    "Yelum Seguradora": "yelum",
    "Tokio Marine": "tokio",
    "Porto Seguro": "porto",
    "Azul Seguros": "azul",
    "Itaú Seguros": "itau",
    "HDI Seguros": "hdi",
    "Mapfre": "mapfre",
    "Bradesco Seguros": "bradesco",
    "Allianz": "allianz",
    "Suhai": "suhai",
}


# Mapeamento status Cilia (11 valores documentados) → nossos 5 status internos.
CILIA_STATUS_TO_INTERNAL: dict[str, str] = {
    "created": "analisado",
    "analyzing": "em_analise",
    "with_expert": "em_analise",
    "budgeting": "analisado",
    "ready_for_analysis": "analisado",
    "with_analyst": "em_analise",
    "analyzed": "analisado",
    "distributed": "autorizado",
    "done": "autorizado",
    "refused": "negado",
    "finalized": "autorizado",
}


# Mapeamento `conclusion.key` (5 valores) → nosso `parecer_type`.
CILIA_CONCLUSION_KEY_TO_PARECER: dict[str, str] = {
    "authorized": "AUTORIZADO",
    "not_authorized": "NEGADO",
    "refused": "NEGADO",
    "supplement": "CORRECAO",
    "pending": "COMENTARIO_INTERNO",
}


# Mapeamento `remove_install_type` Cilia → nosso `LaborCategory.code`.
CILIA_LABOR_TYPE_TO_CATEGORY: dict[str, str] = {
    "tapestry": "TAPECARIA",
    "mechanic": "MECANICA",
    "auto_body": "FUNILARIA",
    "electrical": "ELETRICA",
    "glazing": "VIDRACARIA",
}


# Mapeamento `vehicle_piece_type` → nosso `part_type`.
CILIA_PIECE_TYPE_TO_PART: dict[str, str] = {
    "genuine": "GENUINA",
    "original": "ORIGINAL",
    "other_sources": "OUTRAS_FONTES",
    "green": "VERDE",
}


class CiliaParser:
    """Converte payload JSON da Cilia em `ParsedBudget` DTO."""

    @classmethod
    def parse(cls, payload: dict[str, Any]) -> ParsedBudget:
        """Mapeia o payload completo da Cilia para `ParsedBudget`.

        Args:
            payload: dict retornado pela rota
                GET /api/integration/insurer_budgets/by_casualty_number_and_budget_number

        Returns:
            ParsedBudget com todos os campos populados + items + pareceres + snapshot.
        """
        pb = ParsedBudget(source="cilia")

        # --- Identificação ---
        pb.external_budget_id = payload.get("budget_id")
        pb.external_version_id = payload.get("budget_version_id")
        pb.external_budget_number = str(payload.get("budget_number", ""))
        version_num = payload.get("version_number", 1)
        pb.external_version = f"{pb.external_budget_number}.{version_num}"
        pb.casualty_number = str(payload.get("casualty_number", ""))
        pb.external_status = CILIA_STATUS_TO_INTERNAL.get(
            payload.get("status", ""), "analisado",
        )
        conclusion_raw = payload.get("conclusion") or {}
        pb.external_flow_number = conclusion_raw.get("flow_number")

        # --- Cliente ---
        client = payload.get("client") or {}
        pb.segurado_name = client.get("name") or ""
        pb.segurado_cpf = client.get("document_identifier") or ""
        pb.segurado_email = client.get("email") or ""
        phone = client.get("phone") or {}
        ddd = phone.get("ddd") or ""
        number = phone.get("number") or ""
        pb.segurado_phone = f"{ddd}{number}".strip()

        # --- Veículo ---
        vehicle = payload.get("vehicle") or {}
        pb.vehicle_plate = (vehicle.get("license_plate") or "").upper()
        pb.vehicle_description = cls._build_vehicle_description(vehicle)
        pb.vehicle_chassis = vehicle.get("body") or ""
        pb.vehicle_color = vehicle.get("color") or ""
        pb.vehicle_km = str(vehicle.get("mileage") or "")
        pb.vehicle_year = vehicle.get("model_year")
        pb.vehicle_brand = vehicle.get("brand") or ""

        # --- Seguradora ---
        insurer = payload.get("insurer") or {}
        trade = insurer.get("trade") or ""
        pb.insurer_code = INSURER_TRADE_TO_CODE.get(trade, "")

        # --- Financeiro ---
        totals = payload.get("totals") or {}
        pb.franchise_amount = cls._dec(totals.get("franchise", 0))

        # Tabela de MO (standard_labor)
        labor = payload.get("standard_labor") or {}
        pb.hourly_rates = {
            "FUNILARIA": str(labor.get("workforce_cost", 0)),
            "PINTURA": str(labor.get("paint_cost", 0)),
            "PINTURA_TRICOAT": str(labor.get("paint_tricoat_cost", 0)),
            "REPARACAO": str(labor.get("repair_cost", 0)),
            "MECANICA": str(labor.get("workforce_cost", 0)),
            "ELETRICA": str(labor.get("workforce_cost", 0)),
            "TAPECARIA": str(labor.get("workforce_cost", 0)),
        }
        pb.global_discount_pct = cls._dec(labor.get("discount", 0))

        # --- Items ---
        # Cada budgeting pode gerar 0-1 PART (se troca) + N SERVICE (1 por operação)
        # IMPORTANTE: remove_install_hours por item pode incluir horas de
        # desmontagem para pintar/reparar (double-counting). O Cilia calcula
        # total_remove_install_hours separadamente (sem overlap). Usamos um fator
        # de correção para que a soma bata com o total do Cilia.
        raw_ri_sum = sum(
            cls._dec(e.get("remove_install_hours", 0))
            for e in (payload.get("budgetings") or [])
        )
        cilia_ri_total = cls._dec(totals.get("total_remove_install_hours", 0))
        ri_correction = (
            cilia_ri_total / raw_ri_sum
            if raw_ri_sum > 0
            else Decimal("1")
        )

        for entry in payload.get("budgetings") or []:
            pb.items.extend(cls._parse_budgeting(entry, pb.hourly_rates, ri_correction))

        # --- Parecer / conclusion (1 por versão) ---
        if conclusion_raw:
            pb.pareceres.append(cls._parse_conclusion(conclusion_raw))

        # --- Snapshot completo ---
        pb.raw_payload = payload
        pb.raw_hash = cls._compute_hash(payload)

        # --- Report Cilia oficial (base64) ---
        pb.report_pdf_base64 = payload.get("report_pdf") or ""
        pb.report_html_base64 = payload.get("report_html") or ""

        return pb

    # ── Mapeamento operação → label em português ────────────────────────
    OP_LABELS: dict[str, str] = {
        "R_I": "Remoção e Instalação",
        "PINTURA": "Pintura",
        "RECUPERACAO": "Reparação",
    }

    # ------------------------------------------------------------------ helpers
    @classmethod
    def _parse_budgeting(
        cls,
        entry: dict[str, Any],
        hourly_rates: dict[str, str],
        ri_correction: Decimal = Decimal("1"),
    ) -> list[ParsedItemDTO]:
        """Converte um `budgetings[]` em N ParsedItemDTOs.

        Lógica do centro automotivo:
        - exchange_used=True → 1 item PART com preço da peça (desconto aplicado)
        - Cada operação com horas > 0 (R&I, pintura, reparação) → 1 item SERVICE
          separado, com horas × tarifa.
        - R&I usa ri_correction para corrigir double-counting de horas
          (remove_install_hours por item pode incluir horas de pintura/reparo).
        - Itens sem troca e sem horas → 1 item SERVICE com selling_cost fixo
        """
        items: list[ParsedItemDTO] = []

        # Dados comuns
        budgeting_type = entry.get("budgeting_type", "impact")
        bucket = {
            "impact": "IMPACTO",
            "without_coverage": "SEM_COBERTURA",
            "estimated": "SOB_ANALISE",
        }.get(budgeting_type, "IMPACTO")
        supplier = "OFICINA" if entry.get("supplier_type") == "workshop" else "SEGURADORA"
        external_code = (entry.get("code") or "").strip()
        description = entry.get("name", "")
        impact_area = entry.get("impact_area")
        is_manual = bool(entry.get("inclusion_manual", False))

        part_type = CILIA_PIECE_TYPE_TO_PART.get(
            entry.get("vehicle_piece_type", ""), "",
        )

        # ── 1. PEÇA (troca) ──────────────────────────────────────────────
        if entry.get("exchange_used"):
            piece_price = cls._dec(entry.get("piece_selling_cost", 0))
            piece_final = cls._dec(entry.get("piece_selling_cost_final", 0))
            discount_pct = cls._dec(entry.get("piece_discount_percentage", 0))

            items.append(ParsedItemDTO(
                bucket=bucket,
                payer_block="SEGURADORA",
                impact_area=impact_area,
                item_type="PART",
                description=description,
                external_code=external_code,
                part_type=part_type,
                supplier=supplier,
                quantity=cls._dec(entry.get("quantity", 1)),
                unit_price=piece_price,
                discount_pct=discount_pct,
                net_price=piece_final if piece_final else piece_price,
                flag_inclusao_manual=is_manual,
            ))

        # ── 2. SERVIÇOS (uma linha por operação) ─────────────────────────
        # Tarifas
        workforce_rate = cls._dec(hourly_rates.get("FUNILARIA", "0"))
        paint_rate = cls._dec(hourly_rates.get("PINTURA", "0"))
        repair_rate = cls._dec(hourly_rates.get("REPARACAO", "0"))

        # R&I hours corrigidas pelo fator proporcional (evita double-counting)
        raw_ri = cls._dec(entry.get("remove_install_hours", 0))
        corrected_ri = (raw_ri * ri_correction).quantize(Decimal("0.01"))

        operations = [
            ("R_I", corrected_ri, workforce_rate),
            ("PINTURA", cls._dec(entry.get("paint_hours", 0)), paint_rate),
            ("RECUPERACAO", cls._dec(entry.get("repair_hours", 0)), repair_rate),
        ]

        for op_type, hours, rate in operations:
            if hours > 0:
                op_label = cls.OP_LABELS.get(op_type, op_type)
                items.append(ParsedItemDTO(
                    bucket=bucket,
                    payer_block="SEGURADORA",
                    impact_area=impact_area,
                    item_type="SERVICE",
                    description=description,
                    external_code=f"{op_type}:{external_code}",
                    part_type=op_label,  # reutilizamos part_type p/ guardar o tipo de serviço
                    supplier=supplier,
                    quantity=hours,
                    unit_price=rate,
                    discount_pct=Decimal("0"),
                    net_price=hours * rate,
                    flag_inclusao_manual=is_manual,
                ))

        # ── 3. Serviço com valor fixo (sem horas, sem troca) ─────────────
        has_labor = any(h > 0 for _, h, _ in operations)
        if not entry.get("exchange_used") and not has_labor:
            selling_cost = cls._dec(entry.get("selling_cost", 0))
            if selling_cost > 0:
                items.append(ParsedItemDTO(
                    bucket=bucket,
                    payer_block="SEGURADORA",
                    impact_area=impact_area,
                    item_type="SERVICE",
                    description=description,
                    external_code=external_code,
                    part_type="Serviço",
                    supplier=supplier,
                    quantity=Decimal("1"),
                    unit_price=selling_cost,
                    discount_pct=Decimal("0"),
                    net_price=selling_cost,
                    flag_inclusao_manual=is_manual,
                ))

        return items

    @classmethod
    def _parse_conclusion(cls, conclusion: dict[str, Any]) -> ParsedParecerDTO:
        """Converte `conclusion` em `ParsedParecerDTO`."""
        return ParsedParecerDTO(
            source="cilia",
            flow_number=conclusion.get("flow_number"),
            author_external=(conclusion.get("author_name") or "").strip(),
            author_document=conclusion.get("author_document_identifier") or "",
            parecer_type=CILIA_CONCLUSION_KEY_TO_PARECER.get(
                conclusion.get("key", ""), "COMENTARIO_INTERNO",
            ),
            body=conclusion.get("description") or "",
            created_at_external=conclusion.get("created_at"),
        )

    @staticmethod
    def _build_vehicle_description(vehicle: dict[str, Any]) -> str:
        """Concatena brand + model + year + color em string legível."""
        brand = vehicle.get("brand") or ""
        model = vehicle.get("model") or ""
        year = vehicle.get("model_year")
        color = vehicle.get("color") or ""
        parts = [p for p in [brand, model, str(year) if year else "", color] if p]
        return " ".join(parts).strip()

    @staticmethod
    def _dec(value: Any) -> Decimal:
        """Conversão segura para Decimal. Retorna Decimal('0') em falha."""
        if value is None or value == "":
            return Decimal("0")
        try:
            return Decimal(str(value))
        except Exception:
            return Decimal("0")

    @staticmethod
    def _compute_hash(payload: dict[str, Any]) -> str:
        """SHA256 do payload normalizado.

        **Exclui `report_html` e `report_pdf`** — esses campos podem variar
        entre chamadas sem mudança semântica (ex: Cilia regenera PDF com
        timestamp diferente). O hash só deve mudar quando a versão muda de
        fato (itens, totais, conclusion, etc.).
        """
        canonical = {
            k: v for k, v in payload.items()
            if k not in ("report_html", "report_pdf")
        }
        serialized = json.dumps(canonical, sort_keys=True, ensure_ascii=False, default=str)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
