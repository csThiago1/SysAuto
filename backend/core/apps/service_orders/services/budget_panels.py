"""
Dicionário de peças do orçamento — texto de item de orçamento → chaves de peça do checklist.

Regras ficam em BudgetPanelRule (pattern já normalizado). Uma regra casa quando todos os
tokens do pattern estão na descrição; vale a de mais tokens, empate une as peças.
"""

from __future__ import annotations

import re
import unicodedata

from apps.service_orders.checklist_constants import PANEL_CHOICES

_TOKEN_MAP: dict[str, str] = {
    "DIANT": "DIANTEIRO",
    "DIANTEIRA": "DIANTEIRO",
    # "TRAS." do brief já chega aqui como "TRAS": a pontuação vira espaço antes.
    "TRAS": "TRASEIRO",
    "TRASEIRA": "TRASEIRO",
    "ESQ": "ESQUERDO",
    "ESQUERDA": "ESQUERDO",
    "DIR": "DIREITO",
    "DIREITA": "DIREITO",
    "LD": "DIREITO",
    "LE": "ESQUERDO",
}

_JOINS: tuple[tuple[str, str], ...] = (
    (r"\bPARA CHOQUE\b", "PARACHOQUE"),
    (r"\bPARA LAMA\b", "PARALAMA"),
)

_SYNONYMS: dict[str, str] = {
    "TAMPA TRASEIRO": "tampa_tras",
    "PORTA MALAS": "tampa_tras",
    "CAPO": "capo",
    "PARABRISA": "parabrisa",
    "VIDRO TRASEIRO": "vidro_tras",
    "FAROL ESQUERDO": "farol_e",
    "LANTERNA DIREITO": "lanterna_d",
    "RETROVISOR ESQUERDO": "retrovisor_e",
    "CACAMBA": "cacamba",
    "SOLEIRA ESQUERDO": "soleira_e",
    "GRADE": "grade",
}


def normalize_description(text: str) -> str:
    """Maiúsculas, sem acento, pontuação vira espaço, abreviações e gênero padronizados."""
    ascii_text = (
        unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").upper()
    )
    tokens = re.sub(r"[^A-Z0-9]+", " ", ascii_text).split()
    result = " ".join(_TOKEN_MAP.get(token, token) for token in tokens)
    for pattern, joined in _JOINS:
        result = re.sub(pattern, joined, result)
    return result


def panels_for_description(description: str, rules: list[tuple[str, list[str]]]) -> list[str]:
    """Peças da regra mais específica que casa com a descrição; empate une as peças."""
    tokens = set(normalize_description(description).split())
    best_size = 0
    panels: list[str] = []
    for pattern, keys in rules:
        pattern_tokens = set(pattern.split())
        if not pattern_tokens <= tokens or len(pattern_tokens) < best_size:
            continue
        if len(pattern_tokens) > best_size:
            best_size, panels = len(pattern_tokens), []
        panels += [key for key in keys if key not in panels]
    return panels


def seed_rules() -> list[tuple[str, list[str]]]:
    """Regras do seed: uma por peça (rótulo normalizado) mais os sinônimos."""
    seeded: dict[str, list[str]] = {}
    for pattern, key in [
        *((normalize_description(label), key) for key, label in PANEL_CHOICES),
        *_SYNONYMS.items(),
    ]:
        keys = seeded.setdefault(pattern, [])
        if key not in keys:
            keys.append(key)
    return list(seeded.items())
