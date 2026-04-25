"""Cliente HTTP para a API de Integração da Cilia.

Documentação: /intergracao_api_cilia/docs/API-COMPLETA-CILIA.md
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any

import httpx
from django.conf import settings


logger = logging.getLogger(__name__)


class CiliaError(Exception):
    """Erro genérico da integração Cilia."""


class CiliaAuthError(CiliaError):
    """Token inválido ou ausente (HTTP 401)."""


class CiliaNotFoundError(CiliaError):
    """Orçamento/versão não encontrado (HTTP 404)."""


class CiliaForbiddenError(CiliaError):
    """Sem permissão ou orçamento de outra oficina (HTTP 403)."""


@dataclass
class CiliaResponse:
    """Resposta bruta com metadados de timing."""

    status_code: int
    data: dict[str, Any] | None
    duration_ms: int
    raw_text: str


class CiliaClient:
    """Cliente HTTP da API de Integração Cilia.

    Uso:
        client = CiliaClient()
        resp = client.get_budget(casualty_number="406571903", budget_number=1446508, version_number=2)
        if resp.status_code == 200:
            data = resp.data  # dict completo
    """

    def __init__(
        self,
        *,
        base_url: str | None = None,
        auth_token: str | None = None,
        timeout: float | None = None,
    ) -> None:
        self.base_url = (
            base_url or getattr(settings, "CILIA_BASE_URL", "https://sistema.cilia.com.br")
        ).rstrip("/")
        self.auth_token = auth_token or getattr(settings, "CILIA_AUTH_TOKEN", "")
        self.timeout = timeout or getattr(settings, "CILIA_TIMEOUT_SECONDS", 30.0)

        if not self.auth_token:
            logger.warning(
                "CILIA_AUTH_TOKEN não configurado. Defina em .env ou no construtor.",
            )

    def _request(self, path: str, params: dict[str, Any]) -> CiliaResponse:
        """Faz GET autenticado. Retorna CiliaResponse mesmo em erros HTTP."""
        all_params = {"auth_token": self.auth_token, **params}
        url = f"{self.base_url}{path}"

        start = time.monotonic()
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.get(
                    url,
                    params=all_params,
                    headers={
                        "accept": "application/json",
                        "User-Agent": "DSCAR-Paddock/1.0",
                    },
                )
        except httpx.RequestError as exc:
            duration_ms = int((time.monotonic() - start) * 1000)
            logger.error("Cilia request failed: %s (duration=%dms)", exc, duration_ms)
            raise CiliaError(f"Network error: {exc}") from exc

        duration_ms = int((time.monotonic() - start) * 1000)
        raw_text = response.text

        try:
            data: dict[str, Any] | None = response.json()
        except ValueError:
            data = None

        logger.debug(
            "Cilia GET %s → %d (%dms)",
            path,
            response.status_code,
            duration_ms,
        )

        return CiliaResponse(
            status_code=response.status_code,
            data=data,
            duration_ms=duration_ms,
            raw_text=raw_text,
        )

    def get_budget(
        self,
        *,
        casualty_number: str,
        budget_number: int | str,
        version_number: int | None = None,
    ) -> CiliaResponse:
        """Busca orçamento por sinistro + número + versão opcional.

        GET /api/integration/insurer_budgets/by_casualty_number_and_budget_number
        """
        params: dict[str, Any] = {
            "casualty_number": casualty_number,
            "budget_number": budget_number,
        }
        if version_number is not None:
            params["version_number"] = version_number

        return self._request(
            "/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
            params,
        )

    def list_budgets(
        self,
        *,
        budget_type: str = "InsurerBudget",
        status_ids: str | None = None,
        date_type: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        page: int = 1,
        per_page: int = 25,
    ) -> CiliaResponse:
        """Lista orçamentos da oficina.

        GET /api/integration/budgets/list_budgets
        """
        params: dict[str, Any] = {
            "budget_type": budget_type,
            "page": page,
            "per_page": per_page,
        }
        if status_ids:
            params["status_ids"] = status_ids
        if date_type:
            params["date_type"] = date_type
        if start_date:
            params["date_range[start_date]"] = start_date
        if end_date:
            params["date_range[end_date]"] = end_date

        return self._request("/api/integration/budgets/list_budgets", params)


# ---- Compatibilidade retroativa com o código existente ----

def buscar_orcamento(
    casualty_number: str,
    budget_number: str,
    version_number: int | str | None = None,
) -> dict[str, Any]:
    """Função legada — usa CiliaClient internamente.

    Raises:
        httpx.HTTPStatusError: se status >= 400 (mantém comportamento anterior).
        httpx.RequestError: em erros de rede.
    """
    client = CiliaClient()
    resp = client.get_budget(
        casualty_number=casualty_number,
        budget_number=budget_number,
        version_number=int(version_number) if version_number else None,
    )
    if resp.status_code >= 400:
        mock_request = httpx.Request("GET", "https://placeholder")
        mock_response = httpx.Response(resp.status_code, request=mock_request)
        raise httpx.HTTPStatusError(
            f"HTTP {resp.status_code}",
            request=mock_request,
            response=mock_response,
        )
    return resp.data or {}
