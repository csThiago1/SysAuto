"""
Paddock Solutions — Accounting: Management Command setup_chart_of_accounts

Inicializa o plano de contas padrão DS Car no schema de tenant informado.

Uso:
    python manage.py setup_chart_of_accounts --schema tenant_dscar
    python manage.py setup_chart_of_accounts --schema tenant_dscar --reset
    python manage.py setup_chart_of_accounts --all-tenants
"""
import logging
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django_tenants.utils import schema_context

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    """
    Inicializa o plano de contas padrão DS Car para um tenant específico.

    O plano de contas reside no schema do tenant (TENANT_APPS), por isso
    é obrigatório informar --schema ou --all-tenants.

    Args:
        --schema: Nome do schema do tenant (ex: tenant_dscar).
        --all-tenants: Executa em todos os tenants não-públicos.
        --reset: Recria/atualiza contas existentes (não afeta lançamentos).
    """

    help = "Inicializa plano de contas padrão DS Car para um tenant."

    def add_arguments(self, parser: Any) -> None:
        group = parser.add_mutually_exclusive_group(required=True)
        group.add_argument(
            "--schema",
            type=str,
            help="Schema do tenant onde o plano será criado (ex: tenant_dscar).",
        )
        group.add_argument(
            "--all-tenants",
            action="store_true",
            help="Executa em todos os tenants não-públicos.",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Recria/atualiza contas existentes sem afetar lançamentos.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        from apps.tenants.models import Company

        reset = options["reset"]
        schema_name = options.get("schema")
        all_tenants = options.get("all_tenants")

        if all_tenants:
            schemas = list(
                Company.objects.exclude(schema_name="public")
                .values_list("schema_name", flat=True)
            )
        else:
            if not Company.objects.filter(schema_name=schema_name).exists():
                raise CommandError(
                    f"Schema '{schema_name}' não encontrado. "
                    f"Use 'manage.py shell' para listar os tenants disponíveis."
                )
            schemas = [schema_name]

        for schema in schemas:
            self.stdout.write(
                self.style.NOTICE(f"\n[{schema}] Iniciando setup do plano de contas...")
            )
            with schema_context(schema):
                self._setup_for_tenant(schema, reset)

    def _setup_for_tenant(self, schema: str, reset: bool) -> None:
        """Executa o setup do plano de contas dentro do schema_context correto."""
        from apps.accounting.fixtures.chart_of_accounts_dscar import (
            CHART_OF_ACCOUNTS_DSCAR,
        )
        from apps.accounting.models import ChartOfAccount

        created_count = 0
        updated_count = 0
        skipped_count = 0

        # Ordena por nível para garantir que raízes sejam criadas antes dos filhos
        sorted_accounts = sorted(CHART_OF_ACCOUNTS_DSCAR, key=lambda x: x["level"])

        for _account_data in sorted_accounts:
            account_data = dict(_account_data)
            parent_code = account_data.pop("parent_code", None)
            parent = None

            if parent_code:
                try:
                    parent = ChartOfAccount.objects.get(code=parent_code)
                except ChartOfAccount.DoesNotExist:
                    self.stdout.write(
                        self.style.WARNING(
                            f"  [AVISO] Conta pai '{parent_code}' não encontrada "
                            f"para '{account_data['code']}' — pulando."
                        )
                    )
                    skipped_count += 1
                    continue

            if reset:
                obj, created = ChartOfAccount.objects.update_or_create(
                    code=account_data["code"],
                    defaults={**account_data, "parent": parent},
                )
                if created:
                    created_count += 1
                else:
                    updated_count += 1
            else:
                obj, created = ChartOfAccount.objects.get_or_create(
                    code=account_data["code"],
                    defaults={**account_data, "parent": parent},
                )
                if created:
                    created_count += 1
                else:
                    skipped_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"[{schema}] Plano de contas configurado!\n"
                f"  Criadas:     {created_count}\n"
                f"  Atualizadas: {updated_count}\n"
                f"  Ignoradas:   {skipped_count}\n"
                f"  Total:       {created_count + updated_count + skipped_count}"
            )
        )
        logger.info(
            "setup_chart_of_accounts concluído para schema=%s "
            "created=%d updated=%d skipped=%d",
            schema,
            created_count,
            updated_count,
            skipped_count,
        )
