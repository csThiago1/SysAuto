"""
Paddock Solutions — Parts Catalog seed command.

Imports PartReference, PartApplication, and PartSupplierRef records from the
cleaned legacy spreadsheet `data/migrations/catalogo_pecas_limpo.xlsx`.

Usage
-----
    python manage.py seed_parts_catalog
    python manage.py seed_parts_catalog --dry-run
    python manage.py seed_parts_catalog --batch-size 500
"""

from __future__ import annotations

import logging
import unicodedata
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandParser
from django.db import transaction

logger = logging.getLogger(__name__)

# Absolute path resolved relative to this file (5 parents up = repo root).
XLSX_PATH = (
    Path(__file__).resolve().parents[6] / "data" / "migrations" / "catalogo_pecas_limpo.xlsx"
)

SHEET_NAME = "Catálogo"

# (code, display_name, order)
CATEGORY_SEED: list[tuple[str, str, int]] = [
    ("CARROCERIA", "Carroceria", 10),
    ("ILUMINACAO", "Iluminação", 20),
    ("SUSPENSAO", "Suspensão", 30),
    ("ARREFECIMENTO_AR", "Arrefecimento / Ar Condicionado", 40),
    ("RODAS_PNEUS", "Rodas e Pneus", 50),
    ("EMBLEMAS_ADESIVOS", "Emblemas e Adesivos", 60),
    ("PINTURA_INSUMOS", "Pintura e Insumos", 70),
    ("MOTOR_TRANSMISSAO", "Motor e Transmissão", 80),
    ("VIDROS", "Vidros", 90),
    ("ELETRICA", "Elétrica", 100),
    ("CONSUMIVEIS", "Consumíveis", 110),
    ("FREIOS", "Freios", 120),
    ("OUTROS", "Outros", 999),
]


def _normalize(text: str) -> str:
    """Return uppercase text with diacritics removed for fuzzy matching."""
    nfkd = unicodedata.normalize("NFKD", text)
    ascii_str = nfkd.encode("ascii", "ignore").decode("ascii")
    return ascii_str.upper()


def _safe_str(value: Any) -> str:
    """Convert a pandas cell value to str, returning '' for NaN/None."""
    try:
        import pandas as pd  # noqa: PLC0415 — lazy import, already checked

        if pd.isna(value):
            return ""
    except (TypeError, ValueError):
        # pd.isna raises on some types; treat as non-null
        pass
    return str(value).strip()


def _safe_int(value: Any) -> int | None:
    """Convert a pandas numeric cell to int, returning None for NaN."""
    try:
        import pandas as pd  # noqa: PLC0415

        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def _ncm_str(value: Any) -> str:
    """
    Convert NCM float (e.g. 87089100.0) → zero-padded 8-char string.

    Focus NF-e requires exactly 8 digits.
    """
    raw = _safe_str(value)
    if not raw:
        return ""
    # Strip trailing .0 introduced by pandas float parsing
    if raw.endswith(".0"):
        raw = raw[:-2]
    # Keep only digits, zero-pad to 8
    digits = raw.replace(".", "").replace(",", "")
    if digits.isdigit():
        return digits.zfill(8)[:8]
    return ""


