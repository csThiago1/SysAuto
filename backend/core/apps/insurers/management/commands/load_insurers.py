"""
Management command — carrega seguradoras base no banco de dados.
"""
import logging

from django.core.management.base import BaseCommand

from apps.insurers.models import Insurer

logger = logging.getLogger(__name__)

INSURERS_SEED = [
    {
        "name": "Bradesco Auto/RE Companhia de Seguros",
        "trade_name": "Bradesco Seguros",
        "cnpj": "27.649.497/0001-21",
        "brand_color": "#003DA5",
        "abbreviation": "BR",
    },
    {
        "name": "Porto Seguro Companhia de Seguros Gerais",
        "trade_name": "Porto Seguro",
        "cnpj": "61.198.164/0001-60",
        "brand_color": "#0054A6",
        "abbreviation": "PS",
    },
    {
        "name": "Azul Companhia de Seguros Gerais",
        "trade_name": "Azul Seguros",
        "cnpj": "33.707.437/0001-00",
        "brand_color": "#0078D4",
        "abbreviation": "AZ",
    },
    {
        "name": "HDI Seguros S.A.",
        "trade_name": "HDI Seguros",
        "cnpj": "29.980.158/0001-57",
        "brand_color": "#006633",
        "abbreviation": "HD",
    },
    {
        "name": "Tokio Marine Seguradora S.A.",
        "trade_name": "Tokio Marine",
        "cnpj": "33.164.021/0001-00",
        "brand_color": "#E60012",
        "abbreviation": "TM",
    },
    {
        "name": "Allianz Seguros S.A.",
        "trade_name": "Allianz",
        "cnpj": "61.573.796/0001-66",
        "brand_color": "#003781",
        "abbreviation": "AL",
    },
    {
        "name": "Itaú Seguros de Auto e Residência S.A.",
        "trade_name": "Itaú Seguros",
        "cnpj": "07.400.949/0001-68",
        "brand_color": "#003DA5",
        "abbreviation": "IT",
    },
    {
        "name": "Mitsui Sumitomo Seguros S.A.",
        "trade_name": "Mitsui Sumitomo",
        "cnpj": "60.106.302/0001-46",
        "brand_color": "#1B3C73",
        "abbreviation": "MS",
    },
    {
        "name": "Yelum Seguradora S.A.",
        "trade_name": "Yelum",
        "cnpj": "92.684.515/0001-37",
        "brand_color": "#5C2D91",
        "abbreviation": "YE",
    },
]


class Command(BaseCommand):
    help = "Carrega seguradoras base no banco de dados (idempotente)"

    def handle(self, *args: object, **options: object) -> None:
        created_count = 0
        for data in INSURERS_SEED:
            obj, created = Insurer.objects.get_or_create(
                cnpj=data["cnpj"],
                defaults=data,
            )
            if created:
                created_count += 1
                logger.info("Seguradora criada: %s", obj.name)
        self.stdout.write(
            self.style.SUCCESS(
                f"{created_count} seguradoras criadas, "
                f"{len(INSURERS_SEED) - created_count} já existiam."
            )
        )
