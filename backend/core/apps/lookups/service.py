"""
Consultas externas (CEP, CNPJ, placa): validação, cache, cota por provider e fallback.

A chave consultada nunca vai para log nem para a chave de cache em claro.
"""

import logging
import re
import time
from collections.abc import Callable
from time import monotonic
from typing import Any, Literal, TypedDict

from django.core.cache import cache

from apps.lookups.models import Municipio
from apps.lookups.providers import awesomeapi, opencep, viacep
from apps.lookups.validators import (
    clean_cnpj,
    is_valid_cnpj,
    is_valid_plate,
    normalize_plate,
    only_digits,
)
from apps.persons.utils import sha256_hex

logger = logging.getLogger(__name__)

Kind = Literal["cep", "cnpj", "placa"]
Provider = Callable[[str], dict[str, Any] | None]

DAY = 86400
TTL: dict[str, int] = {"cep": 180 * DAY, "cnpj": 30 * DAY, "placa": 365 * DAY}
MISS_TTL = DAY
BUDGET_S = 6.0
QUOTAS: dict[str, int] = {"cnpja_open": 4, "cnpjws": 2}
CHAINS: dict[str, list[Provider]] = {
    "cep": [viacep, opencep, awesomeapi],
}


class LookupResult(TypedDict):
    found: bool
    source: str
    fields: dict[str, Any]
    unmatched: list[str]


def cache_key(kind: str, key: str) -> str:
    return f"lookup:{kind}:{sha256_hex(key)}"


def _miss(source: str) -> LookupResult:
    return {"found": False, "source": source, "fields": {}, "unmatched": []}


def _clean_key(kind: str, key: str) -> str | None:
    """Chave limpa, ou `None` se inválida para o tipo."""
    if kind == "cep":
        cep = re.sub(r"[\s.-]", "", key)
        return cep if re.fullmatch(r"\d{8}", cep) else None
    if kind == "cnpj":
        return clean_cnpj(key) if is_valid_cnpj(key) else None
    if kind == "placa":
        return normalize_plate(key) if is_valid_plate(key) else None
    return None


def _normalize_cep(raw: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    municipio = Municipio.objects.filter(codigo_ibge=raw.get("ibge") or "").first()
    fields = {
        "cep": only_digits(raw.get("cep", "")),
        "logradouro": raw.get("logradouro", ""),
        "complemento": raw.get("complemento", ""),
        "bairro": raw.get("bairro", ""),
        "municipio": (
            {"id": municipio.codigo_ibge, "label": municipio.nome} if municipio else None
        ),
        "uf": municipio.uf if municipio else raw.get("uf", ""),
    }
    return fields, [] if municipio else ["municipio"]


NORMALIZERS: dict[str, Callable[[dict[str, Any]], tuple[dict[str, Any], list[str]]]] = {
    "cep": _normalize_cep,
}


def _has_quota(name: str) -> bool:
    limit = QUOTAS.get(name)
    if limit is None:
        return True
    counter = f"lookup:quota:{name}:{int(time.time() // 60)}"
    cache.add(counter, 0, 60)
    return cache.incr(counter) <= limit


def _log(kind: str, name: str, status: str, ms: int) -> None:
    logger.info(
        "lookup provider", extra={"kind": kind, "provider": name, "status": status, "ms": ms}
    )


def _run_chain(kind: str, key: str) -> LookupResult:
    deadline = monotonic() + BUDGET_S
    said_missing = False
    for provider in CHAINS.get(kind, []):
        name = provider.__name__
        if monotonic() >= deadline:
            break
        if not _has_quota(name):
            _log(kind, name, "quota", 0)
            continue
        start = monotonic()
        try:
            raw = provider(key)
        except Exception as exc:  # a cadeia nunca propaga erro de fonte
            ms = int((monotonic() - start) * 1000)
            # Só o tipo da exceção: a mensagem do httpx traz a URL, que contém a chave.
            logger.warning(
                "lookup provider falhou",
                extra={"kind": kind, "provider": name, "ms": ms, "error": type(exc).__name__},
            )
            _log(kind, name, "error", ms)
            continue
        ms = int((monotonic() - start) * 1000)
        if raw is None:
            said_missing = True
            _log(kind, name, "miss", ms)
            continue
        _log(kind, name, "hit", ms)
        fields, unmatched = NORMALIZERS[kind](raw)
        result: LookupResult = {
            "found": True,
            "source": name,
            "fields": fields,
            "unmatched": unmatched,
        }
        cache.set(cache_key(kind, key), result, TTL[kind])
        return result
    result = _miss("none")
    if said_missing:  # "não existe" de alguma fonte; só erro não fica no cache
        cache.set(cache_key(kind, key), result, MISS_TTL)
    return result


def lookup(kind: Kind, key: str) -> LookupResult:
    """Consulta `kind` pela `key`. Nunca levanta: chave inválida dá `source="invalid"`."""
    try:
        clean = _clean_key(kind, key)
        if clean is None:
            return _miss("invalid")
        cached = cache.get(cache_key(kind, clean))
        if cached is not None:
            return cached
        return _run_chain(kind, clean)
    except Exception as exc:
        logger.error("lookup falhou", extra={"kind": kind, "error": type(exc).__name__})
        return _miss("none")
