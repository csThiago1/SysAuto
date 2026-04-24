"""
Paddock Solutions — Fiscal — FocusNFeClient
Ciclo 06B: Fiscal Foundation

Cliente httpx para Focus NF-e v2.
Espelha CiliaClient: NUNCA levanta exception em 4xx/5xx — retorna FocusResponse.
Quem decide o que fazer com o status_code é o FiscalService.

Autenticação: HTTP Basic (token, "")
Timeout: settings.FOCUS_NFE_TIMEOUT_SECONDS
"""

import logging
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from django.conf import settings

logger = logging.getLogger(__name__)


@dataclass
class FocusResponse:
    """Resposta normalizada de qualquer chamada à API Focus NF-e."""

    status_code: int
    data: dict[str, Any] | None
    duration_ms: int
    raw_text: str = ""
    headers: dict[str, str] = field(default_factory=dict)


class FocusNFeClient:
    """Cliente Focus NF-e v2 — espelha CiliaClient (não levanta em HTTP error).

    Uso:
        with FocusNFeClient() as client:
            resp = client.emit_nfse(ref, payload)
        if resp.status_code == 201:
            ...

    Ou instanciar diretamente (lembrar de chamar close()):
        client = FocusNFeClient()
        resp = client.consult_nfe(ref)
        client.close()
    """

    def __init__(
        self,
        token: str | None = None,
        base_url: str | None = None,
        timeout: int | None = None,
    ) -> None:
        self.token = token or settings.FOCUS_NFE_TOKEN
        self.base_url = base_url or settings.FOCUS_NFE_BASE_URL
        self.timeout = timeout or settings.FOCUS_NFE_TIMEOUT_SECONDS
        self._client = httpx.Client(
            base_url=self.base_url,
            auth=(self.token, ""),
            timeout=float(self.timeout),
            headers={"Content-Type": "application/json"},
        )

    # ─── NFS-e ────────────────────────────────────────────────────────────────

    def emit_nfse(self, ref: str, payload: dict[str, Any]) -> FocusResponse:
        """Emite NFS-e. POST /v2/nfse?ref={ref}"""
        return self._request("POST", f"/v2/nfse?ref={ref}", json=payload)

    def consult_nfse(self, ref: str) -> FocusResponse:
        """Consulta status de NFS-e. GET /v2/nfse/{ref}"""
        return self._request("GET", f"/v2/nfse/{ref}")

    def cancel_nfse(self, ref: str, justificativa: str) -> FocusResponse:
        """Cancela NFS-e. DELETE /v2/nfse/{ref}"""
        return self._request("DELETE", f"/v2/nfse/{ref}", json={"justificativa": justificativa})

    # ─── NF-e modelo 55 ───────────────────────────────────────────────────────

    def emit_nfe(self, ref: str, payload: dict[str, Any]) -> FocusResponse:
        """Emite NF-e mod 55. POST /v2/nfe?ref={ref}"""
        return self._request("POST", f"/v2/nfe?ref={ref}", json=payload)

    def consult_nfe(self, ref: str, completa: bool = False) -> FocusResponse:
        """Consulta status de NF-e. GET /v2/nfe/{ref}[?completa=1]"""
        path = f"/v2/nfe/{ref}" + ("?completa=1" if completa else "")
        return self._request("GET", path)

    def cancel_nfe(self, ref: str, justificativa: str) -> FocusResponse:
        """Cancela NF-e. DELETE /v2/nfe/{ref}"""
        return self._request("DELETE", f"/v2/nfe/{ref}", json={"justificativa": justificativa})

    # ─── NFC-e modelo 65 ──────────────────────────────────────────────────────

    def emit_nfce(self, ref: str, payload: dict[str, Any]) -> FocusResponse:
        """Emite NFC-e mod 65. POST /v2/nfce?ref={ref}"""
        return self._request("POST", f"/v2/nfce?ref={ref}", json=payload)

    def consult_nfce(self, ref: str) -> FocusResponse:
        """Consulta status de NFC-e. GET /v2/nfce/{ref}"""
        return self._request("GET", f"/v2/nfce/{ref}")

    def cancel_nfce(self, ref: str, justificativa: str) -> FocusResponse:
        """Cancela NFC-e. DELETE /v2/nfce/{ref}"""
        return self._request("DELETE", f"/v2/nfce/{ref}", json={"justificativa": justificativa})

    # ─── CCe / Inutilização ───────────────────────────────────────────────────

    def cce(self, ref: str, sequencia: int, texto: str) -> FocusResponse:
        """Carta de Correção Eletrônica. POST /v2/nfe/{ref}/carta_correcao"""
        return self._request(
            "POST",
            f"/v2/nfe/{ref}/carta_correcao",
            json={"sequencia_evento": sequencia, "texto_correcao": texto},
        )

    def inutilizar(
        self,
        serie: int,
        numero_inicial: int,
        numero_final: int,
        justificativa: str,
    ) -> FocusResponse:
        """Inutilização de numeração. POST /v2/nfe/inutilizacao"""
        return self._request(
            "POST",
            "/v2/nfe/inutilizacao",
            json={
                "serie": serie,
                "numero_inicial": numero_inicial,
                "numero_final": numero_final,
                "justificativa": justificativa,
            },
        )

    # ─── Manifestação de Destinatário ─────────────────────────────────────────

    def manifestar(self, chave: str, tipo_evento: str, justificativa: str = "") -> FocusResponse:
        """Manifestação de destinatário. POST /v2/nfes_recebidas/{chave}/manifesto"""
        body: dict[str, Any] = {"tipo_evento": tipo_evento}
        if justificativa:
            body["justificativa"] = justificativa
        return self._request("POST", f"/v2/nfes_recebidas/{chave}/manifesto", json=body)

    def listar_nfes_recebidas(self, cnpj: str, pagina: int = 1) -> FocusResponse:
        """Lista NF-es recebidas pelo CNPJ. GET /v2/nfes_recebidas"""
        return self._request("GET", f"/v2/nfes_recebidas?cnpj={cnpj}&pagina={pagina}")

    # ─── Internos ─────────────────────────────────────────────────────────────

    def _request(self, method: str, path: str, **kwargs: Any) -> FocusResponse:
        """Executa requisição e retorna FocusResponse normalizado.

        NUNCA levanta exception em 4xx/5xx — isso é responsabilidade do caller.
        httpx.TimeoutException propaga naturalmente para o Celery retry.
        """
        start = time.perf_counter()
        response = self._client.request(method, path, **kwargs)
        duration_ms = int((time.perf_counter() - start) * 1000)

        try:
            data: dict[str, Any] | None = response.json()
        except Exception:
            data = None

        logger.debug(
            "Focus NF-e %s %s → %s (%dms)",
            method,
            path,
            response.status_code,
            duration_ms,
        )

        return FocusResponse(
            status_code=response.status_code,
            data=data,
            duration_ms=duration_ms,
            raw_text=response.text,
            headers=dict(response.headers),
        )

    def close(self) -> None:
        """Fecha o client httpx. Chamar ao terminar se não usar context manager."""
        self._client.close()

    def __enter__(self) -> "FocusNFeClient":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()
