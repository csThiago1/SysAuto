"""
Management command — carrega os principais bancos (FEBRABAN) no banco de dados.
"""
import logging

from django.core.management.base import BaseCommand

from apps.banks.models import Bank

logger = logging.getLogger(__name__)

BANKS_SEED = [
    {"code": "001", "name": "Banco do Brasil"},
    {"code": "033", "name": "Santander"},
    {"code": "104", "name": "Caixa Econômica Federal"},
    {"code": "237", "name": "Bradesco"},
    {"code": "260", "name": "Nubank"},
    {"code": "290", "name": "PagBank"},
    {"code": "323", "name": "Mercado Pago"},
    {"code": "336", "name": "C6 Bank"},
    {"code": "341", "name": "Itaú Unibanco"},
    {"code": "422", "name": "Banco Safra"},
    {"code": "477", "name": "Citibank"},
    {"code": "633", "name": "Banco Rendimento"},
    {"code": "735", "name": "Banco Neon"},
    {"code": "748", "name": "Sicredi"},
    {"code": "756", "name": "Sicoob"},
    {"code": "077", "name": "Banco Inter"},
    {"code": "212", "name": "Banco Original"},
    {"code": "655", "name": "Banco Votorantim (BV)"},
    {"code": "070", "name": "BRB — Banco de Brasília"},
    {"code": "041", "name": "Banrisul"},
]


class Command(BaseCommand):
    help = "Carrega os principais bancos (FEBRABAN) no banco de dados."

    def handle(self, *args, **options):
        created, updated = 0, 0
        for entry in BANKS_SEED:
            _, was_created = Bank.objects.update_or_create(
                code=entry["code"], defaults={"name": entry["name"]}
            )
            if was_created:
                created += 1
            else:
                updated += 1
        self.stdout.write(
            self.style.SUCCESS(f"Bancos: {created} criados, {updated} atualizados.")
        )
