"""
Preenche logo_url de montadoras (VehicleMake) e seguradoras (Insurer) com os logos aprovados
em data/logos/manifest.json (gerado por scripts/collect_logos.py).

- Os arquivos vão para o default_storage (local em dev, S3/R2 em homolog/prod), como no upload_logo.
- Só preenche logo_url vazio: logo trocado pelo administrador nunca é sobrescrito.
- Idempotente: rodar de novo depois de cada carga do catálogo FIPE.
- Logos são marcas registradas: uso só para identificação interna no ERP.

    python manage.py load_logos
"""

import json
import logging
import operator
from functools import reduce
from typing import Any

from django.conf import settings
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand
from django.db.models import Q, QuerySet
from django.utils import timezone
from django_tenants.utils import schema_context

from apps.insurers.models import Insurer
from apps.vehicle_catalog.models import VehicleMake

logger = logging.getLogger(__name__)

LOGOS_DIR = settings.BASE_DIR / "data" / "logos"

# ponytail: o plano do catálogo adiciona VehicleMake.tipo; até lá o banco só tem carros.
HAS_TIPO = any(f.name == "tipo" for f in VehicleMake._meta.get_fields())


def _targets(entry: dict[str, Any]) -> QuerySet:
    if entry["kind"] == "insurers":
        return Insurer.objects.filter(trade_name__iexact=entry["name"])
    conds = [
        Q(tipo=f["tipo"], nome__iexact=f["nome"]) if HAS_TIPO else Q(nome__iexact=f["nome"])
        for f in entry["fipe"]
        if HAS_TIPO or f["tipo"] == "carro"
    ]
    return (
        VehicleMake.objects.filter(reduce(operator.or_, conds))
        if conds
        else VehicleMake.objects.none()
    )


class Command(BaseCommand):
    help = (
        "Preenche logo_url vazio de montadoras e seguradoras a partir de data/logos/manifest.json."
    )

    def handle(self, *args: Any, **options: Any) -> None:
        manifest = json.loads((LOGOS_DIR / "manifest.json").read_text(encoding="utf-8"))
        filled = 0
        with schema_context("public"):
            for entry in manifest:
                if entry.get("status") != "approved":
                    continue
                targets = _targets(entry).filter(logo_url="")
                if not targets.exists():
                    continue
                folder = "insurers" if entry["kind"] == "insurers" else "vehicle_catalog"
                src = LOGOS_DIR / entry["local_file"]
                path = f"{folder}/logos/{src.name}"
                if not default_storage.exists(path):
                    path = default_storage.save(path, ContentFile(src.read_bytes()))
                extra = {"updated_at": timezone.now()} if entry["kind"] == "insurers" else {}
                count = targets.update(logo_url=default_storage.url(path), **extra)
                filled += count
                logger.info("Logo %s aplicado em %d registro(s)", entry["name"], count)
        cache.delete("insurers:active")
        self.stdout.write(self.style.SUCCESS(f"{filled} logo_url preenchido(s)."))
