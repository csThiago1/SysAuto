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
from django.db import connection
from django_tenants.utils import get_public_schema_name

from apps.lookups.models import Municipio
from apps.lookups.providers import awesomeapi, cnpja_open, cnpjws, minhareceita, opencep, viacep
from apps.lookups.validators import (
    clean_cnpj,
    is_valid_cnpj,
    is_valid_plate,
    normalize_plate,
    only_digits,
)
from apps.persons.models import PersonAddress, PersonDocument, TipoDocumento
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
    # Antes de ligar em produção: confirmar os termos de uso comercial do CNPJá. Se não
    # permitirem, a ordem vira [minhareceita, cnpjws, cnpja_open].
    "cnpj": [cnpja_open, minhareceita, cnpjws],
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


def _normalize_cnpj(raw: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    fields = {k: v for k, v in raw.items() if k not in ("ibge", "cidade")}
    municipio = Municipio.objects.filter(codigo_ibge=raw.get("ibge") or "").first()
    fields["cep"] = only_digits(raw.get("cep", ""))
    fields["municipio"] = (
        {"id": municipio.codigo_ibge, "label": municipio.nome} if municipio else None
    )
    fields["uf"] = municipio.uf if municipio else raw.get("uf", "")
    said_city = raw.get("ibge") or raw.get("cidade")
    return fields, ["municipio"] if said_city and not municipio else []


NORMALIZERS: dict[str, Callable[[dict[str, Any]], tuple[dict[str, Any], list[str]]]] = {
    "cep": _normalize_cep,
    "cnpj": _normalize_cnpj,
}


def _db_first_cnpj(cnpj: str) -> LookupResult | None:
    """`Person` ativa do tenant com esse CNPJ, gravado com ou sem máscara. Não vai para o cache."""
    if connection.schema_name == get_public_schema_name():  # Person só existe no tenant
        return None
    formatted = f"{cnpj[:2]}.{cnpj[2:5]}.{cnpj[5:8]}/{cnpj[8:12]}-{cnpj[12:]}"
    doc = (
        PersonDocument.objects.filter(
            doc_type=TipoDocumento.CNPJ,
            value_hash__in={sha256_hex(cnpj), sha256_hex(formatted)},
            person__is_active=True,
        )
        .select_related("person")
        .first()
    )
    if doc is None:
        return None
    person = doc.person
    addr = person.addresses.filter(is_primary=True).first() or PersonAddress()  # vazio
    raw: dict[str, Any] = {
        "razao_social": person.full_name,
        "nome_fantasia": person.fantasy_name,
        "situacao": "",
        "logradouro": addr.street,
        "numero": addr.number,
        "complemento": addr.complement,
        "bairro": addr.neighborhood,
        "cep": addr.zip_code,
        "ibge": addr.municipio_ibge,
        "cidade": addr.city,
        "uf": addr.state,
        "cnae_codigo": "",
        "cnae_descricao": "",
        "simples": None,
        "mei": None,
        "email": "",
        "telefone": "",
    }
    fields, unmatched = _normalize_cnpj(raw)
    return {"found": True, "source": "db", "fields": fields, "unmatched": unmatched}


DB_FIRST: dict[str, Callable[[str], LookupResult | None]] = {"cnpj": _db_first_cnpj}


def _chain(kind: str, key: str) -> list[Provider]:
    if kind == "cnpj" and not key.isdigit():
        return [cnpja_open]  # o único que aceita CNPJ alfanumérico
    return CHAINS.get(kind, [])


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
    for provider in _chain(kind, key):
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
        db_first = DB_FIRST.get(kind)
        found = db_first(clean) if db_first else None
        if found is not None:
            return found
        cached = cache.get(cache_key(kind, clean))
        if cached is not None:
            return cached
        return _run_chain(kind, clean)
    except Exception as exc:
        logger.error("lookup falhou", extra={"kind": kind, "error": type(exc).__name__})
        return _miss("none")
