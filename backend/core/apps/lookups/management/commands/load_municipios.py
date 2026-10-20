"""
Carga idempotente da tabela de municípios.

    python manage.py load_municipios                     # upsert a partir de data/municipios.json
    python manage.py load_municipios --from-ibge         # upsert a partir da API do IBGE
    python manage.py load_municipios --from-ibge --dump  # idem, e regrava data/municipios.json
"""

import json
from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from apps.lookups.models import Municipio
from apps.lookups.municipios import DATA_FILE, fetch_ibge, read_data_file, upsert


class Command(BaseCommand):
    help = "Carrega os municípios do IBGE (JSON local ou API de Localidades)."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--from-ibge", action="store_true", help="Busca na API do IBGE.")
        parser.add_argument("--dump", action="store_true", help="Regrava data/municipios.json.")

    def handle(self, *args: Any, **options: Any) -> None:
        if options["dump"] and not options["from_ibge"]:
            raise CommandError("--dump exige --from-ibge.")
        rows = fetch_ibge() if options["from_ibge"] else read_data_file()
        if options["dump"]:
            lines = ",\n".join(json.dumps(r, ensure_ascii=False) for r in rows)
            DATA_FILE.write_text(f"[\n{lines}\n]\n", encoding="utf-8")  # um município por linha
            self.stdout.write(f"{DATA_FILE}: {len(rows)} municípios")
        self.stdout.write(f"municípios: {upsert(Municipio, rows)} upserted")
