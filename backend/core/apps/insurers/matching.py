"""
Casamento de seguradora a partir do que vem nas fontes (Cilia, XML): código, CNPJ e nome.
"""

from apps.insurers.models import Insurer
from apps.lookups.validators import only_digits
from apps.vehicle_catalog.normalize import normalize_name


def match_insurer(*, cnpj: str = "", name: str = "", code: str = "") -> Insurer | None:
    """
    Primeiro acerto entre as ativas: código, CNPJ exato, raiz única, nome normalizado.

    Nunca valida o DV: o seed e as fontes trazem CNPJs com DV inválido.
    """
    # ponytail: varredura em memória; índice GIN em cnpjs se passar de algumas centenas
    insurers = list(Insurer.objects.filter(is_active=True))
    if code:
        found = next((i for i in insurers if i.code == code), None)
        if found:
            return found
    digits = only_digits(cnpj)
    if digits:
        found = next((i for i in insurers if digits in i.cnpjs), None)
        if found:
            return found
    if len(digits) >= 8:
        by_root = [i for i in insurers if any(c[:8] == digits[:8] for c in i.cnpjs)]
        if len(by_root) == 1:
            return by_root[0]
    wanted = normalize_name(name)
    if wanted:
        for i in insurers:
            if wanted in {normalize_name(n) for n in [*i.trade_names, i.name, i.trade_name]}:
                return i
    return None
