"""
Paddock Solutions — Pricing Profile — Management Command
setup_enquadramentos_demo: seed enquadramentos para os veículos mais comuns no Brasil.

Uso:
    python manage.py setup_enquadramentos_demo --schema tenant_dscar
"""
import logging
from typing import Any

from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context

logger = logging.getLogger(__name__)

# (marca, modelo, segmento_codigo, tamanho_codigo, ano_inicio, ano_fim)
# Tamanhos disponíveis: compacto, medio, suv_grande, extra_grande
_ENQUADRAMENTOS: list[tuple[str, str, str, str, int | None, int | None]] = [
    ("Volkswagen", "Gol",           "popular", "compacto",   2010, None),
    ("Volkswagen", "Polo",          "popular", "compacto",   2018, None),
    ("Volkswagen", "Voyage",        "popular", "compacto",   2010, None),
    ("Volkswagen", "Fox",           "popular", "compacto",   2010, 2020),
    ("Volkswagen", "Saveiro",       "popular", "compacto",   2010, None),
    ("Chevrolet",  "Onix",          "popular", "compacto",   2012, None),
    ("Chevrolet",  "Prisma",        "popular", "compacto",   2012, 2021),
    ("Chevrolet",  "Celta",         "popular", "compacto",   2000, 2016),
    ("Fiat",       "Palio",         "popular", "compacto",   2000, 2018),
    ("Fiat",       "Argo",          "popular", "compacto",   2017, None),
    ("Fiat",       "Mobi",          "popular", "compacto",   2016, None),
    ("Hyundai",    "HB20",          "popular", "compacto",   2012, None),
    ("Renault",    "Kwid",          "popular", "compacto",   2017, None),
    ("Toyota",     "Corolla",       "medio",   "medio",      2014, None),
    ("Toyota",     "Yaris",         "medio",   "compacto",   2018, None),
    ("Honda",      "Civic",         "medio",   "medio",      2012, None),
    ("Honda",      "City",          "medio",   "compacto",   2010, None),
    ("Honda",      "Fit",           "medio",   "compacto",   2009, None),
    ("Volkswagen", "Jetta",         "medio",   "medio",      2012, None),
    ("Volkswagen", "Golf",          "medio",   "medio",      2013, None),
    ("Chevrolet",  "Cruze",         "medio",   "medio",      2012, None),
    ("Chevrolet",  "Tracker",       "medio",   "medio",      2013, None),
    ("Hyundai",    "i30",           "medio",   "medio",      2012, None),
    ("Nissan",     "Sentra",        "medio",   "medio",      2014, None),
    ("Toyota",     "Hilux",         "medio",   "suv_grande", 2010, None),
    ("Chevrolet",  "S10",           "medio",   "suv_grande", 2012, None),
    ("Fiat",       "Toro",          "medio",   "suv_grande", 2016, None),
    ("Volkswagen", "Amarok",        "medio",   "suv_grande", 2010, None),
    ("BMW",        "320i",          "premium", "medio",      2014, None),
    ("Mercedes-Benz", "C200",       "premium", "medio",      2014, None),
    ("Audi",       "A3",            "premium", "compacto",   2014, None),
    ("Volvo",      "XC60",          "premium", "suv_grande", 2016, None),
    ("Porsche",    "Cayenne",       "luxo",    "suv_grande", 2015, None),
    ("BMW",        "M3",            "luxo",    "medio",      2015, None),
    ("Ferrari",    "488",           "exotico", "medio",      2015, None),
    ("Lamborghini", "Huracán",      "exotico", "medio",      2015, None),
]


class Command(BaseCommand):
    help = "Seed enquadramentos veiculares para demo."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--schema", type=str, default="")

    def handle(self, *args: object, **options: object) -> None:
        schema: str = str(options.get("schema") or "")
        if schema:
            ctx = schema_context(schema)
            ctx.__enter__()
            try:
                self._run()
            finally:
                ctx.__exit__(None, None, None)
        else:
            self._run()

    def _run(self) -> None:
        from apps.pricing_profile.models import (
            CategoriaTamanho,
            EnquadramentoVeiculo,
            SegmentoVeicular,
        )

        segmentos = {s.codigo: s for s in SegmentoVeicular.objects.filter(is_active=True)}
        tamanhos = {t.codigo: t for t in CategoriaTamanho.objects.filter(is_active=True)}

        criados = 0
        skipped = 0

        for marca, modelo, seg_cod, tam_cod, ano_ini, ano_fim in _ENQUADRAMENTOS:
            seg = segmentos.get(seg_cod)
            tam = tamanhos.get(tam_cod)

            if seg is None or tam is None:
                self.stdout.write(
                    f"  SKIP (segmento/tamanho não encontrado): "
                    f"{marca} {modelo} [{seg_cod}/{tam_cod}]"
                )
                continue

            _, created = EnquadramentoVeiculo.objects.get_or_create(
                marca__iexact=marca,
                modelo__iexact=modelo,
                segmento=seg,
                tamanho=tam,
                defaults={
                    "marca": marca,
                    "modelo": modelo,
                    "ano_inicio": ano_ini,
                    "ano_fim": ano_fim,
                    "prioridade": 10,
                    "is_active": True,
                },
            )
            if created:
                criados += 1
                self.stdout.write(f"  + {marca} {modelo} [{seg_cod}/{tam_cod}]")
            else:
                skipped += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"\nEnquadramentos criados: {criados}  |  Já existiam: {skipped}"
            )
        )
