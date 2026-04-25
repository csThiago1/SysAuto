"""
Testes T7: FiscalService skeleton + _raise_for_http().
"""

import pytest

from apps.fiscal.clients.focus_nfe_client import FocusResponse
from apps.fiscal.exceptions import (
    FocusAuthError,
    FocusConflict,
    FocusNotFoundError,
    FocusRateLimitError,
    FocusServerError,
    FocusValidationError,
)
from apps.fiscal.services.fiscal_service import FiscalService


def make_response(status_code: int, data: dict | None = None) -> FocusResponse:
    """Helper para criar FocusResponse de teste."""
    return FocusResponse(
        status_code=status_code,
        data=data or {"error": "test"},
        duration_ms=10,
        raw_text="",
        headers={},
    )


# ─── _raise_for_http ──────────────────────────────────────────────────────────


def test_raise_for_http_200_does_not_raise():
    """2xx não deve levantar exceção."""
    for code in (200, 201, 202, 204):
        FiscalService._raise_for_http(make_response(code))  # não deve levantar


def test_raise_for_http_401_raises_auth_error():
    """401 deve levantar FocusAuthError."""
    with pytest.raises(FocusAuthError):
        FiscalService._raise_for_http(make_response(401))


def test_raise_for_http_403_raises_auth_error():
    """403 deve levantar FocusAuthError."""
    with pytest.raises(FocusAuthError):
        FiscalService._raise_for_http(make_response(403))


def test_raise_for_http_404_raises_not_found():
    """404 deve levantar FocusNotFoundError."""
    with pytest.raises(FocusNotFoundError):
        FiscalService._raise_for_http(make_response(404))


def test_raise_for_http_409_raises_conflict():
    """409 deve levantar FocusConflict."""
    with pytest.raises(FocusConflict):
        FiscalService._raise_for_http(make_response(409))


def test_raise_for_http_429_raises_rate_limit():
    """429 deve levantar FocusRateLimitError."""
    with pytest.raises(FocusRateLimitError):
        FiscalService._raise_for_http(make_response(429))


def test_raise_for_http_422_raises_validation_error():
    """422 deve levantar FocusValidationError (não retry)."""
    with pytest.raises(FocusValidationError):
        FiscalService._raise_for_http(make_response(422))


def test_raise_for_http_400_raises_validation_error():
    """400 deve levantar FocusValidationError."""
    with pytest.raises(FocusValidationError):
        FiscalService._raise_for_http(make_response(400))


def test_raise_for_http_500_raises_server_error():
    """500 deve levantar FocusServerError (retry)."""
    with pytest.raises(FocusServerError):
        FiscalService._raise_for_http(make_response(500))


def test_raise_for_http_503_raises_server_error():
    """503 deve levantar FocusServerError."""
    with pytest.raises(FocusServerError):
        FiscalService._raise_for_http(make_response(503))


# ─── Métodos stub ─────────────────────────────────────────────────────────────


def test_emit_nfse_raises_not_implemented():
    """emit_nfse deve levantar NotImplementedError (skeleton)."""
    with pytest.raises(NotImplementedError):
        FiscalService.emit_nfse(None, None, None)


def test_cancel_raises_not_implemented():
    """cancel deve levantar NotImplementedError (skeleton)."""
    with pytest.raises(NotImplementedError):
        FiscalService.cancel(None, "justificativa")


@pytest.mark.django_db
def test_get_config_raises_does_not_exist_when_no_config(db):
    """get_config deve levantar DoesNotExist se não houver FiscalConfigModel ativo."""
    from apps.fiscal.models import FiscalConfigModel

    with pytest.raises(FiscalConfigModel.DoesNotExist):
        FiscalService.get_config()


@pytest.mark.django_db
def test_get_config_returns_active_config(fiscal_config):
    """get_config deve retornar o FiscalConfigModel ativo."""
    config = FiscalService.get_config()
    assert config.pk == fiscal_config.pk
    assert config.cnpj == "12345678000195"
