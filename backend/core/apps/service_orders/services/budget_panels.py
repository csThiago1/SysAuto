"""
Dicionário de peças do orçamento — texto de item de orçamento → chaves de peça do checklist.

Regras ficam em BudgetPanelRule (pattern já normalizado). Uma regra casa quando todos os
tokens do pattern estão na descrição. Vale a união das regras que casam, menos as contidas
numa regra maior que também casa ("PORTA" cede a "PORTA DIANTEIRO ESQUERDO"). Assim uma
descrição com duas peças ("SOLEIRA PORTA TRAS ESQ") devolve as duas.
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

# Regras sem peça: descrição reconhecida que NÃO é peça do checklist. Por conterem a regra
# genérica ("FAROL ESQUERDO"), a anulam; o item cai em "não mapeado" para ligação manual.
_NOT_A_PANEL: tuple[str, ...] = ("FAROL MILHA ESQUERDO", "FAROL MILHA DIREITO")


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
    """União das peças das regras que casam, descartando regra contida em outra que casa."""
    tokens = set(normalize_description(description).split())
    matched = [(set(pattern.split()), keys) for pattern, keys in rules]
    matched = [
        (pattern_tokens, keys) for pattern_tokens, keys in matched if pattern_tokens <= tokens
    ]
    panels: list[str] = []
    for pattern_tokens, keys in matched:
        if any(pattern_tokens < other for other, _ in matched):
            continue
        panels += [key for key in keys if key not in panels]
    return panels


def seed_rules() -> list[tuple[str, list[str]]]:
    """Regras do seed: uma por peça (rótulo normalizado), os sinônimos e as regras sem peça."""
    seeded: dict[str, list[str]] = {pattern: [] for pattern in _NOT_A_PANEL}
    for pattern, key in [
        *((normalize_description(label), key) for key, label in PANEL_CHOICES),
        *_SYNONYMS.items(),
    ]:
        keys = seeded.setdefault(pattern, [])
        if key not in keys:
            keys.append(key)
    return list(seeded.items())
