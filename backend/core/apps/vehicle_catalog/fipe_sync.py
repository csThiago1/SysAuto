"""
Carga mensal do catálogo FIPE completo a partir do dump fipeX (TSV, ~51 mil linhas).

O catálogo nunca apaga linha: o que sai da fonte vira is_active=False (a marca não: é do admin).
"""

import csv
import logging
import re
import tempfile
from collections.abc import Sequence
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path

import httpx

from django.db import transaction
from django.db.models import Count, Model, Q
from django.utils import timezone

from apps.vehicle_catalog.models import (
    VehicleFamily,
    VehicleFamilyRule,
    VehicleMake,
    VehicleModel,
    VehicleYearVersion,
)
from apps.vehicle_catalog.normalize import (
    COMBUSTIVEL_FROM_SIGLA,
    TIPO_FROM_FIPEX,
    make_display_name,
    normalize_name,
)

logger = logging.getLogger(__name__)

FIPEX_URL = (
    "https://huggingface.co/datasets/alanwgt/fipex-veiculos-brasil/resolve/main/"
    "{ano}/{mes:02d}/fipex-prices.csv"
)
ZERO_KM_ANO = 32000
BATCH = 2000
LEADING_NEW = {"NOVO", "NOVA", "NEW"}


def rule_family(
    marca_nn: str,
    model_nn: str,
    rules: Sequence[VehicleFamilyRule],
    tipo: str = "carro",
) -> str | None:
    """Família pela regra ativa da marca (padrão mais longo primeiro), ou None."""
    applicable = sorted(
        (
            r
            for r in rules
            if r.is_active and r.tipo == tipo and r.marca_nome_normalizado == marca_nn
        ),
        key=lambda r: len(r.padrao),
        reverse=True,
    )
    for rule in applicable:
        m = re.match(rule.padrao, model_nn)
        if m:
            return m.expand(rule.familia)
    return None


def derive_family(
    fipe_make: str,
    fipe_model: str,
    rules: Sequence[VehicleFamilyRule],
    tipo: str = "carro",
) -> str:
    """Nome de exibição da família de uma versão FIPE (regra da marca, senão 1º termo)."""
    n = normalize_name(fipe_model)
    marca = normalize_name(fipe_make)
    hit = rule_family(marca, n, rules, tipo)
    if hit:
        return hit

    toks = n.split()
    while len(toks) > 1 and toks[0] in LEADING_NEW:
        toks.pop(0)
    if len(toks) > 1 and toks[0] in set(re.split(r"[\s-]+", marca)):
        toks.pop(0)
    tok = re.split(r"[/.]", toks[0])[0] or toks[0]
    if any(c.isdigit() for c in tok):
        return tok
    if "-" in tok:
        return "-".join(p if len(p) <= 2 else p.capitalize() for p in tok.split("-"))
    return tok.capitalize()


def download_fipex(ano: int, mes: int, dest: Path) -> bool:
    """Baixa o dump do mês para dest. False quando o mês ainda não foi publicado (404)."""
    url = FIPEX_URL.format(ano=ano, mes=mes)
    with httpx.stream("GET", url, timeout=60, follow_redirects=True) as resp:
        if resp.status_code == 404:
            return False
        resp.raise_for_status()
        with dest.open("wb") as f:
            for chunk in resp.iter_bytes():
                f.write(chunk)
    return True


def _counts() -> dict[str, int]:
    return {"upserted": 0, "deactivated": 0}


@dataclass
class SyncReport:
    makes: dict[str, int] = field(default_factory=_counts)
    families: dict[str, int] = field(default_factory=_counts)
    models: dict[str, int] = field(default_factory=_counts)
    versions: dict[str, int] = field(default_factory=_counts)
    single_version_families: list[str] = field(default_factory=list)


def _deactivate_stale(model: type[Model], ref: str) -> int:
    return model.objects.filter(is_active=True).exclude(fonte_ref=ref).update(is_active=False)


