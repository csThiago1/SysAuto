"""
Script de setup inicial para Railway/staging.
Cria o tenant público, o tenant dscar e um usuário admin.
Idempotente — pode rodar múltiplas vezes sem problemas.
"""
import os
import sys
import hashlib

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.railway")
django.setup()

from apps.tenants.models import Company, Domain  # noqa: E402
from django_tenants.utils import schema_context  # noqa: E402


def setup():
    # 1. Public tenant
    if not Company.objects.filter(schema_name="public").exists():
        public = Company(schema_name="public", name="Public", slug="public")
        public.save()
        Domain.objects.create(domain="public.localhost", tenant=public, is_primary=True)
        print("[setup] Public tenant criado")
    else:
        print("[setup] Public tenant já existe")

    # 2. Tenant dscar
    if not Company.objects.filter(schema_name="tenant_dscar").exists():
        dscar = Company(schema_name="tenant_dscar", name="DS Car Centro Automotivo", slug="dscar")
        dscar.save()
        Domain.objects.create(domain="dscar.localhost", tenant=dscar, is_primary=True)
        print("[setup] Tenant dscar criado")
    else:
        print("[setup] Tenant dscar já existe")

    # 3. Usuário admin (no schema público)
    from apps.authentication.models import GlobalUser

    email = "admin@paddock.solutions"
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()

    if not GlobalUser.objects.filter(email_hash=email_hash).exists():
        user = GlobalUser(
            email=email,
            email_hash=email_hash,
            name="Admin Paddock",
            is_active=True,
            role="ADMIN",
        )
        user.set_password("paddock123")
        user.save()
        print(f"[setup] Usuário {email} criado (senha: paddock123)")
    else:
        print(f"[setup] Usuário {email} já existe")

    print("[setup] Concluído!")


if __name__ == "__main__":
    setup()
