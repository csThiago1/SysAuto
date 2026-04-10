"""
Management command — carrega cores de veículos no banco de dados.
"""
import logging

from django.core.management.base import BaseCommand

from apps.vehicle_catalog.models import VehicleColor

logger = logging.getLogger(__name__)

COLORS_SEED = [
    {"name": "Prata", "hex_code": "#C0C0C0"},
    {"name": "Preto", "hex_code": "#1A1A1A"},
    {"name": "Branco", "hex_code": "#F5F5F5"},
    {"name": "Vermelho", "hex_code": "#CC0000"},
    {"name": "Azul", "hex_code": "#1A1A8B"},
    {"name": "Cinza", "hex_code": "#808080"},
    {"name": "Marrom", "hex_code": "#8B4513"},
    {"name": "Verde", "hex_code": "#006400"},
    {"name": "Dourado", "hex_code": "#DAA520"},
    {"name": "Bege", "hex_code": "#F5F5DC"},
    {"name": "Amarelo", "hex_code": "#FFD700"},
    {"name": "Laranja", "hex_code": "#FF8C00"},
    {"name": "Vinho", "hex_code": "#722F37"},
    {"name": "Rosa", "hex_code": "#FF69B4"},
]


class Command(BaseCommand):
    help = "Carrega cores de veículos no banco de dados (idempotente)"

    def handle(self, *args: object, **options: object) -> None:
        created_count = 0
        for data in COLORS_SEED:
            _, created = VehicleColor.objects.get_or_create(
                name=data["name"],
                defaults=data,
            )
            if created:
                created_count += 1
        self.stdout.write(
            self.style.SUCCESS(
                f"{created_count} cores criadas, "
                f"{len(COLORS_SEED) - created_count} já existiam."
            )
        )
