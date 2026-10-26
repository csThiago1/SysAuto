"""O Sentry não pode receber URLs do httpx (placa, CNPJ, CEP e token da API Placas)."""

from __future__ import annotations

from unittest.mock import patch

import pytest

sentry_sdk = pytest.importorskip("sentry_sdk")  # só está em requirements/prod.txt

from sentry_sdk.integrations.httpx import HttpxIntegration  # noqa: E402

from config.sentry import init_sentry  # noqa: E402


def test_init_sentry_desliga_httpx_e_nao_envia_pii() -> None:
    with patch("sentry_sdk.init") as init:
        init_sentry("https://x@o0.ingest.sentry.io/1")

    kwargs = init.call_args.kwargs
    assert any(isinstance(i, HttpxIntegration) for i in kwargs["disabled_integrations"])
    assert kwargs["send_default_pii"] is False
