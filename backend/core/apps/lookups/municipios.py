"""
Municípios do IBGE: carga (JSON local ou API de Localidades) e casamento por nome + UF.
"""

import json
from pathlib import Path
from typing import Any

import httpx

from django.db import models

from apps.lookups.models import Municipio
from apps.vehicle_catalog.normalize import normalize_name

IBGE_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"
DATA_FILE = Path(__file__).resolve().parent / "data" / "municipios.json"


def _uf(item: dict[str, Any]) -> str:
    """UF pela microrregião; município novo vem com `microrregiao: null`."""
    micro = item.get("microrregiao")
    if micro:
        return micro["mesorregiao"]["UF"]["sigla"]
    return item["regiao-imediata"]["regiao-intermediaria"]["UF"]["sigla"]


def fetch_ibge() -> list[dict[str, str]]:
    """Lista `[{codigo_ibge, nome, uf}]` da API de Localidades, ordenada pelo código."""
    resp = httpx.get(IBGE_URL, timeout=30)
    resp.raise_for_status()
    rows = [{"codigo_ibge": str(m["id"]), "nome": m["nome"], "uf": _uf(m)} for m in resp.json()]
    return sorted(rows, key=lambda r: r["codigo_ibge"])


def read_data_file() -> list[dict[str, str]]:
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def upsert(model: type[models.Model], rows: list[dict[str, str]]) -> int:
    """Upsert pelo código IBGE. `model` pode ser o histórico da migration."""
    objs = [model(nome_normalizado=normalize_name(r["nome"]), **r) for r in rows]
    model.objects.bulk_create(
        objs,
        batch_size=1000,
        update_conflicts=True,
        unique_fields=["codigo_ibge"],
        update_fields=["nome", "nome_normalizado", "uf"],
    )
    return len(objs)


def match_municipio(nome: str, uf: str) -> Municipio | None:
    return Municipio.objects.filter(
        uf=uf.strip().upper(), nome_normalizado=normalize_name(nome)
    ).first()
