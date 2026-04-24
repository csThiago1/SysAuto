"""
Testes T5: Models FiscalConfigModel, FiscalDocumentItem, FiscalEvent.
"""

import uuid

import pytest


@pytest.mark.django_db
def test_fiscal_config_model_create(fiscal_config):
    """FiscalConfigModel deve ser criado com campos corretos."""
    from apps.fiscal.models import FiscalConfigModel

    assert fiscal_config.pk is not None
    assert fiscal_config.cnpj == "12345678000195"
    assert fiscal_config.environment == "homologacao"
    assert fiscal_config.seq_nfse == 1
    assert fiscal_config.seq_nfe == 1
    assert fiscal_config.is_active is True


@pytest.mark.django_db
def test_fiscal_config_model_str(fiscal_config):
    """__str__ deve incluir razão social e CNPJ."""
    s = str(fiscal_config)
    assert "DS Car" in s
    assert "12345678000195" in s


@pytest.mark.django_db
def test_fiscal_document_item_create(fiscal_document):
    """FiscalDocumentItem deve ser criado com FK para FiscalDocument."""
    from apps.fiscal.models import FiscalDocumentItem

    item = FiscalDocumentItem.objects.create(
        document=fiscal_document,
        numero_item=1,
        descricao="Serviço de funilaria",
        ncm="98019000",
        cfop="5933",
        unidade="SV",
        quantidade=1,
        valor_unitario="250.00",
        valor_total="250.00",
    )
    assert item.pk is not None
    assert item.document == fiscal_document
    assert item.descricao == "Serviço de funilaria"


@pytest.mark.django_db
def test_fiscal_event_create(fiscal_document):
    """FiscalEvent deve ser criado com FK para FiscalDocument."""
    from apps.fiscal.models import FiscalEvent

    event = FiscalEvent.objects.create(
        document=fiscal_document,
        event_type="EMIT_REQUEST",
        http_status=201,
        payload={"status": "processando_autorizacao"},
        duration_ms=150,
        triggered_by="USER",
    )
    assert event.pk is not None
    assert event.document == fiscal_document
    assert event.event_type == "EMIT_REQUEST"
    assert event.http_status == 201


@pytest.mark.django_db
def test_fiscal_event_orphan_allowed(db):
    """FiscalEvent com document=None deve ser permitido (webhook orphan)."""
    from apps.fiscal.models import FiscalEvent

    event = FiscalEvent.objects.create(
        document=None,
        event_type="WEBHOOK",
        payload={"ref": "unknown-ref", "evento": "autorizado"},
        triggered_by="WEBHOOK",
    )
    assert event.pk is not None
    assert event.document is None


@pytest.mark.django_db
def test_fiscal_config_unique_cnpj(fiscal_config):
    """Dois FiscalConfigModel com o mesmo CNPJ devem violar unique constraint."""
    from django.db import IntegrityError

    from apps.fiscal.models import FiscalConfigModel

    with pytest.raises(IntegrityError):
        FiscalConfigModel.objects.create(
            cnpj="12345678000195",  # mesmo CNPJ
            razao_social="Outra empresa",
        )
