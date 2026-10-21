"""
Consultas externas (CEP, CNPJ, placa): validação, cache, cota por provider e fallback.

A chave consultada nunca vai para log nem para a chave de cache em claro.
"""

import logging
import re
import time
from collections.abc import Callable
from datetime import datetime, timedelta
from time import monotonic
from typing import Any, Literal, TypedDict

from django.core.cache import cache
from django.db import connection
from django.db.models import Q
from django.utils import timezone
from django_tenants.utils import get_public_schema_name

from apps.lookups.models import Municipio
from apps.lookups.providers import (
    apiplacas,
    awesomeapi,
    cnpja_open,
    cnpjws,
    minhareceita,
    opencep,
    viacep,
)
from apps.lookups.validators import (
    clean_cnpj,
    is_valid_cnpj,
    is_valid_plate,
    normalize_plate,
    only_digits,
)
from apps.persons.models import PersonAddress, PersonDocument, TipoDocumento
from apps.persons.utils import sha256_hex
from apps.service_orders.models import ServiceOrder
from apps.vehicle_catalog.matching import VehicleMatch, match_vehicle
from apps.vehicle_catalog.normalize import CorVeiculo, match_color
from apps.vehicle_catalog.snapshot import catalog_path

logger = logging.getLogger(__name__)

Kind = Literal["cep", "cnpj", "placa"]
Provider = Callable[[str], dict[str, Any] | None]

DAY = 86400
TTL: dict[str, int] = {"cep": 180 * DAY, "cnpj": 30 * DAY, "placa": 365 * DAY}
MISS_TTL = DAY
RESTRICAO_MAX_AGE = timedelta(days=30)
BUDGET_S = 6.0
QUOTAS: dict[str, int] = {"cnpja_open": 4, "cnpjws": 2}
CHAINS: dict[str, list[Provider]] = {
    "cep": [viacep, opencep, awesomeapi],
    # Antes de ligar em produção: confirmar os termos de uso comercial do CNPJá. Se não
    # permitirem, a ordem vira [minhareceita, cnpjws, cnpja_open].
    "cnpj": [cnpja_open, minhareceita, cnpjws],
    "placa": [apiplacas],
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


def _color(value: str | None) -> dict[str, str] | None:
    if not value or value == CorVeiculo.NAO_INFORMADA:
        return None
    if value not in CorVeiculo.values:  # valor gravado fora da lista: sem cor
        return None
    return {"value": value, "label": CorVeiculo(value).label}


def _normalize_placa(raw: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """Casa o veículo da API com o catálogo; o caminho volta até onde casou."""
    marca, ano = raw["marca"], raw["ano_modelo"]
    texto = f"{raw['modelo']} {raw['versao']}".strip()
    match: VehicleMatch | None = None
    # Sem `exata`, o resultado de cada tentativa já é o casamento por texto (o código só
    # decide quando acha uma versão única), então o último resultado vale como fallback.
    for codigo, _ in sorted(raw["codigos_fipe"], key=lambda c: c[1], reverse=True):
        match = match_vehicle(marca, texto, ano, codigo_fipe=codigo)
        if match.confidence == "exata":
            break
    if match is None:
        match = match_vehicle(marca, texto, ano)
    color = _color(match_color(raw["cor"]))
    fields = {
        "vehicle": catalog_path(make=match.make, family=match.family, version=match.version),
        "color": color,
        "year_manufacture": raw["ano_fabricacao"],
        "restricao": {
            "situacao": raw["situacao"],
            "tem_restricao": raw["codigo_situacao"] != 0,
            "consultado_em": timezone.now().isoformat(),
        },
    }
    unmatched = [f"{marca} {texto}".strip()] if match.version is None else []
    if color is None and raw["cor"]:
        unmatched.append(raw["cor"])
    return fields, unmatched


NORMALIZERS: dict[str, Callable[[dict[str, Any]], tuple[dict[str, Any], list[str]]]] = {
    "cep": _normalize_cep,
    "cnpj": _normalize_cnpj,
    "placa": _normalize_placa,
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


def _db_first_placa(placa: str) -> LookupResult | None:
    """Última OS ativa do tenant com a placa e família do catálogo. Sem a restrição."""
    if connection.schema_name == get_public_schema_name():  # OS só existe no tenant
        return None
    order = (
        ServiceOrder.objects.filter(
            Q(plate__iexact=placa) | Q(plate__iexact=f"{placa[:3]}-{placa[3:]}"),
            is_active=True,
            catalog_family__isnull=False,
        )
        .select_related(
            "catalog_family__make",
            "catalog_version__modelo__marca",
            "catalog_version__modelo__familia",
        )
        .order_by("-created_at")
        .first()
    )
    if order is None:
        return None
    fields = {
        "vehicle": catalog_path(family=order.catalog_family, version=order.catalog_version),
        "color": _color(order.color),
        "year_manufacture": order.year_manufacture,
        "restricao": None,
    }
    return {"found": True, "source": "os", "fields": fields, "unmatched": []}


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


def _restricao_fresca(result: LookupResult) -> bool:
    restricao = result["fields"].get("restricao")
    if restricao is None:
        return not result["found"]  # miss do cache: vale o 1 dia dele
    consultado_em = datetime.fromisoformat(restricao["consultado_em"])
    return timezone.now() - consultado_em < RESTRICAO_MAX_AGE


def _lookup_placa(placa: str) -> LookupResult:
    """O veículo vem da OS do tenant, se houver; a restrição vem do cache e vence em 30 dias.

    Restrição vencida ou ausente reconsulta a API, mesmo com OS no banco. Se a API falhar,
    fica a restrição antiga, com o `consultado_em` antigo.
    """
    from_os = _db_first_placa(placa)
    key = cache_key("placa", placa)
    cached: LookupResult | None = cache.get(key)
    if cached is None or not _restricao_fresca(cached):
        fresh = _run_chain("placa", placa)
        if fresh["found"] or cached is None:
            cached = fresh
        else:
            # ponytail: regrava a antiga por cima do miss do _run_chain; o TTL recomeça
            cache.set(key, cached, TTL["placa"])
    if from_os is None:
        return cached
    from_os["fields"]["restricao"] = cached["fields"].get("restricao")
    return from_os


def lookup(kind: Kind, key: str) -> LookupResult:
    """Consulta `kind` pela `key`. Nunca levanta: chave inválida dá `source="invalid"`."""
    try:
        clean = _clean_key(kind, key)
        if clean is None:
            return _miss("invalid")
        if kind == "placa":
            return _lookup_placa(clean)
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
