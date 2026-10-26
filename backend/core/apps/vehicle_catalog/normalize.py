"""
Normalização de texto e enums do catálogo de veículos (marca, tipo, cor, combustível).
"""

import re
import unicodedata

from django.db.models import TextChoices


def normalize_name(text: str) -> str:
    """Maiúsculas, sem acento (NFKD), espaços colapsados. Mantém pontuação."""
    decomposed = unicodedata.normalize("NFKD", text)
    no_accents = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(no_accents.upper().split())


class TipoVeiculo(TextChoices):
    CARRO = "carro", "Carro"
    MOTO = "moto", "Moto"
    CAMINHAO = "caminhao", "Caminhão/ônibus"


TIPO_FROM_FIPEX: dict[str, TipoVeiculo] = {
    "carro": TipoVeiculo.CARRO,
    "moto": TipoVeiculo.MOTO,
    "caminhão": TipoVeiculo.CAMINHAO,
}


class Combustivel(TextChoices):
    GASOLINA = "gasolina", "Gasolina"
    ETANOL = "etanol", "Etanol"
    FLEX = "flex", "Flex"
    DIESEL = "diesel", "Diesel"
    ELETRICO = "eletrico", "Elétrico"
    HIBRIDO = "hibrido", "Híbrido"
    GNV = "gnv", "GNV"


COMBUSTIVEL_FROM_SIGLA: dict[str, Combustivel] = {
    "g": Combustivel.GASOLINA,
    "e": Combustivel.ETANOL,
    "f": Combustivel.FLEX,
    "d": Combustivel.DIESEL,
    "l": Combustivel.ELETRICO,
    "h": Combustivel.HIBRIDO,
    "n": Combustivel.GNV,
}


class CorVeiculo(TextChoices):
    AMARELA = "AMARELA", "Amarela"
    AZUL = "AZUL", "Azul"
    BEGE = "BEGE", "Bege"
    BRANCA = "BRANCA", "Branca"
    CINZA = "CINZA", "Cinza"
    DOURADA = "DOURADA", "Dourada"
    GRENA = "GRENA", "Grená"
    LARANJA = "LARANJA", "Laranja"
    MARROM = "MARROM", "Marrom"
    PRATA = "PRATA", "Prata"
    PRETA = "PRETA", "Preta"
    ROSA = "ROSA", "Rosa"
    ROXA = "ROXA", "Roxa"
    VERDE = "VERDE", "Verde"
    VERMELHA = "VERMELHA", "Vermelha"
    FANTASIA = "FANTASIA", "Fantasia"
    NAO_INFORMADA = "NAO_INFORMADA", "Não informada"


COR_HEX: dict[str, str] = {
    CorVeiculo.AMARELA: "#F2C200",
    CorVeiculo.AZUL: "#1F4E9C",
    CorVeiculo.BEGE: "#D8C3A0",
    CorVeiculo.BRANCA: "#F5F5F5",
    CorVeiculo.CINZA: "#6E6E6E",
    CorVeiculo.DOURADA: "#C9A43B",
    CorVeiculo.GRENA: "#6D1A2B",
    CorVeiculo.LARANJA: "#E46A1B",
    CorVeiculo.MARROM: "#5C3A21",
    CorVeiculo.PRATA: "#BFC1C2",
    CorVeiculo.PRETA: "#111111",
    CorVeiculo.ROSA: "#E68AAE",
    CorVeiculo.ROXA: "#5B2A86",
    CorVeiculo.VERDE: "#2E6B3A",
    CorVeiculo.VERMELHA: "#B3141C",
    CorVeiculo.FANTASIA: "",
    CorVeiculo.NAO_INFORMADA: "",
}

MAKE_DISPLAY: dict[str, str] = {
    "GM - CHEVROLET": "Chevrolet",
    "VW - VOLKSWAGEN": "Volkswagen",
    "KIA MOTORS": "Kia",
    "CAOA CHERY/CHERY": "Chery",
    # Siglas que o title-case estragaria (vistas na carga fipeX 2026-10)
    "CFMOTO": "CFMoto",
    "DFSK": "DFSK",
    "EFFA-JMC": "Effa-JMC",
    "MV AGUSTA": "MV Agusta",
    "SSANGYONG": "SsangYong",
}

