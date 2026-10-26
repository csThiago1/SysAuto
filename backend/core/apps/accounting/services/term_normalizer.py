"""
Paddock Solutions — Accounting: normalização de termos para sugestão de conta.

A MESMA função é usada na gravação e na consulta das regras. Se divergirem,
o cache nunca acerta e a LLM é chamada para sempre.
"""

import re
import unicodedata

_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def normalize_term(description: str) -> str:
    """
    Normaliza uma descrição livre para servir de chave de cache.

    Minúscula, sem acento, sem pontuação, espaços colapsados.
    "Tesoura  Grande!" e "tesoura grande" caem no mesmo termo.

    Args:
        description: Descrição digitada pelo usuário.

    Returns:
        Termo normalizado, ou string vazia se nada sobrar.
    """
    if not description:
        return ""
    lowered = description.strip().lower()
    without_accents = "".join(
        char for char in unicodedata.normalize("NFD", lowered) if unicodedata.category(char) != "Mn"
    )
    return _NON_ALNUM.sub(" ", without_accents).strip()
