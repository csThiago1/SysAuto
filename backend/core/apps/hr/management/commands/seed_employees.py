"""
Paddock Solutions — Seed Employee Test Data

Cria 3 colaboradores por setor produtivo (18 total).
Idempotente: usa get_or_create no username.
"""
import hashlib
import logging
from datetime import date
from typing import Any

from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)

EMPLOYEES = [
    # (username, name, department, position, role)
    ("carlos.funileiro", "Carlos Silva", "bodywork", "bodyworker", "STOREKEEPER"),
    ("roberto.funileiro", "Roberto Santos", "bodywork", "bodyworker", "STOREKEEPER"),
    ("andre.funileiro", "Andre Oliveira", "bodywork", "bodyworker", "STOREKEEPER"),
    ("marcos.pintor", "Marcos Lima", "painting", "painter", "STOREKEEPER"),
    ("paulo.pintor", "Paulo Costa", "painting", "painter", "STOREKEEPER"),
    ("lucas.pintor", "Lucas Souza", "painting", "painter", "STOREKEEPER"),
    ("jose.mecanico", "Jose Pereira", "mechanical", "mechanic", "STOREKEEPER"),
    ("rafael.mecanico", "Rafael Almeida", "mechanical", "mechanic", "STOREKEEPER"),
    ("fernando.mecanico", "Fernando Rocha", "mechanical", "mechanic", "STOREKEEPER"),
    ("diego.polidor", "Diego Nascimento", "polishing", "polisher", "STOREKEEPER"),
    ("bruno.polidor", "Bruno Ferreira", "polishing", "polisher", "STOREKEEPER"),
    ("leandro.polidor", "Leandro Carvalho", "polishing", "polisher", "STOREKEEPER"),
    ("mateus.lavador", "Mateus Ribeiro", "washing", "washer", "STOREKEEPER"),
    ("gustavo.lavador", "Gustavo Martins", "washing", "washer", "STOREKEEPER"),
    ("felipe.lavador", "Felipe Gomes", "washing", "washer", "STOREKEEPER"),
    ("marina.consultora", "Marina Campos", "reception", "consultant", "CONSULTANT"),
    ("juliana.consultora", "Juliana Dias", "reception", "consultant", "CONSULTANT"),
    ("amanda.consultora", "Amanda Moreira", "reception", "consultant", "CONSULTANT"),
]


class Command(BaseCommand):
    help = "Seed 18 test employees (3 per production sector)"

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--schema",
            default="tenant_dscar",
            help="Tenant schema name (default: tenant_dscar)",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        from django_tenants.utils import schema_context

        schema: str = options["schema"]
        self.stdout.write(f"Seeding employees in schema '{schema}'...")

        with schema_context(schema):
            self._seed_employees()

        self.stdout.write(self.style.SUCCESS("Done!"))

    def _seed_employees(self) -> None:
        from apps.authentication.models import GlobalUser
        from apps.hr.models import Employee

        created_count = 0
        for username, name, department, position, role in EMPLOYEES:
            email = f"{username}@dscar.paddock.solutions"
            email_hash = hashlib.sha256(email.encode()).hexdigest()

            user, user_created = GlobalUser.objects.get_or_create(
                email_hash=email_hash,
                defaults={
                    "email": email,
                    "name": name,
                    "username": username,
                    "is_active": True,
                },
            )
            if user_created:
                user.set_password("paddock123")
                user.save(update_fields=["password"])

            _, emp_created = Employee.objects.get_or_create(
                user=user,
                defaults={
                    "department": department,
                    "position": position,
                    "role": role,
                    "status": "active",
                    "contract_type": "clt",
                    "hire_date": date(2025, 1, 1),
                    "registration_number": username.replace(".", ""),
                },
            )

            if user_created or emp_created:
                created_count += 1
                self.stdout.write(f"  + {name} ({department}/{position})")
            else:
                self.stdout.write(f"  = {name} (already exists)")

        self.stdout.write(f"  Total: {created_count} new employees created")
