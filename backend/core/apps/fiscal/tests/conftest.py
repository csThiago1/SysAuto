"""
Paddock Solutions — Fiscal — conftest.py
Ciclo 06B: Fiscal Foundation

Fixtures compartilhadas entre todos os testes do app fiscal.
Testes que acessam modelos tenant usam a fixture `tenant` para criar o schema.
"""

import uuid

import pytest
from django.db import connection




@pytest.fixture
def tenant(transactional_db):
    """Cria tenant de teste com schema isolado para apps TENANT_APPS.

    Usa transactional_db (não db) porque django-tenants precisa de
    transações reais para CREATE SCHEMA.
    """
    from apps.tenants.models import Company, Domain

    tenant = Company(schema_name="test_fiscal", name="Fiscal Test Tenant")
    tenant.save()
    Domain.objects.create(domain="fiscal-test.localhost", tenant=tenant, is_primary=True)
    connection.set_tenant(tenant)
    yield tenant
    connection.set_schema_to_public()


@pytest.fixture
def fiscal_config(tenant):
    """FiscalConfigModel configurado para testes (homologacao)."""
    from apps.fiscal.models import FiscalConfigModel

    return FiscalConfigModel.objects.create(
        cnpj="12345678000195",
        razao_social="DS Car Homologação Ltda",
        nome_fantasia="DS Car Teste",
        inscricao_municipal="123456",
        regime_tributario=1,
        environment="homologacao",
        focus_token="test-token-homologacao",
        serie_rps="1",
        seq_nfse=1,
        seq_nfe=1,
        seq_nfce=1,
        endereco={
            "logradouro": "Av. Djalma Batista",
            "numero": "1661",
            "bairro": "Chapada",
            "cidade": "Manaus",
            "uf": "AM",
            "cep": "69050010",
            "codigo_ibge_municipio": "1302603",
        },
        is_active=True,
    )


@pytest.fixture
def fiscal_document(fiscal_config):
    """FiscalDocument (stub) para testes."""
    from apps.fiscal.models import FiscalDocument

    return FiscalDocument.objects.create(
        document_type="nfse",
        status="pending",
        reference_id=uuid.uuid4(),
        reference_type="service_order",
        key="",
        number="",
        series="1",
        total_value="150.00",
        environment="homologation",
    )


@pytest.fixture
def fiscal_event(fiscal_document):
    """FiscalEvent para testes."""
    from apps.fiscal.models import FiscalEvent

    return FiscalEvent.objects.create(
        document=fiscal_document,
        event_type="EMIT_REQUEST",
        http_status=201,
        payload={"status": "processando_autorizacao"},
        response={},
        duration_ms=120,
        triggered_by="USER",
    )
