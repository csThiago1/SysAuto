"""
Testes T4: FocusNFeClient httpx + FocusResponse.
Todos os testes usam @respx.mock — zero chamadas HTTP reais.
"""

import pytest
import respx
from httpx import Response

from apps.fiscal.clients.focus_nfe_client import FocusNFeClient, FocusResponse


@pytest.fixture
def client():
    """FocusNFeClient configurado com token e base_url de teste."""
    return FocusNFeClient(
        token="test-token",
        base_url="https://homologacao.focusnfe.com.br",
        timeout=10,
    )


@respx.mock
def test_emit_nfse_returns_focus_response(client):
    """emit_nfse deve retornar FocusResponse com status_code e data."""
    respx.post(url__regex=r".*/v2/nfse\?ref=.*").mock(
        return_value=Response(201, json={"status": "processando_autorizacao"})
    )
    resp = client.emit_nfse("12345678-NFSE-20260423-000001", {"servico": {}})

    assert isinstance(resp, FocusResponse)
    assert resp.status_code == 201
    assert resp.data == {"status": "processando_autorizacao"}
    assert resp.duration_ms >= 0


@respx.mock
def test_client_does_not_raise_on_422(client):
    """FocusNFeClient NÃO deve levantar exception em 422 — retorna FocusResponse."""
    respx.post(url__regex=r".*/v2/nfse\?ref=.*").mock(
        return_value=Response(422, json={"codigo": "requisicao_invalida", "mensagem": "Erro"})
    )
    resp = client.emit_nfse("ref-invalida", {})

    assert resp.status_code == 422
    assert resp.data is not None
    assert resp.data["codigo"] == "requisicao_invalida"


@respx.mock
def test_client_does_not_raise_on_500(client):
    """FocusNFeClient NÃO deve levantar exception em 500 — retorna FocusResponse."""
    respx.get(url__regex=r".*/v2/nfe/.*").mock(
        return_value=Response(500, text="Internal Server Error")
    )
    resp = client.consult_nfe("ref-teste")

    assert resp.status_code == 500
    assert resp.data is None
    assert "Internal Server Error" in resp.raw_text


@respx.mock
def test_consult_nfse_uses_get(client):
    """consult_nfse deve usar GET /v2/nfse/{ref}."""
    route = respx.get("https://homologacao.focusnfe.com.br/v2/nfse/ref-teste").mock(
        return_value=Response(200, json={"status": "autorizado"})
    )
    resp = client.consult_nfse("ref-teste")

    assert resp.status_code == 200
    assert route.called


@respx.mock
def test_cancel_nfe_uses_delete(client):
    """cancel_nfe deve usar DELETE /v2/nfe/{ref}."""
    route = respx.delete("https://homologacao.focusnfe.com.br/v2/nfe/ref-teste").mock(
        return_value=Response(200, json={"status": "cancelado"})
    )
    resp = client.cancel_nfe("ref-teste", "Cancelamento por erro de digitação")

    assert resp.status_code == 200
    assert route.called


@respx.mock
def test_non_json_body_sets_raw_text_and_data_none(client):
    """Resposta com corpo não-JSON deve ter data=None e raw_text preenchido."""
    respx.post(url__regex=r".*/v2/nfse\?ref=.*").mock(
        return_value=Response(201, content=b"<html>Erro</html>")
    )
    resp = client.emit_nfse("ref-teste", {})

    assert resp.data is None
    assert "<html>" in resp.raw_text


@respx.mock
def test_context_manager_closes_client(client):
    """Context manager deve funcionar sem erros."""
    respx.get("https://homologacao.focusnfe.com.br/v2/nfce/ref-teste").mock(
        return_value=Response(200, json={"status": "autorizado"})
    )
    with FocusNFeClient(
        token="test-token",
        base_url="https://homologacao.focusnfe.com.br",
        timeout=10,
    ) as c:
        resp = c.consult_nfce("ref-teste")

    assert resp.status_code == 200
