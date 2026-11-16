"""Cria perfil de funcionário para toda conta ativa que ainda não tem um no tenant.

Toda conta do ERP é também funcionário (o papel continua sendo ajustado no painel).
Idempotente. Uso: manage.py ensure_employee_profiles [--schema tenant_dscar]
"""
from typing import Any

from django.core.management.base import BaseCommand, CommandParser
from django.utils import timezone
from django_tenants.utils import schema_context

from apps.authentication.models import GlobalUser
from apps.hr.models import Employee
from apps.hr.services import next_registration_number


class Command(BaseCommand):
    help = "Cria Employee para GlobalUsers ativos sem perfil no tenant."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--schema", default="tenant_dscar")

    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        with schema_context(options["schema"]):
            with_profile = Employee.objects.values_list("user_id", flat=True)
            for user in GlobalUser.objects.filter(is_active=True).exclude(pk__in=with_profile):
                Employee.objects.create(
                    user=user,
                    role=user.role or "CONSULTANT",
                    department="administrative",
                    position="administrative",
                    hire_date=timezone.localdate(),
                    registration_number=next_registration_number(),
                )
                created += 1
        self.stdout.write(f"{created} perfis criados")
