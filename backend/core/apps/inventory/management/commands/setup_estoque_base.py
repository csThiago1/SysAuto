"""Seeds de estoque: 4 armazéns DS Car. Idempotente."""
import logging

from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context

from apps.inventory.models_location import Armazem

logger = logging.getLogger(__name__)

ARMAZENS_DSCAR = [
    {"codigo": "G1", "nome": "Galpão Principal", "tipo": "galpao"},
    {"codigo": "G2", "nome": "Galpão Secundário", "tipo": "galpao"},
    {"codigo": "G3", "nome": "Galpão Reserva", "tipo": "galpao"},
    {"codigo": "PT1", "nome": "Pátio Externo", "tipo": "patio"},
]


class Command(BaseCommand):
    help = "Popula dados base de estoque (armazéns DS Car). Idempotente."

    def handle(self, *args: object, **options: object) -> None:
        schema = "tenant_dscar"
        with schema_context(schema):
            created = 0
            for data in ARMAZENS_DSCAR:
                _, was_created = Armazem.objects.get_or_create(
                    codigo=data["codigo"],
                    defaults={"nome": data["nome"], "tipo": data["tipo"]},
                )
                if was_created:
                    created += 1
            logger.info(
                "Armazéns: %d criados, %d já existiam.",
                created,
                len(ARMAZENS_DSCAR) - created,
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f"Setup estoque base concluído: {created} armazéns criados."
                )
            )
