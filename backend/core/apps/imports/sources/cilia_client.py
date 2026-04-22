"""Cliente HTTP para a API de Integração da Cilia.

Porta do cilia-client.js (Node) preservando interface e adicionando type hints.
Documentação: docs/superpowers/specs/2026-04-20-modulo-orcamentacao-design.md +
/intergracao_api_cilia/docs/API-COMPLETA-CILIA.md
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
        self.base_url = (base_url or settings.CILIA_BASE_URL).rstrip("/")
        self.auth_token = auth_token or settings.CILIA_AUTH_TOKEN
        self.timeout = timeout or settings.CILIA_TIMEOUT_SECONDS

        if not self.auth_token:
            raise CiliaError(
                "CILIA_AUTH_TOKEN não configurado. Defina em .env ou no construtor.",
            )

    def _request(self, path: str, params: dict[str, Any]) -> CiliaResponse:
        """Faz request com auth_token. Retorna CiliaResponse mesmo em erros HTTP.

        Args:
            path: caminho do endpoint (ex: "/api/integration/...").
            params: query params adicionais (sem auth_token).

        Returns:
            CiliaResponse com status_code, data, duration_ms e raw_text.
            Retorna para qualquer status HTTP (200, 404, 401, etc.).

        Raises:
            CiliaError: apenas para erros de rede (não HTTP).
        """
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
            "Cilia %s %s → %d (%dms)",
            "GET",
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
        """Busca orçamento específico por sinistro + número de orçamento.

        GET /api/integration/insurer_budgets/by_casualty_number_and_budget_number

        Args:
            casualty_number: número do sinistro (string).
            budget_number: número do orçamento (int).
            version_number: versão específica; se None, Cilia retorna a versão atual.

        Returns:
            CiliaResponse com status_code e data.
            - 200: sucesso — data contém payload completo
            - 404: versão não existe — data = {"error": "..."}
            - 401/403: auth errors
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

        Args:
            budget_type: tipo de orçamento (default "InsurerBudget").
            status_ids: filtro de status (ex: "analyzed").
            date_type: tipo de data pra filtro (ex: "finalized").
            start_date: início do intervalo (YYYY-MM-DD).
            end_date: fim do intervalo (YYYY-MM-DD).
            page: página (default 1).
            per_page: itens por página (default 25).

        Returns:
            CiliaResponse com lista de orçamentos.
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
