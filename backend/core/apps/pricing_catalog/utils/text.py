"""
Paddock Solutions — Pricing Catalog — Utilitários de Texto
Motor de Orçamentos (MO) — Sprint 02: Catálogo Técnico

Funções de normalização de texto para uso no AliasMatcher e geração de
texto_normalizado nos aliases.
"""
import re
import unicodedata

ABREVIACOES: list[tuple[str, str]] = [
    (r"\bp/choque\b", "para-choque"),
    (r"\bpara-choques?\b", "para-choque"),
    (r"\bdiant\b", "dianteiro"),
    (r"\btraz\b", "traseiro"),
    (r"\bs/pint(?:ura)?\b", "sem pintura"),
    (r"\bc/pint(?:ura)?\b", "com pintura"),
    (r"\bpint\b", "pintura"),
    (r"\bdto\b", "direito"),
    (r"\besq\b", "esquerdo"),
    (r"\bsubst\b", "substituicao"),
    (r"\brepos\b", "reposicao"),
    (r"\binst\b", "instalacao"),
    (r"\brem\b", "remocao"),
    (r"\brev\b", "revisao"),
    (r"\blat\b", "lateral"),
    (r"\bfrt\b", "frontal"),
    (r"\btras\b", "traseiro"),
    (r"\bcap\b", "capo"),
    (r"\bpara-lamas?\b", "paralama"),
    (r"\bpara lamas?\b", "paralama"),
]


def normalizar_texto(s: str) -> str:
    """
    Normaliza um texto para uso em busca fuzzy e indexação de aliases.

    Passos aplicados em ordem:
    1. Converte para lowercase.
    2. Remove acentos (NFD → mantém apenas caracteres sem Mn).
    3. Colapsa espaços múltiplos.
    4. Expande abreviações via regex (ABREVIACOES).
    5. Remove pontuação exceto hífen e barra.
    6. Colapsa espaços novamente e faz strip final.

    Args:
        s: Texto de entrada (qualquer forma).

    Returns:
        Texto normalizado pronto para indexação ou comparação.
    """
    # 1. lower
    s = s.lower()
    # 2. strip acentos
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    # 3. colapsa espaços
    s = re.sub(r"\s+", " ", s).strip()
    # 4. expande abreviações
    for pattern, replacement in ABREVIACOES:
        s = re.sub(pattern, replacement, s)
    # 5. remove pontuação exceto - e /
    s = re.sub(r"[^\w\s\-/]", " ", s)
    # 6. colapsa espaços novamente + strip
    s = re.sub(r"\s+", " ", s).strip()
    return s