class Command(BaseCommand):
    """Seed parts_catalog from cleaned legacy spreadsheet."""

    help = (
        "Seed PartCategory, PartReference, PartApplication, and PartSupplierRef "
        "from data/migrations/catalogo_pecas_limpo.xlsx."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Parse and validate without writing to the database.",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=200,
            help="Number of rows to process per transaction batch (default 200).",
        )

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    def handle(self, *args: Any, **options: Any) -> None:
        dry_run: bool = options["dry_run"]
        batch_size: int = options["batch_size"]

        # Lazy pandas import with helpful error message
        try:
            import pandas as pd
        except ImportError:
            self.stderr.write(
                self.style.ERROR(
                    "pandas is required: pip install pandas openpyxl"
                )
            )
            return

        if not XLSX_PATH.exists():
            self.stderr.write(
                self.style.ERROR(f"Spreadsheet not found: {XLSX_PATH}")
            )
            return

        self.stdout.write(f"Reading {XLSX_PATH} …")
        df = pd.read_excel(XLSX_PATH, sheet_name=SHEET_NAME, dtype=str)

        # Normalize column names to strip accidental whitespace
        df.columns = [c.strip() for c in df.columns]

        # Filter: codigo_fabricante must be present and have at least 2 chars
        df = df[df["codigo_fabricante"].notna()]
        df = df[df["codigo_fabricante"].str.strip().str.len() >= 2]
        df["codigo_fabricante"] = df["codigo_fabricante"].str.strip()

        total_rows = len(df)
        self.stdout.write(f"Rows after filtering: {total_rows}")

        if dry_run:
            self.stdout.write(self.style.WARNING("--dry-run: no data will be written."))

        # ------------------------------------------------------------------
        # Step 1 — Seed categories
        # ------------------------------------------------------------------
        categories = self._seed_categories(dry_run)

        # ------------------------------------------------------------------
        # Step 2 — Build vehicle lookup caches (public schema)
        # ------------------------------------------------------------------
        make_by_name, make_by_norm, model_by_norm = self._build_vehicle_caches()

        # ------------------------------------------------------------------
        # Step 3 — Process rows in batches
        # ------------------------------------------------------------------
        counters = {
            "refs_created": 0,
            "refs_existing": 0,
            "apps_created": 0,
            "apps_skipped": 0,
            "suppliers_created": 0,
            "suppliers_skipped": 0,
            "make_not_found": 0,
        }

        batches = [df.iloc[i : i + batch_size] for i in range(0, total_rows, batch_size)]
        total_batches = len(batches)

        for batch_idx, batch in enumerate(batches, start=1):
            self.stdout.write(
                f"  Batch {batch_idx}/{total_batches} "
                f"(rows {(batch_idx - 1) * batch_size + 1}–"
                f"{min(batch_idx * batch_size, total_rows)}) …",
                ending="\r",
            )
            self.stdout.flush()

            if not dry_run:
                with transaction.atomic():
                    self._process_batch(
                        batch,
                        categories,
                        make_by_name,
                        make_by_norm,
                        model_by_norm,
                        counters,
                    )
            else:
                # Dry-run: just count what would happen without saving
                self._process_batch(
                    batch,
                    categories,
                    make_by_name,
                    make_by_norm,
                    model_by_norm,
                    counters,
                    simulate=True,
                )

        # Final newline after \r progress output
        self.stdout.write("")

        # ------------------------------------------------------------------
        # Summary
        # ------------------------------------------------------------------
        mode_label = "[DRY-RUN] " if dry_run else ""
        self.stdout.write(self.style.SUCCESS(f"\n{mode_label}Seed complete."))
        self.stdout.write(f"  PartReference created  : {counters['refs_created']}")
        self.stdout.write(f"  PartReference existing : {counters['refs_existing']}")
        self.stdout.write(f"  PartApplication created: {counters['apps_created']}")
        self.stdout.write(f"  PartApplication skipped: {counters['apps_skipped']}")
        self.stdout.write(f"  PartSupplierRef created: {counters['suppliers_created']}")
        self.stdout.write(f"  PartSupplierRef skipped: {counters['suppliers_skipped']}")
        self.stdout.write(f"  Make not found in FIPE : {counters['make_not_found']}")

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _seed_categories(self, dry_run: bool) -> dict[str, Any]:
        """
        Create PartCategory rows defined in CATEGORY_SEED.

        Returns a dict mapping category code → PartCategory instance (or a
        lightweight stub dict in dry-run mode).
        """
        from apps.parts_catalog.models import PartCategory  # noqa: PLC0415

        categories: dict[str, Any] = {}
        created_count = 0

        for code, name, order in CATEGORY_SEED:
            if dry_run:
                categories[code] = {"code": code, "name": name, "order": order}
                continue
            obj, created = PartCategory.objects.get_or_create(
                code=code,
                defaults={"name": name, "order": order},
            )
            if created:
                created_count += 1
            categories[code] = obj

        if dry_run:
            self.stdout.write(
                f"[dry-run] Would ensure {len(CATEGORY_SEED)} categories exist."
            )
        else:
            self.stdout.write(
                f"Categories: {created_count} created, "
                f"{len(CATEGORY_SEED) - created_count} already existed."
            )

        return categories

    def _build_vehicle_caches(
        self,
    ) -> tuple[
        dict[str, Any],
        dict[str, Any],
        dict[tuple[int, str], Any],
    ]:
        """
        Load all VehicleMake and VehicleModel into memory for O(1) lookup.

        Returns
        -------
        make_by_name : {UPPERCASE_NAME: VehicleMake}
        make_by_norm : {NORMALIZED_UPPERCASE: VehicleMake}
        model_by_norm: {(make_pk, NORMALIZED_UPPERCASE): VehicleModel}
        """
        from apps.vehicle_catalog.models import VehicleMake, VehicleModel  # noqa: PLC0415

        make_by_name: dict[str, Any] = {}
        make_by_norm: dict[str, Any] = {}

        for make in VehicleMake.objects.all():
            make_by_name[make.nome.upper()] = make
            make_by_norm[make.nome_normalizado.upper()] = make

        model_by_norm: dict[tuple[int, str], Any] = {}
        for model in VehicleModel.objects.select_related("marca").all():
            key = (model.marca_id, model.nome_normalizado.upper())
            model_by_norm[key] = model

        self.stdout.write(
            f"Vehicle cache loaded: {len(make_by_name)} makes, "
            f"{len(model_by_norm)} models."
        )
        return make_by_name, make_by_norm, model_by_norm

    def _resolve_make(
        self,
        raw_make: str,
        make_by_name: dict[str, Any],
        make_by_norm: dict[str, Any],
    ) -> Any | None:
        """
        Attempt to match a raw make string to a VehicleMake.

        Tries exact uppercase match first, then normalized (no-accent) match.
        """
        if not raw_make:
            return None
        upper = raw_make.upper()
        if upper in make_by_name:
            return make_by_name[upper]
        norm = _normalize(raw_make)
        return make_by_norm.get(norm)

    def _resolve_model(
        self,
        raw_model: str,
        make: Any,
        model_by_norm: dict[tuple[int, str], Any],
    ) -> Any | None:
        """
        Attempt to match a raw model string to a VehicleModel within a make.

        Returns None if no match is found — callers treat None as
        "compatible with all models of this make".
        """
        if not raw_model or make is None:
            return None
        make_pk = make.pk if hasattr(make, "pk") else None
        if make_pk is None:
            return None
        norm = _normalize(raw_model)
        return model_by_norm.get((make_pk, norm))

    def _process_batch(
        self,
        batch: Any,
        categories: dict[str, Any],
        make_by_name: dict[str, Any],
        make_by_norm: dict[str, Any],
        model_by_norm: dict[tuple[int, str], Any],
        counters: dict[str, int],
        simulate: bool = False,
    ) -> None:
        """Process a DataFrame batch, inserting or counting records."""
        from apps.parts_catalog.models import (  # noqa: PLC0415
            PartApplication,
            PartReference,
            PartSupplierRef,
        )

        for _, row in batch.iterrows():
            manufacturer_code = str(row["codigo_fabricante"]).strip()
            if len(manufacturer_code) < 2:
                continue

            # Resolve category — fallback to OUTROS
            raw_cat = _safe_str(row.get("categoria", ""))
            category = categories.get(raw_cat) or categories.get("OUTROS")

            description = _safe_str(row.get("descricao", ""))
            description_original = _safe_str(row.get("descricao_original", ""))
            ncm = _ncm_str(row.get("ncm", ""))
            unit_raw = _safe_str(row.get("unidade", ""))
            unit = unit_raw if unit_raw else "PC"
            ean = _safe_str(row.get("codigo_barras", ""))

            # ------------------------------------------------------------------
            # PartReference
            # ------------------------------------------------------------------
            if simulate:
                # In dry-run we cannot call get_or_create; just increment created
                counters["refs_created"] += 1
                part_ref_pk = None
            else:
                ref_obj, ref_created = PartReference.objects.get_or_create(
                    manufacturer_code=manufacturer_code,
                    defaults={
                        "description": description or manufacturer_code,
                        "description_original": description_original,
                        "category": category,
                        "ncm": ncm,
                        "unit": unit,
                        "ean": ean,
                    },
                )
                if ref_created:
                    counters["refs_created"] += 1
                else:
                    counters["refs_existing"] += 1
                part_ref_pk = ref_obj.pk

            # ------------------------------------------------------------------
            # PartApplication
            # ------------------------------------------------------------------
            raw_make = _safe_str(row.get("veiculo_marca", ""))
            if raw_make:
                make_obj = self._resolve_make(raw_make, make_by_name, make_by_norm)
                if make_obj is None:
                    counters["make_not_found"] += 1
                else:
                    raw_model = _safe_str(row.get("veiculo_modelo", ""))
                    model_obj = self._resolve_model(raw_model, make_obj, model_by_norm)
                    year_start = _safe_int(row.get("veiculo_ano_de", ""))
                    year_end = _safe_int(row.get("veiculo_ano_ate", ""))

                    if simulate:
                        counters["apps_created"] += 1
                    else:
                        _, app_created = PartApplication.objects.get_or_create(
                            part_ref_id=part_ref_pk,
                            make=make_obj,
                            model=model_obj,
                            source=PartApplication.Source.SEED,
                            defaults={
                                "year_start": year_start,
                                "year_end": year_end,
                                "confidence_score": 50,
                            },
                        )
                        if app_created:
                            counters["apps_created"] += 1
                        else:
                            counters["apps_skipped"] += 1

            # ------------------------------------------------------------------
            # PartSupplierRef
            # ------------------------------------------------------------------
            raw_suppliers = _safe_str(row.get("fornecedores", ""))
            if raw_suppliers:
                supplier_names = [
                    s.strip() for s in raw_suppliers.split("|") if s.strip()
                ]
                for supplier_name in supplier_names:
                    if not supplier_name:
                        continue
                    if simulate:
                        counters["suppliers_created"] += 1
                    else:
                        _, sup_created = PartSupplierRef.objects.get_or_create(
                            part_ref_id=part_ref_pk,
                            supplier_name=supplier_name,
                            defaults={"supplier_code": ""},
                        )
                        if sup_created:
                            counters["suppliers_created"] += 1
                        else:
                            counters["suppliers_skipped"] += 1
