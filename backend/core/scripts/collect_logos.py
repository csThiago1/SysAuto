#!/usr/bin/env python3
"""
Coleta única de logos de montadoras e seguradoras — Wikidata (P154) + Wikimedia Commons,
e site oficial da marca quando o Commons não tem o logo atual (lista OFFICIAL).

NÃO é dependência de runtime. Gera a pasta que o comando `load_logos` lê:
    <out>/makes/*.svg|png      logos das montadoras
    <out>/insurers/*.svg|png   logos das seguradoras
    <out>/manifest.json        origem, autor, licença e data de cada arquivo
    <out>/review.html          grade para o dono aprovar (imagens embutidas; fora do git)

Revisão humana obrigatória antes do commit: abra review.html e confira cada logo.
Aprovados pelo dono em 19/10/2026 (44 arquivos).

Execução (só stdlib, sem Django):
    cd backend/core
    python3 scripts/collect_logos.py [--out data/logos]

Fonte proibida: car-logos-dataset / carlogos.org (proíbem uso comercial).
Logos são marcas registradas: uso só para identificação interna no ERP.
Site público exige autorização por escrito de cada marca.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import html
import json
import logging
import mimetypes
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

UA = "DSCarERP-logo-staging/1.0 (https://paddock.solutions; one-off logo review script)"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"

# (nome exibido, [(tipo, nome FIPE)], QID Wikidata, arquivo Commons forçado ou None)
# Nomes FIPE conferidos em parallelum.com.br/fipe/api/v1/{carros,motos,caminhoes}/marcas (19/10/2026).
# Arquivo forçado = quando o P154 falta ou o escolhido não é o logo atual.
MAKES: list[tuple[str, list[tuple[str, str]], str, Optional[str]]] = [
    ("Chevrolet", [("carro", "GM - Chevrolet"), ("caminhao", "CHEVROLET")], "Q29570", None),
    ("Volkswagen", [("carro", "VW - VolksWagen"), ("caminhao", "VOLKSWAGEN")], "Q246", None),
    (
        "Fiat",
        [("carro", "Fiat"), ("caminhao", "FIAT")],
        "Q27597",
        "FIAT logo (2020).svg",
    ),  # P154 preferido é a variante colorida
    ("Ford", [("carro", "Ford"), ("caminhao", "FORD")], "Q44294", None),
    ("Toyota", [("carro", "Toyota")], "Q53268", None),
    (
        "Honda",
        [("carro", "Honda")],
        "Q9584",
        "Honda.svg",
    ),  # P154 escolhido é só o letreiro, sem o "H"
    ("Honda (moto)", [("moto", "HONDA")], "Q9584", "Honda Logo.svg"),  # asa (motos), via Q5631175
    ("Hyundai", [("carro", "Hyundai"), ("caminhao", "HYUNDAI")], "Q55931", None),
    (
        "Renault",
        [("carro", "Renault")],
        "Q98584518",
        "Renault 2021.svg",
    ),  # P154 aponta o logo de 2009
    ("Nissan", [("carro", "Nissan")], "Q20165", None),
    ("Jeep", [("carro", "Jeep")], "Q30113", None),
    (
        "Peugeot",
        [("carro", "Peugeot"), ("moto", "PEUGEOT")],
        "Q6742",
        "Wordmark Peugeot 2021.svg",
    ),  # P154 escolhido era foto de carro
    ("Citroën", [("carro", "Citroën")], "Q6746", None),
    ("Mitsubishi", [("carro", "Mitsubishi")], "Q36033", None),
    ("Kia", [("carro", "Kia Motors")], "Q35349", None),
    ("BMW", [("carro", "BMW")], "Q796364", None),
    ("BMW Motorrad", [("moto", "BMW")], "Q249173", None),
    ("Mercedes-Benz", [("carro", "Mercedes-Benz"), ("caminhao", "MERCEDES-BENZ")], "Q36008", None),
    ("Audi", [("carro", "Audi")], "Q23317", None),
    ("Land Rover", [("carro", "Land Rover")], "Q35907", None),
    ("Chery", [("carro", "Caoa Chery"), ("carro", "Caoa Chery/Chery")], "Q591001", None),
    ("BYD", [("carro", "BYD")], "Q27423", None),
    ("GWM", [("carro", "GWM"), ("carro", "GREAT WALL")], "Q1117001", None),
    ("RAM", [("carro", "RAM")], "Q165708", None),
    ("Yamaha", [("moto", "YAMAHA")], "Q158888", None),
    ("Iveco", [("carro", "IVECO"), ("caminhao", "IVECO")], "Q29913", None),
    ("Volvo", [("carro", "Volvo")], "Q215293", None),
    ("Volvo Trucks", [("caminhao", "VOLVO")], "Q2033642", None),
    ("Scania", [("caminhao", "SCANIA"), ("caminhao", "SAAB-SCANIA")], "Q219960", None),
    (
        "MAN",
        [("caminhao", "MAN")],
        "Q708667",
        "MAN Truck & Bus - Logo.svg",
    ),  # P154 é JPG CC BY-SA; este SVG é PD (Q136339713)
    ("DAF", [("caminhao", "DAF")], "Q27489", None),
    ("Suzuki", [("carro", "Suzuki"), ("moto", "SUZUKI")], "Q181642", None),
    ("Kawasaki", [("moto", "KAWASAKI")], "Q249033", None),
]

# (trade_name do seed load_insurers, QID Wikidata ou None, arquivo Commons forçado ou None)
INSURERS: list[tuple[str, Optional[str], Optional[str]]] = [
    ("Allianz", "Q487292", None),
    ("Bradesco Seguros", "Q4954511", None),
    ("HDI Seguros", "Q48867563", None),
    ("Mapfre", "Q544532", None),
    ("Zurich", "Q230426", None),
    ("Porto Seguro", "Q7232169", None),  # Commons só tem o logo anterior à marca "Porto" (2022)
    ("Azul Seguros", "Q134466051", "Logotipo da Azul Seguros.svg"),  # sem P154 no Wikidata
    ("Tokio Marine", "Q1812086", None),
    ("Itaú Seguros", "Q1424293", "Itaú Unibanco logo 2023.svg"),  # marca Itaú, sem P154 próprio
    ("Mitsui Sumitomo", "Q6883244", None),
    ("Yelum", None, None),
]

# Logo atual que o Commons não tem: baixado do site da própria marca, sem licença aberta.
# Vale só para identificação interna até chegar o kit oficial (data/logos/email-seguradoras.md).
# trade_name: (URL do arquivo, página onde foi encontrado) — conferidos em 19/10/2026.
OFFICIAL: dict[str, tuple[str, str]] = {
    "Porto Seguro": (
        "https://portoseguro.cdn.prismic.io/portoseguro/aScbuWGnmrmGqW3T_porto-logo.svg",
        "https://www.portoseguro.com.br/",
    ),
    "Mitsui Sumitomo": (
        "https://msig.com.br/wp-content/uploads/2024/09/mitsui-logo.svg",
        "https://msig.com.br/",
    ),
    "Yelum": (
        "https://www.yelumseguros.com.br/SiteAssets/img/logo-cia-primary.svg",
        "https://www.yelumseguros.com.br/",
    ),
}

# SVG com conteúdo ativo é recusado (o arquivo vai para S3/R2 e pode ser aberto direto).
UNSAFE_SVG = re.compile(rb"<script|javascript:|\son[a-z]+\s*=|<foreignObject", re.I)


def _get_json(url: str, params: dict[str, str]) -> Any:
    req = urllib.request.Request(
        f"{url}?{urllib.parse.urlencode(params)}", headers={"User-Agent": UA}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def pick_logo(claims: list[dict[str, Any]]) -> Optional[str]:
    """Escolhe o P154 atual: rank preferido > sem data de fim (P582) > o de início (P580) mais recente."""
    claims = [c for c in claims if c.get("rank") != "deprecated" and c["mainsnak"].get("datavalue")]
    preferred = [c for c in claims if c.get("rank") == "preferred"]
    current = [c for c in claims if "P582" not in c.get("qualifiers", {})]
    pool = preferred or current or claims
    if not pool:
        return None

    def start(c: dict[str, Any]) -> str:
        q = c.get("qualifiers", {}).get("P580", [])
        return q[0]["datavalue"]["value"]["time"] if q and q[0].get("datavalue") else ""

    return max(pool, key=start)["mainsnak"]["datavalue"]["value"]


def wikidata_logos(qids: list[str]) -> dict[str, Optional[str]]:
    out: dict[str, Optional[str]] = {}
    for i in range(0, len(qids), 50):
        batch = qids[i : i + 50]
        ents = _get_json(
            WIKIDATA_API,
            {
                "action": "wbgetentities",
                "ids": "|".join(batch),
                "props": "claims",
                "format": "json",
            },
        )["entities"]
        for qid in batch:
            out[qid] = pick_logo(ents[qid].get("claims", {}).get("P154", []))
    return out


def _strip(value: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", value)).strip()


def commons_info(filename: str) -> dict[str, Any]:
    pages = _get_json(
        COMMONS_API,
        {
            "action": "query",
            "titles": f"File:{filename}",
            "prop": "imageinfo",
            "iiprop": "url|extmetadata|timestamp|sha1|mime",
            "format": "json",
        },
    )["query"]["pages"]
    page = next(iter(pages.values()))
    if "imageinfo" not in page:
        raise LookupError(f"arquivo não encontrado no Commons: {filename}")
    ii = page["imageinfo"][0]
    meta = {k: _strip(str(v.get("value", ""))) for k, v in ii.get("extmetadata", {}).items()}
    return {
        "commons_file": filename,
        "source_url": ii["descriptionurl"],
        "download_url": ii["url"],
        "mime": ii["mime"],
        "sha1": ii["sha1"],
        "author": meta.get("Artist") or meta.get("Credit") or "",
        "license": meta.get("LicenseShortName", ""),
        "license_url": meta.get("LicenseUrl", ""),
        "usage_terms": meta.get("UsageTerms", ""),
        "restrictions": meta.get("Restrictions", ""),
        "date": meta.get("DateTimeOriginal") or ii["timestamp"],
        "uploaded_at": ii["timestamp"],
    }


def slug(name: str) -> str:
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def official_info(file_url: str, page_url: str) -> dict[str, Any]:
    return {
        "official_file": file_url,
        "source_url": page_url,
        "download_url": file_url,
        "mime": mimetypes.guess_type(urllib.parse.urlsplit(file_url).path)[0] or "",
        "sha1": "",
        "author": "a própria marca (site oficial)",
        "license": "Sem licença aberta",
        "license_url": "",
        "usage_terms": "Logo publicado no site oficial da marca. Uso só para identificação "
        "interna no ERP até chegar o kit oficial.",
        "restrictions": "trademarked",
        "date": "",
        "uploaded_at": "",
    }


def download(url: str, dest: Path, sha1: str) -> tuple[str, str]:
    """Baixa, confere o sha1 (quando há) e recusa SVG ativo. Devolve (sha1, Last-Modified)."""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
        last_modified = resp.headers.get("Last-Modified", "")
    digest = hashlib.sha1(data).hexdigest()
    if sha1 and digest != sha1:
        raise ValueError(f"sha1 diferente do Commons: {dest.name}")
    if dest.suffix == ".svg" and UNSAFE_SVG.search(data):
        raise ValueError(f"SVG com conteúdo ativo recusado: {dest.name}")
    dest.write_bytes(data)
    return digest, last_modified


def collect(out: Path) -> list[dict[str, Any]]:
    jobs: list[dict[str, Any]] = [
        {
            "kind": "makes",
            "name": n,
            "fipe": [{"tipo": t, "nome": f} for t, f in fipe],
            "wikidata": q,
            "file": f_,
        }
        for n, fipe, q, f_ in MAKES
    ] + [
        {"kind": "insurers", "name": n, "fipe": [], "wikidata": q, "file": f_}
        for n, q, f_ in INSURERS
    ]

    p154 = wikidata_logos(sorted({j["wikidata"] for j in jobs if j["wikidata"] and not j["file"]}))
    retrieved_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    manifest: list[dict[str, Any]] = []
    for job in jobs:
        official = OFFICIAL.get(job["name"])
        filename = official[0] if official else job.pop("file") or p154.get(job["wikidata"])
        job.pop("file", None)
        entry: dict[str, Any] = {
            **job,
            "wikidata_url": (
                f"https://www.wikidata.org/wiki/{job['wikidata']}" if job["wikidata"] else ""
            ),
        }
        if not filename:
            logger.warning("sem logo: %s (%s) — fica no monograma", job["name"], job["wikidata"])
            manifest.append({**entry, "status": "missing"})
            continue
        try:
            info = official_info(*official) if official else commons_info(filename)
            ext = Path(urllib.parse.urlsplit(filename).path).suffix.lower()
            local = Path(job["kind"]) / f"{slug(job['name'])}{ext}"
            (out / job["kind"]).mkdir(parents=True, exist_ok=True)
            info["sha1"], last_modified = download(info["download_url"], out / local, info["sha1"])
            info["date"] = info["date"] or last_modified or retrieved_at
        except (OSError, LookupError, ValueError) as exc:
            logger.warning("falhou: %s (%s): %s", job["name"], filename, exc)
            manifest.append(
                {**entry, "source_file": filename, "status": "error", "error": str(exc)}
            )
            continue
        logger.info("ok: %-16s %-6s %s", job["name"], info["license"], filename)
        manifest.append(
            {
                **entry,
                **info,
                "local_file": str(local),
                "retrieved_at": retrieved_at,
                "status": "pending_review",
            }
        )
        time.sleep(
            0.5
        )  # ponytail: pausa fixa por educação com a API; sem retry/backoff, reexecute se falhar
    return manifest


def review_html(out: Path, manifest: list[dict[str, Any]]) -> str:
    def card(e: dict[str, Any]) -> str:
        if e.get("local_file"):
            data = base64.b64encode((out / e["local_file"]).read_bytes()).decode()
            img = f'<img src="data:{e["mime"]};base64,{data}" alt="{html.escape(e["name"])}">'
        else:
            img = f'<span class="miss">{html.escape(e["status"])}</span>'
        tipos = ", ".join(f'{f["tipo"]}: {f["nome"]}' for f in e["fipe"]) or "seguradora"
        lic = html.escape(e.get("license") or "—")
        if e.get("license_url"):
            lic = f'<a href="{html.escape(e["license_url"])}">{lic}</a>'
        restr = (
            f'<dt>Restrições</dt><dd>{html.escape(e["restrictions"])}</dd>'
            if e.get("restrictions")
            else ""
        )
        src = (
            f'<a href="{html.escape(e["source_url"])}">'
            f'{html.escape(e.get("commons_file") or e["official_file"])}</a>'
            if e.get("source_url")
            else html.escape(e.get("error", "sem P154"))
        )
        return (
            f'<article><div class="logo">{img}</div><h2>{html.escape(e["name"])}</h2>'
            f'<p class="fipe">{html.escape(tipos)}</p><dl>'
            f"<dt>Licença</dt><dd>{lic}</dd>{restr}"
            f'<dt>Autor</dt><dd>{html.escape((e.get("author") or "—")[:160])}</dd>'
            f'<dt>Data</dt><dd>{html.escape(str(e.get("date", "—"))[:40])}</dd>'
            f"<dt>Fonte</dt><dd>{src}</dd>"
            + (
                f'<dt>Wikidata</dt><dd><a href="{e["wikidata_url"]}">{e["wikidata"]}</a></dd>'
                if e["wikidata"]
                else ""
            )
            + "</dl></article>"
        )

    sections = "".join(
        f'<h1>{title} ({sum(1 for e in manifest if e["kind"] == kind)})</h1><div class="grid">'
        + "".join(card(e) for e in manifest if e["kind"] == kind)
        + "</div>"
        for kind, title in (("makes", "Montadoras"), ("insurers", "Seguradoras"))
    )
    return f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Revisão de logos</title><style>
:root{{--bg:#f6f6f4;--card:#fff;--ink:#1d1d1b;--mute:#6b6b66;--line:#e2e2dd;--warn:#fff4d6}}
@media (prefers-color-scheme:dark){{:root{{--bg:#151514;--card:#1f1f1d;--ink:#ecece8;--mute:#9a9a94;--line:#33332f;--warn:#3a3218}}}}
body{{margin:0;padding:24px 16px;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,sans-serif}}
.note{{background:var(--warn);border:1px solid var(--line);border-radius:8px;padding:12px 14px;max-width:900px}}
h1{{font-size:18px;margin:28px 0 12px}} h2{{font-size:15px;margin:10px 0 2px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}}
article{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;min-width:0}}
.logo{{height:110px;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:6px;border:1px solid var(--line)}}
.logo img{{max-width:85%;max-height:90px}} .miss{{color:#b3261e;font-weight:600}}
.fipe{{color:var(--mute);margin:0 0 8px;font-size:12px}}
dl{{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;margin:0;font-size:12px}}
dt{{color:var(--mute)}} dd{{margin:0;overflow-wrap:anywhere}} a{{color:inherit}}
</style></head><body>
<p class="note"><strong>Revisão antes do commit.</strong> Marcas registradas: uso só para identificação interna no ERP.
Usar no site público exige autorização por escrito de cada marca. Licença "Public domain" no Commons cobre o direito
autoral do desenho, não a marca. Nada foi para static/S3 nem para <code>logo_url</code>.</p>
{sections}</body></html>"""


