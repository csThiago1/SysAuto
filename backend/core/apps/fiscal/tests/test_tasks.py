"""
Testes T8: Celery task poll_fiscal_document.
"""

import uuid

import pytest
import respx
from httpx import Response


@pytest.fixture
def fiscal_doc_processing(fiscal_document):
    """FiscalDocument em status PROCESSING (aguardando polling)."""
    fiscal_document.status = "pending"
    fiscal_document.save(update_fields=["status"])
    return fiscal_document


@respx.mock
def test_poll_skips_terminal_states(fiscal_document):
    """poll_fiscal_document deve retornar skip se status já é terminal."""
    from apps.fiscal.tasks import poll_fiscal_document

    fiscal_document.status = "authorized"
    fiscal_document.save(update_fields=["status"])

    result = poll_fiscal_document(str(fiscal_document.pk), attempt=1)

    assert result["skipped"] is True
    assert result["status"] == "authorized"


@respx.mock
def test_poll_returns_error_for_unknown_document():
    """poll_fiscal_document deve retornar erro para documento inexistente."""
    from apps.fiscal.tasks import poll_fiscal_document

    fake_id = str(uuid.uuid4())
    result = poll_fiscal_document(fake_id, attempt=1)

    assert result["error"] == "not_found"


@respx.mock
def test_poll_creates_fiscal_event(fiscal_doc_processing):
    """poll_fiscal_document deve criar FiscalEvent(event_type='CONSULT')."""
    from apps.fiscal.models import FiscalEvent
    from apps.fiscal.tasks import poll_fiscal_document

    # Mock da consulta NFS-e (document_type="nfse")
    respx.get(url__regex=r".*/v2/nfse/.*").mock(
        return_value=Response(200, json={"status": "processando_autorizacao"})
    )

    poll_fiscal_document(str(fiscal_doc_processing.pk), attempt=1)

    events = FiscalEvent.objects.filter(
        document=fiscal_doc_processing,
        event_type="CONSULT",
    )
    assert events.exists()


@respx.mock
def test_poll_updates_status_to_authorized(fiscal_doc_processing):
    """poll_fiscal_document deve atualizar status para AUTHORIZED."""
    from apps.fiscal.tasks import poll_fiscal_document

    respx.get(url__regex=r".*/v2/nfse/.*").mock(
        return_value=Response(
            200,
            json={
                "status": "autorizado",
                "numero": "42",
                "codigo_verificacao": "ABCD1234",
            },
        )
    )

    result = poll_fiscal_document(str(fiscal_doc_processing.pk), attempt=1)

    fiscal_doc_processing.refresh_from_db()
    assert fiscal_doc_processing.status == "AUTHORIZED"


@respx.mock
def test_poll_all_terminal_states_map():
    """_map_focus_status deve mapear todos os status da Focus."""
    from apps.fiscal.tasks import _map_focus_status

    assert _map_focus_status("processando_autorizacao") == "PROCESSING"
    assert _map_focus_status("autorizado") == "AUTHORIZED"
    assert _map_focus_status("denegado") == "DENIED"
    assert _map_focus_status("erro_autorizacao") == "ERROR"
    assert _map_focus_status("cancelado") == "CANCELLED"
    assert _map_focus_status("status_desconhecido") is None


@respx.mock
def test_poll_returns_document_id_and_status(fiscal_doc_processing):
    """poll_fiscal_document deve retornar dict com document_id e status."""
    from apps.fiscal.tasks import poll_fiscal_document

    respx.get(url__regex=r".*/v2/nfse/.*").mock(
        return_value=Response(200, json={"status": "processando_autorizacao"})
    )

    result = poll_fiscal_document(str(fiscal_doc_processing.pk), attempt=1)

    assert "document_id" in result
    assert "status" in result
    assert "attempt" in result
    assert result["attempt"] == 1
