"""Seeds de estoque: 4 armazéns DS Car. Idempotente."""
import logging

from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context

from apps.inventory.models_location import Armazem
from apps.inventory.models_product import TipoPeca

logger = logging.getLogger(__name__)

TIPOS_PECA_DSCAR = [
    {"codigo": "PCHQ", "nome": "Para-choque"},
    {"codigo": "CAPO", "nome": "Capô"},
    {"codigo": "TAMP", "nome": "Tampa Traseira"},
    {"codigo": "PORT", "nome": "Porta"},
    {"codigo": "PBRZ", "nome": "Parabrisas"},
    {"codigo": "VIGA", "nome": "Vigia"},
    {"codigo": "VDPT", "nome": "Vidro de Porta"},
    {"codigo": "VDLT", "nome": "Vidro Lateral"},
    {"codigo": "RETV", "nome": "Retrovisor"},
    {"codigo": "FARL", "nome": "Farol"},
    {"codigo": "LANT", "nome": "Lanterna"},
    {"codigo": "RODA", "nome": "Roda"},
    {"codigo": "PNEU", "nome": "Pneu"},
    {"codigo": "AMRT", "nome": "Amortecedor"},
    {"codigo": "FILT", "nome": "Filtro"},
    {"codigo": "COXM", "nome": "Coxim"},
    {"codigo": "RADI", "nome": "Radiador"},
    {"codigo": "COND", "nome": "Condensador"},
    {"codigo": "ELTV", "nome": "Eletroventilador"},
    {"codigo": "OUTR", "nome": "Outros"},
]

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
            # --- Tipos de Peça ---
            tipos_created = 0
            for idx, data in enumerate(TIPOS_PECA_DSCAR, start=1):
                _, was_created = TipoPeca.objects.get_or_create(
                    codigo=data["codigo"],
                    defaults={"nome": data["nome"], "ordem": idx * 10},
                )
                if was_created:
                    tipos_created += 1
            logger.info(
                "Tipos de peça: %d criados, %d já existiam.",
                tipos_created,
                len(TIPOS_PECA_DSCAR) - tipos_created,
            )

            self.stdout.write(
                self.style.SUCCESS(
                    f"Setup estoque base concluído: {created} armazéns, "
                    f"{tipos_created} tipos de peça criados."
                )
            )