def _selftest() -> None:
    def claim(v: str, rank: str = "normal", start: str = "", end: bool = False) -> dict[str, Any]:
        q: dict[str, Any] = {}
        if start:
            q["P580"] = [{"datavalue": {"value": {"time": start}}}]
        if end:
            q["P582"] = [{"datavalue": {"value": {"time": "+2000-00-00T00:00:00Z"}}}]
        return {"rank": rank, "mainsnak": {"datavalue": {"value": v}}, "qualifiers": q}

    assert pick_logo([]) is None
    assert pick_logo([claim("old.svg", end=True), claim("new.svg")]) == "new.svg"
    assert (
        pick_logo(
            [
                claim("a.svg", start="+2009-00-00T00:00:00Z"),
                claim("b.svg", start="+2021-00-00T00:00:00Z"),
            ]
        )
        == "b.svg"
    )
    assert pick_logo([claim("a.svg"), claim("p.svg", rank="preferred", end=True)]) == "p.svg"
    assert pick_logo([claim("x.svg", rank="deprecated")]) is None
    assert slug("Itaú Seguros") == "itau-seguros"
    assert UNSAFE_SVG.search(b'<svg onload="alert(1)">') and UNSAFE_SVG.search(b"<script>")
    assert not UNSAFE_SVG.search(b'<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>')
    assert slug("Citroën") == "citroen" and slug("Honda (moto)") == "honda-moto"


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--out", type=Path, default=Path(__file__).resolve().parent.parent / "data" / "logos"
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    _selftest()

    args.out.mkdir(parents=True, exist_ok=True)
    manifest = collect(args.out)
    (args.out / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (args.out / "review.html").write_text(review_html(args.out, manifest), encoding="utf-8")
    ok = sum(1 for e in manifest if e["status"] == "pending_review")
    logger.info("%d/%d logos em %s", ok, len(manifest), args.out)


if __name__ == "__main__":
    main()
