"""
Casamento de texto livre de veículo (Cilia, XML, HDI, placa, orçamento...) com o catálogo FIPE.

Funções puras sobre o catálogo do schema public, usadas por todas as fontes.
"""

import re
from dataclasses import dataclass
from typing import Literal

from apps.lookups.validators import decode_vin
from apps.vehicle_catalog.models import (
    VehicleAlias,
    VehicleFamily,
    VehicleMake,
    VehicleModel,
    VehicleYearVersion,
)
from apps.vehicle_catalog.normalize import (
    BRAND_ALIASES,
    FUEL_WORDS,
    TipoVeiculo,
    canonical_brand,
    match_fuel,
    normalize_name,
)

Confidence = Literal["exata", "alta", "baixa", "nenhuma"]

TOKEN_SYN = {
    "AT": "AUT",
    "AUTOMATICO": "AUT",
    "MT": "MEC",
    "MANUAL": "MEC",
    "TB": "TURBO",
    "PREM": "PREMIER",
    "SED": "SEDAN",
}
DROP = {"NOVO", "NOVA", "NEW", "TOTAL"}
LEADING_NEW = {"NOVO", "NOVA", "NEW"}
YEAR_RANGE = re.compile(r"\(\s*\d{4}\s*A\s*\d{4}\s*\)")
TRAILING_YEAR = re.compile(r"\s\d{4}$")
ENGINE = re.compile(r"^\d\.\d$")
RAW_KEY_MAX = 300


@dataclass(frozen=True)
class VehicleMatch:
    make: VehicleMake | None
    family: VehicleFamily | None
    model: VehicleModel | None
    version: VehicleYearVersion | None
    confidence: Confidence
    review: bool
    candidates: tuple[VehicleModel, ...] = ()


def version_tokens(text: str) -> tuple[set[str], str | None]:
    """Tokens de pontuação de um nome de versão e a pista de combustível."""
    t = YEAR_RANGE.sub(" ", normalize_name(text))
    t = re.sub(r"(\d\.\d)([A-Z])", r"\1 \2", t)  # 1.0MI → 1.0 MI
    t = re.sub(r"[()/,;:]|(?<!\d)-|-(?!\d)", " ", t)  # separa EXL-AT, mantém 35-160
    out: set[str] = set()
    fuel = match_fuel(text)
    for tok in t.split():
        tok = (tok.replace(".", "") if not re.search(r"\d", tok) else tok).rstrip(".")
        if not tok or tok in DROP or tok in FUEL_WORDS:
            continue
        out.add(TOKEN_SYN.get(tok, tok))
    return out, fuel


def _weight(tokens: set[str]) -> float:
    return sum(1 if re.search(r"\d", t) else 2 for t in tokens)


def _score(source: set[str], candidate: set[str]) -> float:
    return _weight(source & candidate) - 0.5 * _weight(candidate - source)


def alias_key(text: str, year: int | None) -> str:
    """Chave da regra aprendida: texto normalizado sem intervalo de anos + "|ano"."""
    suffix = f"|{year or ''}"
    n = normalize_name(YEAR_RANGE.sub(" ", normalize_name(text)))
    return n[: RAW_KEY_MAX - len(suffix)] + suffix


def _strip_prefix(text: str, prefixes: set[str]) -> str:
    """Tira repetidamente o maior prefixo da lista que termina em espaço ou no fim."""
    changed = True
    while changed:
        changed = False
        for p in sorted(prefixes, key=len, reverse=True):
            if p and (text == p or text.startswith(p + " ")):
                text, changed = text[len(p) :].strip(), True
                break
    return text


def _version_result(
    version: VehicleYearVersion, confidence: Confidence, review: bool
) -> VehicleMatch:
    modelo = version.modelo
    return VehicleMatch(modelo.marca, modelo.familia, modelo, version, confidence, review)


def _by_alias(source: str, brand: str, text: str, year: int | None) -> VehicleMatch | None:
    alias = (
        VehicleAlias.objects.select_related(
            "version__modelo__marca", "version__modelo__familia", "family__make"
        )
        .filter(source=source, raw_key=alias_key(f"{brand} {text}", year))
        .first()
    )
    if alias is None:
        return None
    # alvo desativado por recarga da FIPE: ignora a regra e segue para os passos normais
    if alias.version is not None and not alias.version.is_active:
        return None
    if alias.family is not None and not alias.family.is_active:
        return None
    confidence: Confidence = "exata" if alias.is_exact else "alta"
    if alias.version is not None:
        return _version_result(alias.version, confidence, not alias.is_exact)
    if alias.family is not None:
        # sem versão a OS continua com selo, mesmo com a família exata
        return VehicleMatch(alias.family.make, alias.family, None, None, confidence, True)
    return None


def _brand_makes(brand: str, full: str, vin: str | None) -> tuple[str, list[VehicleMake]]:
    """Nome de exibição normalizado da marca e as makes ativas com ele (qualquer tipo)."""
    # ponytail: carrega todas as makes ativas (~200 linhas) por chamada; guardar
    # display_name normalizado no model se isso aparecer no perfil
    by_display: dict[str, list[VehicleMake]] = {}
    for mk in VehicleMake.objects.filter(is_active=True):
        by_display.setdefault(normalize_name(mk.display_name), []).append(mk)

    name = canonical_brand(brand) if brand.strip() else ""
    if name not in by_display:
        prefixes = {d: d for d in by_display} | {a: c for a, c in BRAND_ALIASES.items()}
        name = next(
            (
                prefixes[p]
                for p in sorted(prefixes, key=len, reverse=True)
                if (full == p or full.startswith(p + " ")) and prefixes[p] in by_display
            ),
            "",
        )
    if not name and vin:
        name = decode_vin(vin).make_hint or ""
    return name, by_display.get(name, [])