@transaction.atomic
def load_fipex(path: Path, *, ref: str) -> SyncReport:
    """Upsert de marcas, famílias, versões e ano-versões do TSV; desativa o que saiu da fonte.

    Marcas não são desativadas. Recusa (ValueError) dump com menos de 80% das versões ativas.
    """
    rules = list(VehicleFamilyRule.objects.filter(is_active=True))
    makes: dict[tuple[str, str], VehicleMake] = {}
    families: dict[tuple[tuple[str, str], str], str] = {}  # (make_key, nn) -> nome
    models: dict[tuple[str, str], tuple[tuple[str, str], str, str]] = {}
    versions: dict[tuple[str, str, int, str], dict[str, object]] = {}

    with open(path, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            tipo = TIPO_FROM_FIPEX[row["tipo_veiculo"]].value
            make_key = (tipo, normalize_name(row["nome_marca"]))
            if make_key not in makes:
                makes[make_key] = VehicleMake(
                    tipo=tipo,
                    nome=row["nome_marca"],
                    nome_normalizado=make_key[1],
                    display_name=make_display_name(row["nome_marca"]),
                    fonte_ref=ref,
                )
            model_key = (tipo, row["codigo_fipe"])
            if model_key not in models:
                fam = derive_family(row["nome_marca"], row["nome_modelo"], rules, tipo)
                families.setdefault((make_key, normalize_name(fam)), fam)
                models[model_key] = (make_key, normalize_name(fam), row["nome_modelo"])
            zero_km = row["zero_km"] == "true"
            ano = ZERO_KM_ANO if zero_km else int(row["ano_modelo"])
            combustivel = COMBUSTIVEL_FROM_SIGLA[row["sigla_combustivel"]].value
            versions[(tipo, row["codigo_fipe"], ano, combustivel)] = {
                "zero_km": zero_km,
                "valor_referencia": Decimal(row["valor_centavos"]) / 100,
            }

    # Dump truncado desativaria quase todo o catálogo: recusa antes de qualquer escrita.
    active = VehicleYearVersion.objects.filter(is_active=True).count()
    if active and len(versions) < 0.8 * active:
        raise ValueError(f"dump curto: {len(versions)} versões vs {active} ativas")

    VehicleMake.objects.bulk_create(
        makes.values(),
        batch_size=BATCH,
        update_conflicts=True,
        unique_fields=["tipo", "nome_normalizado"],
        update_fields=["nome", "display_name", "fonte_ref"],  # is_active fica com o admin
    )
    make_ids = {
        (m.tipo, m.nome_normalizado): m.pk for m in VehicleMake.objects.filter(fonte_ref=ref)
    }

    VehicleFamily.objects.bulk_create(
        [
            VehicleFamily(
                make_id=make_ids[mk], nome=nome, nome_normalizado=nn, is_active=True, fonte_ref=ref
            )
            for (mk, nn), nome in families.items()
        ],
        batch_size=BATCH,
        update_conflicts=True,
        unique_fields=["make", "nome_normalizado"],
        update_fields=["nome", "fonte_ref", "is_active"],
    )
    family_ids = {
        (f.make_id, f.nome_normalizado): f.pk for f in VehicleFamily.objects.filter(fonte_ref=ref)
    }

    VehicleModel.objects.bulk_create(
        [
            VehicleModel(
                tipo=tipo,
                codigo_fipe=codigo,
                marca_id=make_ids[mk],
                familia_id=family_ids[(make_ids[mk], fam_nn)],
                nome=nome,
                nome_normalizado=normalize_name(nome),
                fonte_ref=ref,
                is_active=True,
            )
            for (tipo, codigo), (mk, fam_nn, nome) in models.items()
        ],
        batch_size=BATCH,
        update_conflicts=True,
        unique_fields=["tipo", "codigo_fipe"],
        update_fields=["marca", "familia", "nome", "nome_normalizado", "fonte_ref", "is_active"],
    )
    model_ids = {(m.tipo, m.codigo_fipe): m.pk for m in VehicleModel.objects.filter(fonte_ref=ref)}

    version_objs = []
    for (tipo, codigo, ano, combustivel), data in versions.items():
        v = VehicleYearVersion(
            modelo_id=model_ids[(tipo, codigo)],
            ano=ano,
            combustivel=combustivel,
            codigo_fipe=codigo,
            is_active=True,
            fonte_ref=ref,
            **data,
        )
        v.descricao = v.label
        version_objs.append(v)
    VehicleYearVersion.objects.bulk_create(
        version_objs,
        batch_size=BATCH,
        update_conflicts=True,
        unique_fields=["modelo", "ano", "combustivel"],
        update_fields=[
            "zero_km",
            "descricao",
            "codigo_fipe",
            "valor_referencia",
            "is_active",
            "fonte_ref",
            "atualizado_em",
        ],
    )

    rep = SyncReport()
    rep.makes["upserted"] = len(makes)
    rep.families["upserted"] = len(families)
    rep.models["upserted"] = len(models)
    rep.versions["upserted"] = len(version_objs)
    # Marca nunca é desativada pela carga (is_active é do admin); a que some da fonte fica
    # sem família ativa, então o Modelo dela já sai vazio.
    rep.models["deactivated"] = _deactivate_stale(VehicleModel, ref)
    rep.versions["deactivated"] = _deactivate_stale(VehicleYearVersion, ref)
    rep.families["deactivated"] = _deactivate_stale(VehicleFamily, ref) + (
        VehicleFamily.objects.filter(is_active=True)
        .exclude(versoes_fipe__is_active=True)
        .update(is_active=False)
    )
    rep.single_version_families = [
        f"{display} {nome}"
        for display, nome in VehicleFamily.objects.filter(is_active=True)
        .annotate(n=Count("versoes_fipe", filter=Q(versoes_fipe__is_active=True)))
        .filter(n=1)
        .order_by("make__display_name", "nome")
        .values_list("make__display_name", "nome")
    ]
    logger.info(
        "fipeX %s: makes=%s families=%s models=%s versions=%s single_version_families=%d",
        ref,
        rep.makes,
        rep.families,
        rep.models,
        rep.versions,
        len(rep.single_version_families),
    )
    return rep


def ref_from_file(path: Path) -> str:
    """Mês de referência ("2026-10") lido da primeira linha do dump."""
    with open(path, encoding="utf-8", newline="") as f:
        row = next(csv.DictReader(f, delimiter="\t"))
    return f"{row['ano_referencia']}-{int(row['mes_referencia']):02d}"


def fetch_and_load(month: str | None = None) -> SyncReport:
    """Baixa e carrega o mês pedido; sem mês, o corrente e, em 404, o anterior."""
    if month:
        ano, mes = (int(p) for p in month.split("-"))
        candidates = [(ano, mes)]
    else:
        today = timezone.localdate()
        prev = (today.year, today.month - 1) if today.month > 1 else (today.year - 1, 12)
        candidates = [(today.year, today.month), prev]
    with tempfile.TemporaryDirectory() as tmp:
        dest = Path(tmp) / "fipex.tsv"
        for ano, mes in candidates:
            if download_fipex(ano, mes, dest):
                return load_fipex(dest, ref=f"{ano}-{mes:02d}")
    raise FileNotFoundError(f"fipeX sem dump publicado para {candidates}")
