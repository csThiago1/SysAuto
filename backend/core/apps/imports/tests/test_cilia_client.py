"""Testes do CiliaClient com respx (stub httpx).

Cobertura:
- Inicialização e validação de configuração
- get_budget: sucesso, 404, 401, params de auth/versão, duration_ms
- list_budgets: params padrão e com date_range
- Erros de rede
"""
import json
from pathlib import Path

import pytest
import respx
from httpx import Response

from apps.imports.sources.cilia_client import (
    CiliaClient,
    CiliaError,
    CiliaResponse,
)


FIXTURES_DIR = Path(__file__).parent / "fixtures"

# Endpoint paths usados nos mocks
_BUDGET_URL = "https://test.cilia.local/api/integration/insurer_budgets/by_casualty_number_and_budget_number"
_LIST_URL = "https://test.cilia.local/api/integration/budgets/list_budgets"


def _load_fixture(name: str) -> dict:
    """Carrega fixture JSON do diretório de fixtures."""
    with open(FIXTURES_DIR / name) as f:
        return json.load(f)


@pytest.fixture
def client(settings) -> CiliaClient:
    """CiliaClient configurado com token e base_url de teste."""
    settings.CILIA_AUTH_TOKEN = "test-token-123"
    settings.CILIA_BASE_URL = "https://test.cilia.local"
    return CiliaClient()


class TestCiliaClientInit:
    """Testes de inicialização e validação de configuração."""

    def test_raises_if_no_token(self, settings) -> None:
        """Deve levantar CiliaError se CILIA_AUTH_TOKEN estiver vazio."""
        settings.CILIA_AUTH_TOKEN = ""
        with pytest.raises(CiliaError, match="CILIA_AUTH_TOKEN"):
            CiliaClient()

    def test_uses_settings_defaults(self, settings) -> None:
        """Deve usar CILIA_AUTH_TOKEN e CILIA_BASE_URL do settings por padrão."""
        settings.CILIA_AUTH_TOKEN = "abc"
        settings.CILIA_BASE_URL = "https://x.cilia.local"
        c = CiliaClient()
        assert c.auth_token == "abc"
        assert c.base_url == "https://x.cilia.local"

    def test_constructor_overrides(self, settings) -> None:
        """Parâmetros do construtor sobrescrevem settings."""
        settings.CILIA_AUTH_TOKEN = "from-settings"
        c = CiliaClient(auth_token="override", base_url="https://override.local")
        assert c.auth_token == "override"
        assert c.base_url == "https://override.local"


class TestGetBudget:
    """Testes do método get_budget."""

    @respx.mock
    def test_success_v2(self, client: CiliaClient) -> None:
        """Deve retornar CiliaResponse com dados corretos da fixture v2."""
        payload = _load_fixture("cilia_1446508_v2.json")
        respx.get(_BUDGET_URL).mock(return_value=Response(200, json=payload))

        resp = client.get_budget(
            casualty_number="406571903",
            budget_number=1446508,
            version_number=2,
        )

        assert isinstance(resp, CiliaResponse)
        assert resp.status_code == 200
        assert resp.data["budget_version_id"] == 30629056
        assert resp.data["version_number"] == 2
        assert resp.data["conclusion"]["key"] == "authorized"

    @respx.mock
    def test_404_version_not_found(self, client: CiliaClient) -> None:
        """Deve retornar CiliaResponse com status 404 sem levantar exceção."""
        error_payload = _load_fixture("cilia_404.json")
        respx.get(_BUDGET_URL).mock(return_value=Response(404, json=error_payload))

        resp = client.get_budget(
            casualty_number="406571903",
            budget_number=1446508,
            version_number=99,
        )

        assert resp.status_code == 404
        assert "encontrada" in resp.data["error"]

    @respx.mock
    def test_401_unauthorized(self, client: CiliaClient) -> None:
        """Deve retornar CiliaResponse com status 401 sem levantar exceção."""
        respx.get(_BUDGET_URL).mock(
            return_value=Response(401, json={"error": "token inválido"})
        )

        resp = client.get_budget(casualty_number="X", budget_number=1)

        assert resp.status_code == 401

    @respx.mock
    def test_passes_auth_token_in_query(self, client: CiliaClient) -> None:
        """Deve injetar auth_token como query parameter."""
        route = respx.get(_BUDGET_URL).mock(return_value=Response(200, json={}))

        client.get_budget(casualty_number="X", budget_number=1)

        request = route.calls[0].request
        assert "auth_token=test-token-123" in str(request.url)

    @respx.mock
    def test_omits_version_when_none(self, client: CiliaClient) -> None:
        """Deve omitir version_number da query quando não informado."""
        route = respx.get(_BUDGET_URL).mock(return_value=Response(200, json={}))

        client.get_budget(casualty_number="X", budget_number=1)  # version_number=None

        request = route.calls[0].request
        assert "version_number" not in str(request.url)

    @respx.mock
    def test_includes_version_when_set(self, client: CiliaClient) -> None:
        """Deve incluir version_number na query quando informado."""
        route = respx.get(_BUDGET_URL).mock(return_value=Response(200, json={}))

        client.get_budget(casualty_number="X", budget_number=1, version_number=3)

        request = route.calls[0].request
        assert "version_number=3" in str(request.url)

    @respx.mock
    def test_measures_duration_ms(self, client: CiliaClient) -> None:
        """duration_ms deve ser >= 0 (pode ser 0 em testes muito rápidos)."""
        respx.get(_BUDGET_URL).mock(return_value=Response(200, json={}))

        resp = client.get_budget(casualty_number="X", budget_number=1)

        assert resp.duration_ms >= 0


class TestListBudgets:
    """Testes do método list_budgets."""

    @respx.mock
    def test_default_params(self, client: CiliaClient) -> None:
        """Deve incluir budget_type, page e per_page com valores padrão."""
        route = respx.get(_LIST_URL).mock(
            return_value=Response(200, json={"results": []})
        )

        client.list_budgets()

        url_str = str(route.calls[0].request.url)
        assert "budget_type=InsurerBudget" in url_str
        assert "page=1" in url_str
        assert "per_page=25" in url_str

    @respx.mock
    def test_date_range_params(self, client: CiliaClient) -> None:
        """Deve incluir date_range[start_date] e date_range[end_date] urlencoded."""
        route = respx.get(_LIST_URL).mock(
            return_value=Response(200, json={"results": []})
        )

        client.list_budgets(
            date_type="finalized",
            start_date="2026-04-01",
            end_date="2026-04-21",
        )

        url_str = str(route.calls[0].request.url)
        # httpx urlencode os colchetes: date_range%5Bstart_date%5D=...
        assert "date_range" in url_str
        assert "2026-04-01" in url_str
        assert "2026-04-21" in url_str


class TestNetworkErrors:
    """Testes de erros de rede (não-HTTP)."""

    @respx.mock
    def test_network_error_raises(self, client: CiliaClient) -> None:
        """Deve levantar CiliaError com prefixo 'Network error' em falha de conexão."""
        import httpx

        respx.get(_BUDGET_URL).mock(side_effect=httpx.ConnectError("connection failed"))

        with pytest.raises(CiliaError, match="Network error"):
            client.get_budget(casualty_number="X", budget_number=1)
