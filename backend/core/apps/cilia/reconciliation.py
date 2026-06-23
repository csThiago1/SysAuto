"""Reconciliação entre items do parser e totais oficiais da fonte.

Política: se o total do parser (soma de items) divergir dos totais oficiais
(Cilia/IFX/HDI) por mais que TOLERANCE, o backend NÃO cria a ServiceOrderVersion.
Retorna `action="reconcile"` pra o frontend mostrar tela de conciliação
manual antes de aplicar.

Critério aplicado: peças workshop + serviços = total Cilia ±R$ 0,10.
Peças supplier=insurer NÃO entram no comparativo (DS Car não cobra delas).
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from decimal import Decimal
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.cilia.dtos import ParsedBudget, ParsedItemDTO


# R$ 0,10 — qualquer divergência acima exige conciliação manual.
TOLERANCE = Decimal("0.10")


@dataclass
class ReconciliationState:
    """Estado da reconciliação após parse."""

    # Totais calculados pelo parser (soma dos items)
    parser_parts: Decimal = Decimal("0")
    parser_services: Decimal = Decimal("0")
    parser_grand_total: Decimal = Decimal("0")

    # Totais oficiais da fonte (Cilia/IFX/HDI)
    source_parts: Decimal = Decimal("0")
    source_services: Decimal = Decimal("0")
    source_grand_total: Decimal = Decimal("0")

    # Diffs (parser - source)
    parts_diff: Decimal = Decimal("0")
    services_diff: Decimal = Decimal("0")
    grand_diff: Decimal = Decimal("0")

    # True quando |diffs| > TOLERANCE em qualquer categoria
    needs_reconciliation: bool = False

    def to_dict(self) -> dict:
        d = asdict(self)
        # Converte Decimal pra string com 2 casas
        for k, v in d.items():
            if isinstance(v, Decimal):
                d[k] = f"{v:.2f}"
        return d


def compute_reconciliation_state(parsed: "ParsedBudget") -> ReconciliationState:
    """Calcula os diffs do parser vs totais oficiais da fonte.

    Considera apenas:
    - PART items com supplier=OFICINA (peças supplier=SEGURADORA já zeradas)
    - SERVICE items (todos)

    Peças do insurer não entram porque DS Car não cobra delas. O
    source_parts_total já foi ajustado pelo parser pra subtrair essas peças
    (ver CiliaParser._populate_totals).
    """
    state = ReconciliationState()

    for item in parsed.items:
        if item.item_type == "PART":
            state.parser_parts += item.net_price
        elif item.item_type == "SERVICE":
            state.parser_services += item.net_price

    state.parser_grand_total = state.parser_parts + state.parser_services

    state.source_parts = parsed.source_parts_total or Decimal("0")
    state.source_services = parsed.source_services_total or Decimal("0")
    state.source_grand_total = (
        parsed.source_grand_total
        if parsed.source_grand_total
        else state.source_parts + state.source_services
    )

    state.parts_diff = state.parser_parts - state.source_parts
    state.services_diff = state.parser_services - state.source_services
    state.grand_diff = state.parser_grand_total - state.source_grand_total

    state.needs_reconciliation = (
        abs(state.parts_diff) > TOLERANCE
        or abs(state.services_diff) > TOLERANCE
        or abs(state.grand_diff) > TOLERANCE
    )
    return state


def serialize_items_for_reconciliation(items: list["ParsedItemDTO"]) -> list[dict]:
    """Serializa items pra resposta de reconciliação no frontend.

    Inclui campos editáveis (quantity, unit_price, net_price) + identidade.
    """
    return [
        {
            "index": i,
            "item_type": item.item_type,
            "description": item.description,
            "external_code": item.external_code,
            "part_type": item.part_type,
            "supplier": item.supplier,
            "quantity": f"{item.quantity:.2f}",
            "unit_price": f"{item.unit_price:.2f}",
            "discount_pct": f"{item.discount_pct:.2f}",
            "net_price": f"{item.net_price:.2f}",
            "flag_inclusao_manual": item.flag_inclusao_manual,
        }
        for i, item in enumerate(items)
    ]
