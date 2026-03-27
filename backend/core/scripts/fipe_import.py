#!/usr/bin/env python
"""
Importação do catálogo FIPE para a base local.

Fonte: API pública FIPE (brasilapi.com.br/api/fipe)
Uso:   python scripts/fipe_import.py [--type car|motorcycle|truck] [--dry-run]

O script é idempotente: re-executar não cria duplicatas (usa get_or_create).
Salva progresso em cache local (fipe_cache.json) para retomar em caso de falha.

Execute a partir de backend/core/:
    python scripts/fipe_import.py
    python scripts/fipe_import.py --type motorcycle
"""

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path

import django

# ── Setup Django ──────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.vehicles.models import VehicleBrand, VehicleModel, VehicleVersion  # noqa: E402

try:
    import httpx
except ImportError:
    print("Instale httpx: pip install httpx")
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("fipe_import")

BRASIL_API = "https://brasilapi.com.br/api/fipe/tabelas/v1"
FIPE_API   = "https://brasilapi.com.br/api/fipe"
CACHE_FILE = BASE_DIR / "scripts" / "fipe_cache.json"

VEHICLE_TYPE_MAP = {
    "car":        {"api_key": "carros", "label": "car"},
    "motorcycle": {"api_key": "motos",  "label": "motorcycle"},
    "truck":      {"api_key": "caminhoes", "label": "truck"},
}

DELAY = 0.3   # segundos entre requests (respeitar rate limit)
TIMEOUT = 15.0


def load_cache() -> dict:
    if CACHE_FILE.exists():
        with open(CACHE_FILE) as f:
            return json.load(f)
    return {}


def save_cache(cache: dict) -> None:
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def fetch_brands(client: httpx.Client, vehicle_type: str) -> list[dict]:
    api_key = VEHICLE_TYPE_MAP[vehicle_type]["api_key"]
    resp = client.get(f"{FIPE_API}/marcas/v1/{api_key}", timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def fetch_models(client: httpx.Client, vehicle_type: str, brand_code: str) -> list[dict]:
    api_key = VEHICLE_TYPE_MAP[vehicle_type]["api_key"]
    resp = client.get(f"{FIPE_API}/modelos/v1/{api_key}/{brand_code}", timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json().get("modelos", [])


def fetch_versions(client: httpx.Client, vehicle_type: str, brand_code: str, model_code: str) -> list[dict]:
    api_key = VEHICLE_TYPE_MAP[vehicle_type]["api_key"]
    resp = client.get(f"{FIPE_API}/modelos/v1/{api_key}/{brand_code}/{model_code}", timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def import_vehicle_type(vehicle_type: str, dry_run: bool) -> dict:
    label = VEHICLE_TYPE_MAP[vehicle_type]["label"]
    cache = load_cache()
    cache_key = f"done_{vehicle_type}"
    stats = {"brands": 0, "models": 0, "versions": 0, "skipped": 0}

    logger.info(f"▶ Importando {vehicle_type} ({label}) ...")

    with httpx.Client(headers={"User-Agent": "DS-Car-ERP/1.0"}) as client:
        brands = fetch_brands(client, vehicle_type)
        logger.info(f"  {len(brands)} marcas encontradas")

        for brand_data in brands:
            brand_code = str(brand_data["codigo"])
            brand_name = brand_data["nome"].strip()
            brand_cache_key = f"{vehicle_type}_{brand_code}"

            if brand_cache_key in cache:
                stats["skipped"] += 1
                continue

            if not dry_run:
                brand_obj, created = VehicleBrand.objects.get_or_create(
                    fipe_brand_id=int(brand_code),
                    defaults={"name": brand_name, "vehicle_type": label},
                )
                if not created:
                    brand_obj.name = brand_name
                    brand_obj.save(update_fields=["name"])
            else:
                brand_obj = None

            stats["brands"] += 1
            time.sleep(DELAY)

            try:
                models = fetch_models(client, vehicle_type, brand_code)
            except Exception as exc:
                logger.warning(f"  Falha ao buscar modelos de {brand_name}: {exc}")
                continue

            for model_data in models:
                model_code = str(model_data["codigo"])
                model_name = model_data["nome"].strip()

                if not dry_run and brand_obj:
                    model_obj, _ = VehicleModel.objects.get_or_create(
                        brand=brand_obj,
                        fipe_model_id=int(model_code),
                        defaults={"name": model_name},
                    )
                else:
                    model_obj = None

                stats["models"] += 1
                time.sleep(DELAY)

                try:
                    versions = fetch_versions(client, vehicle_type, brand_code, model_code)
                except Exception as exc:
                    logger.warning(f"    Falha ao buscar versões de {model_name}: {exc}")
                    continue

                for ver in versions:
                    fipe_code = ver.get("codigo", "").strip()
                    if not fipe_code:
                        continue
                    year_str = str(ver.get("ano", "0"))
                    year_model = int(year_str.split("-")[0]) if year_str.isdigit() or "-" in year_str else 0
                    fuel = ver.get("combustivel", "")
                    full_name = f"{brand_name} {model_name} {year_model}".strip()

                    if not dry_run and model_obj:
                        VehicleVersion.objects.get_or_create(
                            fipe_code=fipe_code,
                            defaults={
                                "model": model_obj,
                                "year_model": year_model,
                                "fuel": fuel,
                                "full_name": full_name,
                            },
                        )

                    stats["versions"] += 1

            # Marca brand como concluída no cache
            cache[brand_cache_key] = True
            save_cache(cache)
            logger.info(f"  ✓ {brand_name}: {stats['models']} modelos")

    cache[cache_key] = True
    save_cache(cache)
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Importação do catálogo FIPE")
    parser.add_argument("--type", choices=["car", "motorcycle", "truck", "all"], default="car")
    parser.add_argument("--dry-run", action="store_true", help="Não grava no banco")
    args = parser.parse_args()

    types = list(VEHICLE_TYPE_MAP.keys()) if args.type == "all" else [args.type]

    if args.dry_run:
        logger.info("🔍 DRY RUN — nenhuma alteração no banco")

    total = {"brands": 0, "models": 0, "versions": 0, "skipped": 0}
    for vtype in types:
        stats = import_vehicle_type(vtype, dry_run=args.dry_run)
        for k in total:
            total[k] += stats[k]

    logger.info(
        f"\n✅ Concluído — "
        f"{total['brands']} marcas, "
        f"{total['models']} modelos, "
        f"{total['versions']} versões "
        f"({total['skipped']} marcas já no cache)"
    )


if __name__ == "__main__":
    main()
