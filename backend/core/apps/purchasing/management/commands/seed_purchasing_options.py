"""Seed PrazoEntrega e CondicaoPagamento com opções padrão."""
from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context

from apps.tenants.models import Company


class Command(BaseCommand):
    help = "Seed purchasing options (PrazoEntrega, CondicaoPagamento) em todos os tenants"

    def handle(self, *args: object, **options: object) -> None:
        prazos = [
            ("Imediato (pronta entrega)", 0),
            ("1 dia útil", 1),
            ("2 dias úteis", 2),
            ("3 dias úteis", 3),
            ("5 dias úteis", 5),
            ("7 dias úteis", 7),
            ("10 dias úteis", 10),
            ("15 dias úteis", 15),
            ("30 dias úteis", 30),
        ]

        condicoes = [
            "Pix",
            "Dinheiro",
            "Transferência bancária",
            "Boleto à vista",
            "Boleto 7 dias",
            "Boleto 15 dias",
            "Boleto 30 dias",
            "Boleto 30/60",
            "Boleto 30/60/90",
            "Nota 10/20/30",
            "Nota 30/60/90",
            "Cartão crédito",
            "Cartão débito",
        ]

        tenants = Company.objects.exclude(schema_name="public")
        for tenant in tenants:
            self.stdout.write(f"\nTenant: {tenant.schema_name}")
            with schema_context(tenant.schema_name):
                from apps.purchasing.models import CondicaoPagamento, PrazoEntrega

                for label, dias in prazos:
                    PrazoEntrega.objects.get_or_create(
                        label=label, defaults={"dias_uteis": dias, "is_default": True},
                    )
                self.stdout.write(f"  {len(prazos)} prazos OK")

                for label in condicoes:
                    CondicaoPagamento.objects.get_or_create(
                        label=label, defaults={"is_default": True},
                    )
                self.stdout.write(f"  {len(condicoes)} condições OK")

        self.stdout.write(self.style.SUCCESS("\nSeed de purchasing options concluído."))
