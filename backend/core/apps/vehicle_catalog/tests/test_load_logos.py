"""
Paddock Solutions — Vehicle Catalog Tests: load_logos

Usa o manifest real de data/logos e o InMemoryStorage dos testes.
"""

from django.core.management import call_command
from django.test import TestCase

from apps.insurers.models import Insurer
from apps.vehicle_catalog.models import VehicleMake


class TestLoadLogos(TestCase):
    def test_preenche_vazio_e_preserva_logo_do_admin(self) -> None:
        # update_or_create: a migração de seed já pode ter criado a seguradora.
        honda, _ = VehicleMake.objects.update_or_create(
            nome="Honda",
            defaults={"logo_url": ""},
            create_defaults={"fipe_id": "25", "nome_normalizado": "honda"},
        )
        fiat, _ = VehicleMake.objects.update_or_create(
            nome="Fiat",
            defaults={"logo_url": "https://cdn/admin.svg"},
            create_defaults={
                "fipe_id": "21",
                "nome_normalizado": "fiat",
                "logo_url": "https://cdn/admin.svg",
            },
        )
        allianz, _ = Insurer.objects.update_or_create(
            name="Allianz Seguros S.A.",
            defaults={"trade_name": "Allianz", "logo_url": ""},
            create_defaults={"trade_name": "Allianz", "cnpj": "61.573.796/0001-66"},
        )

        call_command("load_logos")
        call_command("load_logos")  # idempotente

        honda.refresh_from_db()
        fiat.refresh_from_db()
        allianz.refresh_from_db()
        # Sem VehicleMake.tipo só há carros: Honda recebe o "H", não a asa da moto.
        self.assertTrue(honda.logo_url.endswith("vehicle_catalog/logos/honda.svg"), honda.logo_url)
        self.assertEqual(fiat.logo_url, "https://cdn/admin.svg")
        self.assertTrue(allianz.logo_url.endswith("insurers/logos/allianz.svg"), allianz.logo_url)
