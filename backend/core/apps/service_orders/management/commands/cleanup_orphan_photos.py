"""Marca como inativas as fotos pré-R2 (que apontam para /media/ no Railway).

Essas fotos foram uploaded antes da migração para Cloudflare R2.
Os registros existem no banco mas os arquivos estão inacessíveis
(Django prod com DEBUG=False não serve /media/, e o disco do
container Railway é efêmero — foi resetado a cada redeploy).

Usage:
    python manage.py cleanup_orphan_photos --dry-run
    python manage.py cleanup_orphan_photos --execute
"""
from __future__ import annotations

from django.core.management.base import BaseCommand, CommandParser
from django_tenants.utils import get_tenant_model, schema_context


class Command(BaseCommand):
    help = (
        "Marca como inativas (is_active=False) as fotos pré-R2 inacessíveis. "
        "Roda em todos os tenants automaticamente."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--execute",
            action="store_true",
            help="Aplica a mudança. Sem essa flag, apenas reporta (dry-run).",
        )
        parser.add_argument(
            "--tenant",
            type=str,
            default="",
            help="Schema específico (ex: tenant_dscar). Vazio = todos os tenants.",
        )

    def handle(self, *args, **options) -> None:
        execute: bool = options["execute"]
        single_tenant: str = options["tenant"]

        Tenant = get_tenant_model()
        if single_tenant:
            tenants = Tenant.objects.filter(schema_name=single_tenant)
        else:
            tenants = Tenant.objects.exclude(schema_name="public")

        total_affected = 0
        for tenant in tenants:
            self.stdout.write(self.style.NOTICE(f"\n→ Tenant: {tenant.schema_name}"))
            with schema_context(tenant.schema_name):
                from apps.service_orders.models import ServiceOrderPhoto

                qs = ServiceOrderPhoto.objects.filter(is_active=True)
                count = qs.count()
                self.stdout.write(f"  Fotos ativas encontradas: {count}")

                if count == 0:
                    continue

                if execute:
                    affected = qs.update(is_active=False)
                    self.stdout.write(
                        self.style.SUCCESS(f"  ✓ {affected} fotos marcadas como inativas")
                    )
                    total_affected += affected
                else:
                    self.stdout.write(
                        self.style.WARNING(
                            f"  [dry-run] {count} fotos seriam marcadas como inativas"
                        )
                    )
                    total_affected += count

        action = "marcadas como inativas" if execute else "afetadas (dry-run)"
        self.stdout.write(
            self.style.SUCCESS(f"\nTotal: {total_affected} fotos {action}.")
        )
        if not execute:
            self.stdout.write(
                self.style.NOTICE(
                    "Rode com --execute para aplicar a mudança."
                )
            )