def _clean_rest(full: str, brand: str, name: str, makes: list[VehicleMake]) -> str:
    prefixes = {name, normalize_name(brand)} | {m.nome_normalizado for m in makes}
    prefixes |= {a for a, c in BRAND_ALIASES.items() if c == name}
    rest = _strip_prefix(full, prefixes)
    rest = normalize_name(YEAR_RANGE.sub(" ", rest))
    rest = TRAILING_YEAR.sub("", rest)
    toks = rest.split()
    while len(toks) > 1 and toks[0] in LEADING_NEW:
        toks.pop(0)
    return " ".join(toks)


def _family(rest: str, makes: list[VehicleMake], tipo: str) -> VehicleFamily | None:
    families = [
        f
        for f in VehicleFamily.objects.filter(make__in=makes, is_active=True).select_related("make")
        if rest == f.nome_normalizado or rest.startswith(f.nome_normalizado + " ")
    ]
    # a mais longa primeiro; o tipo só desempata famílias homônimas
    families.sort(key=lambda f: (-len(f.nome_normalizado), f.make.tipo != tipo))
    return families[0] if families else None


def match_vehicle(
    brand: str,
    text: str,
    year: int | None,
    *,
    fuel: str | None = None,
    codigo_fipe: str | None = None,
    vin: str | None = None,
    tipo: str | None = None,
    source: str = "",
) -> VehicleMatch:
    """Casa marca + descrição livre + ano-modelo com o catálogo FIPE (para no 1º passo que resolve)."""
    fipe_year = year or (decode_vin(vin).model_year if vin else None)
    if codigo_fipe and fipe_year:
        versions = list(
            VehicleYearVersion.objects.select_related("modelo__marca", "modelo__familia").filter(
                modelo__codigo_fipe=codigo_fipe, ano=fipe_year, is_active=True
            )
        )
        if fuel and len(versions) > 1:
            versions = [v for v in versions if v.combustivel == fuel]
        if len(versions) == 1:
            return _version_result(versions[0], "exata", False)

    if source:
        by_alias = _by_alias(source, brand, text, year)
        if by_alias is not None:
            return by_alias

    full = normalize_name(f"{brand} {text}")
    name, makes = _brand_makes(brand, full, vin)
    tipo = tipo or TipoVeiculo.CARRO.value
    if not makes:
        return VehicleMatch(None, None, None, None, "nenhuma", True)
    rest = _clean_rest(full, brand, name, makes)
    family = _family(rest, makes, tipo)
    if family is None:
        make = sorted(makes, key=lambda m: m.tipo != tipo)[0]
        return VehicleMatch(make, None, None, None, "nenhuma", True)

    fam_tokens, _ = version_tokens(family.nome)
    src_tokens, hint = version_tokens(rest)
    src_tokens -= fam_tokens
    fuel = fuel or hint
    src_engine = {t for t in src_tokens if ENGINE.match(t)}

    models = VehicleModel.objects.filter(familia=family, is_active=True)
    if year:
        models = models.filter(versoes__ano=year, versoes__is_active=True).distinct()
    scored: list[tuple[float, VehicleModel]] = []
    for model in models:
        cand_tokens = version_tokens(model.nome)[0] - fam_tokens
        cand_engine = {t for t in cand_tokens if ENGINE.match(t)}
        if src_engine and cand_engine and not src_engine & cand_engine:
            continue
        scored.append((_score(src_tokens, cand_tokens), model))
    scored.sort(key=lambda s: s[0], reverse=True)

    s1 = scored[0][0] if scored else None
    s2 = scored[1][0] if len(scored) > 1 else None
    if s1 is None or s1 < 3 or (s2 is not None and s1 - s2 < 1.5):
        candidates = tuple(m for _, m in scored[:5])
        return VehicleMatch(family.make, family, None, None, "baixa", True, candidates)

    model = scored[0][1]
    versions = model.versoes.filter(is_active=True)
    if year:
        versions = versions.filter(ano=year)
    if fuel:
        versions = versions.filter(combustivel=fuel)
    found = list(versions[:2])
    version = found[0] if len(found) == 1 else None
    return VehicleMatch(family.make, family, model, version, "alta", version is None)


def record_alias_confirmation(
    source: str,
    text: str,
    year: int | None,
    *,
    version: VehicleYearVersion | None,
    family: VehicleFamily | None,
) -> VehicleAlias:
    """Conta uma confirmação do usuário para (fonte, texto); alvo novo reinicia a contagem."""
    family = None if version is not None else family
    alias, created = VehicleAlias.objects.get_or_create(
        source=source,
        raw_key=alias_key(text, year),
        defaults={"version": version, "family": family},
    )
    if created:
        return alias
    if (alias.version_id, alias.family_id) == (
        version.pk if version else None,
        family.pk if family else None,
    ):
        # ponytail: soma em memória; duas confirmações simultâneas podem contar uma só
        alias.confirmacoes += 1
    else:
        alias.version, alias.family = version, family
        alias.confirmacoes, alias.aprovado = 1, False
    alias.save()
    return alias
