"""Regras de transição do Kanban da OS.

15 estados conforme CLAUDE.md. Re-entrada em `budget` é permitida apenas a partir
dos estados de reparo (quando nova versão importada / complemento particular cria
pendência de aprovação). Reception NÃO pode ir direto para budget.
"""
from __future__ import annotations

from typing import Final


# Transições permitidas. `budget` pode ser origem E destino durante reparo (pausa).
# reception → budget NÃO existe: segue CLAUDE.md (reception → initial_survey → budget).
VALID_TRANSITIONS: Final[dict[str, list[str]]] = {
    "reception": ["initial_survey", "cancelled"],
    "initial_survey": ["budget"],
    "budget": ["waiting_parts", "repair"],
    "waiting_parts": ["repair"],
    "repair": ["mechanic", "bodywork", "polishing", "budget"],
    "mechanic": ["bodywork", "polishing", "budget"],
    "bodywork": ["painting", "budget"],
    "painting": ["assembly", "budget"],
    "assembly": ["polishing", "budget"],
    "polishing": ["washing", "budget"],
    "washing": ["final_survey", "budget"],
    "final_survey": ["ready"],
    "ready": ["delivered"],
    "delivered": [],
    "cancelled": [],
}


# Estados que capturam o `previous_status` da OS quando entram em `budget`
# (pra retomar depois de aprovação).
STATES_WITH_BUDGET_REENTRY: Final[set[str]] = {
    "repair", "mechanic", "bodywork", "painting",
    "assembly", "polishing", "washing",
}


def is_valid_transition(from_status: str, to_status: str) -> bool:
    """Retorna True se `from_status → to_status` é transição permitida."""
    return to_status in VALID_TRANSITIONS.get(from_status, [])


def allowed_transitions(from_status: str) -> list[str]:
    """Retorna estados permitidos a partir de `from_status`."""
    return VALID_TRANSITIONS.get(from_status, [])
