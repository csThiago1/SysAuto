"""
Carga do catálogo FIPE completo a partir do dump fipeX.

    python manage.py sync_fipe_catalog                  # mês corrente; 404 → mês anterior
    python manage.py sync_fipe_catalog --month 2026-10
    python manage.py sync_fipe_catalog --file /tmp/fipex.tsv
"""

from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from apps.vehicle_catalog.fipe_sync import fetch_and_load, load_fipex, ref_from_file


class Command(BaseCommand):
    help = "Carrega o catálogo FIPE (marcas, famílias, versões e anos) do dump fipeX."

    def add_arguments(self, parser: CommandParser) -> None:
        group = parser.add_mutually_exclusive_group()
        group.add_argument("--file", type=Path, help="TSV fipeX já baixado.")
        group.add_argument("--month", help="Mês do dump, YYYY-MM.")

    def handle(self, *args: Any, **options: Any) -> None:
        try:
            if options["file"]:
                rep = load_fipex(options["file"], ref=ref_from_file(options["file"]))
            else:
                rep = fetch_and_load(options["month"])
        except FileNotFoundError as exc:
            raise CommandError(str(exc)) from exc
        for table in ("makes", "families", "models", "versions"):
            counts = getattr(rep, table)
            self.stdout.write(
                f"{table}: {counts['upserted']} upserted, {counts['deactivated']} desativados"
            )
        fams = rep.single_version_families
        self.stdout.write(f"famílias com uma só versão: {len(fams)}")
        for nome in fams[:50]:
            self.stdout.write(f"  {nome}")
