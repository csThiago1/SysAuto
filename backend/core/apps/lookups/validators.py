"""
Validadores puros de documento e veículo: CPF, CNPJ (alfanumérico), placa, RENAVAM e chassi.
"""

import re
from datetime import date
from typing import NamedTuple

_CNPJ_RE = re.compile(r"^[0-9A-Z]{12}[0-9]{2}$")
_PLATE_RE = re.compile(r"^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$")
_VIN_RE = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$")
_CNPJ_WEIGHTS = (5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)
_RENAVAM_WEIGHTS = (2, 3, 4, 5, 6, 7, 8, 9, 2, 3)
# Ciclo de 30 anos do 10º caractere do VIN: A=1980 … 9=2009, A=2010 …
_VIN_YEAR_CODES = "ABCDEFGHJKLMNPRSTVWXY123456789"

WMI_MAKES: dict[str, str] = {
    "9BW": "VOLKSWAGEN",
    "9BG": "CHEVROLET",
    "9BD": "FIAT",
    "93H": "HONDA",
    "9C2": "HONDA",
    "9BR": "TOYOTA",
    "8AJ": "TOYOTA",
    "94D": "NISSAN",
    "93Y": "RENAULT",
    "9BF": "FORD",
    "8AF": "FORD",
    "8AC": "MERCEDES-BENZ",
    "9BM": "MERCEDES-BENZ",
    "8AP": "FIAT",
    "935": "CITROEN",
    "936": "PEUGEOT",
    "8AD": "PEUGEOT",
    "988": "JEEP",
    "9C6": "YAMAHA",
    "3VW": "VOLKSWAGEN",
    "WVW": "VOLKSWAGEN",
    "WBA": "BMW",
    "WDD": "MERCEDES-BENZ",
    "SAL": "LAND ROVER",
    "KMH": "HYUNDAI",
    "KNA": "KIA",
    "JHM": "HONDA",
}


class VinInfo(NamedTuple):
    wmi: str
    make_hint: str | None
    model_year: int | None


def only_digits(s: str) -> str:
    return "".join(c for c in s if c.isdigit())


def _mod11_dv(values: list[int], weights: tuple[int, ...]) -> int:
    rest = sum(v * w for v, w in zip(values, weights)) % 11
    return 0 if rest < 2 else 11 - rest


def is_valid_cpf(v: str) -> bool:
    d = [int(c) for c in only_digits(v)]
    if len(d) != 11 or len(set(d)) == 1:
        return False
    dv1 = _mod11_dv(d[:9], tuple(range(10, 1, -1)))
    dv2 = _mod11_dv(d[:10], tuple(range(11, 1, -1)))
    return d[9:] == [dv1, dv2]


def clean_cnpj(v: str) -> str:
    return re.sub(r"[^0-9A-Za-z]", "", v).upper()


def is_valid_cnpj(v: str) -> bool:
    c = clean_cnpj(v)
    if not _CNPJ_RE.match(c) or len(set(c)) == 1:
        return False
    vals = [ord(ch) - 48 for ch in c]
    dv1 = _mod11_dv(vals[:12], _CNPJ_WEIGHTS)
    dv2 = _mod11_dv(vals[:13], (6, *_CNPJ_WEIGHTS))
    return vals[12:] == [dv1, dv2]


def normalize_plate(v: str) -> str:
    return re.sub(r"[^0-9A-Za-z]", "", v).upper()


def is_valid_plate(v: str) -> bool:
    """Placa antiga (ABC1234) ou Mercosul (ABC1D23)."""
    return bool(_PLATE_RE.match(normalize_plate(v)))


def is_valid_renavam(v: str) -> bool:
    d = [int(c) for c in only_digits(v)]
    if len(d) != 11:
        return False
    total = sum(x * w for x, w in zip(reversed(d[:10]), _RENAVAM_WEIGHTS))
    return (total * 10) % 11 % 10 == d[10]


def is_valid_vin(v: str) -> bool:
    """17 caracteres, sem I, O e Q."""
    return bool(_VIN_RE.match(v.strip().upper()))


def decode_vin(v: str) -> VinInfo:
    """Pista de montadora (WMI) e ano-modelo (10º caractere, maior ano até o próximo)."""
    vin = v.strip().upper()
    wmi = vin[:3]
    model_year = None
    idx = _VIN_YEAR_CODES.find(vin[9:10]) if len(vin) >= 10 else -1
    if idx >= 0:
        limit = date.today().year + 1
        model_year = max(y for y in range(1980 + idx, limit + 1, 30))
    return VinInfo(wmi=wmi, make_hint=WMI_MAKES.get(wmi), model_year=model_year)
