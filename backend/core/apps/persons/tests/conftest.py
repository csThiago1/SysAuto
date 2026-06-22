"""
Paddock Solutions — Persons — conftest.py

Fixtures compartilhadas entre todos os testes do app persons.
Testes que acessam modelos tenant usam a fixture `tenant` para criar o schema.
"""

import pytest
from django.db import connection


@pytest.fixture
def tenant(transactional_db):
    """Cria tenant de teste com schema isolado para apps TENANT_APPS.

    Usa transactional_db porque django-tenants precisa de transações reais
    para CREATE SCHEMA.
    """
    from apps.tenants.models import Company, Domain

    tenant = Company(schema_name="tenant_dscar", name="DS Car Test Tenant")
    tenant.save()
    Domain.objects.create(domain="dscar-test.localhost", tenant=tenant, is_primary=True)
    connection.set_tenant(tenant)
    yield tenant
    connection.set_schema_to_public()
