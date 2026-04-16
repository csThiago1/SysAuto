"""
Utilitários de normalização para o vehicle_catalog.
normalizar_texto() é usada no sync FIPE e no motor de aliases (MO-2).
"""
import unicodedata


# Abreviações conhecidas: chave=variação → valor=canonical
ABREVIACOES: dict[str, str] = {
    "vw": "volkswagen",
    "volks": "volkswagen",
    "gm": "chevrolet",
    "bmw": "bmw",
    "mb": "mercedes-benz",
    "merc": "mercedes-benz",
    "ford": "ford",
    "toyota": "toyota",
    "honda": "honda",
    "hyundai": "hyundai",
    "kia": "kia",
    "renault": "renault",
    "peugeot": "peugeot",
    "citroen": "citroen",
    "fiat": "fiat",
    "nissan": "nissan",
    "mitsubishi": "mitsubishi",
    "subaru": "subaru",
    "audi": "audi",
    "porsche": "porsche",
    "ferrari": "ferrari",
    "lamborghini": "lamborghini",
    "maserati": "maserati",
    "alfa": "alfa romeo",
    "jeep": "jeep",
    "dodge": "dodge",
    "ram": "ram",
}


def normalizar_texto(texto: str) -> str:
    """Normaliza texto para comparação fuzzy/alias.

    1. Remove acentos (NFD decomposition)
    2. Converte para lowercase
    3. Remove caracteres não-alfanuméricos exceto espaços
    4. Aplica abreviações conhecidas

    Args:
        texto: Texto original (ex: "Volkswagen", "VW", "Mercedes-Benz")

    Returns:
        Texto normalizado (ex: "volkswagen", "volkswagen", "mercedes benz")
    """
    # Remover acentos
    sem_acentos = unicodedata.normalize("NFD", texto)
    sem_acentos = "".join(
        c for c in sem_acentos if unicodedata.category(c) != "Mn"
    )
    # Lowercase e remoção de não-alfanuméricos (exceto espaço)
    normalizado = "".join(
        c if c.isalnum() or c == " " else " "
        for c in sem_acentos.lower()
    ).strip()
    # Colapsar múltiplos espaços
    normalizado = " ".join(normalizado.split())
    # Aplicar abreviações
    return ABREVIACOES.get(normalizado, normalizado)