BRAND_ALIASES: dict[str, str] = {
    "VW": "VOLKSWAGEN",
    "GM": "CHEVROLET",
    "CHEV": "CHEVROLET",
    "M.BENZ": "MERCEDES-BENZ",
    "M BENZ": "MERCEDES-BENZ",
    "MB": "MERCEDES-BENZ",
    "MERCEDES": "MERCEDES-BENZ",
    "MERCEDES BENZ": "MERCEDES-BENZ",
    "LR": "LAND ROVER",
}


def make_display_name(fipe_nome: str) -> str:
    """Nome de exibição da montadora a partir do nome da FIPE."""
    nome = fipe_nome.strip()
    mapped = MAKE_DISPLAY.get(normalize_name(nome))
    if mapped:
        return mapped
    if nome.isupper() and sum(c.isalpha() for c in nome) > 3:
        return nome.title()
    return nome


def canonical_brand(text: str) -> str:
    """Nome normalizado de exibição da montadora, resolvendo apelidos (VW, GM, M.BENZ...)."""
    return BRAND_ALIASES.get(normalize_name(text)) or normalize_name(make_display_name(text))


COLOR_SUFFIXES = {
    "METALICO",
    "METALICA",
    "PEROLIZADO",
    "PEROLIZADA",
    "PEROLA",
    "SOLIDO",
    "SOLIDA",
    "FOSCO",
}
COLOR_EQUIV: dict[str, str] = {
    "PRTA": "PRETA",
    "PRETRA": "PRETA",
    "GRAFITE": "CINZA",
    "CHUMBO": "CINZA",
    "VINHO": "GRENA",
    "BORDO": "GRENA",
    "CHAMPAGNE": "BEGE",
}
COLOR_FEMININE: dict[str, str] = {
    "PRETO": "PRETA",
    "BRANCO": "BRANCA",
    "VERMELHO": "VERMELHA",
    "AMARELO": "AMARELA",
    "ROXO": "ROXA",
    "DOURADO": "DOURADA",
}


def match_color(text: str) -> str | None:
    """Valor de CorVeiculo para um texto livre de cor, ou None se não casar."""
    n = normalize_name(text).lstrip("-")
    n = " ".join(t for t in n.split() if t not in COLOR_SUFFIXES)
    n = COLOR_EQUIV.get(n, n)
    n = COLOR_FEMININE.get(n, n)
    return n if n in CorVeiculo.values else None


FUEL_WORDS: dict[str, Combustivel] = {
    "GASOLINA": Combustivel.GASOLINA,
    "ALCOOL": Combustivel.ETANOL,
    "ETANOL": Combustivel.ETANOL,
    "FLEX": Combustivel.FLEX,
    "FLEXONE": Combustivel.FLEX,
    "FLEXFUEL": Combustivel.FLEX,
    "DIESEL": Combustivel.DIESEL,
    "DIE": Combustivel.DIESEL,
    "GNV": Combustivel.GNV,
    "HIBRIDO": Combustivel.HIBRIDO,
    "HYBRID": Combustivel.HIBRIDO,
    "ELETRICO": Combustivel.ELETRICO,
}
FLEX_COMBOS = re.compile(r"GASOLINA\s*/\s*ALCOOL|ALCOOL\s*/\s*GASOLINA|TOTAL FLEX")


def match_fuel(text: str) -> str | None:
    """Valor de Combustivel para um texto livre, ou None se não casar.

    Sigla de uma letra só vale quando é o texto inteiro ("G"); dentro de texto maior
    ("CLASSE E 250") nunca vira pista.
    """
    n = normalize_name(text)
    if FLEX_COMBOS.search(n):
        return Combustivel.FLEX.value
    tokens = re.sub(r"[^\w\s]", " ", n).split()
    if len(tokens) == 1 and len(tokens[0]) == 1:
        sigla = COMBUSTIVEL_FROM_SIGLA.get(tokens[0].lower())
        return sigla.value if sigla else None
    for tok in tokens:
        if tok in FUEL_WORDS:
            return FUEL_WORDS[tok].value
    return None
