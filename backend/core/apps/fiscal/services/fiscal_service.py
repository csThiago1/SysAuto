"""
Paddock Solutions — Fiscal — FiscalService
Ciclo 06B: Fiscal Foundation (skeleton funcional)
Ciclo 06C: emit_nfse, emit_manual_nfse, cancel — implementação completa

Responsabilidades:
- Orquestrar chamadas ao FocusNFeClient
- Persistir FiscalEvent (auditoria imutável)
- Traduzir http_status → exceção de domínio via _raise_for_http()
- Atualizar FiscalDocument conforme resposta da Focus
"""

import logging
from typing import TYPE_CHECKING, Any

from apps.fiscal.clients.focus_nfe_client import FocusResponse
from apps.fiscal.exceptions import (
    FocusAuthError,
    FocusConflict,
    FocusNotFoundError,
    FocusRateLimitError,
    FocusServerError,
    FocusValidationError,
)

if TYPE_CHECKING:
    from apps.fiscal.models import FiscalConfigModel, FiscalDocument

logger = logging.getLogger(__name__)


class FiscalService:
    """Serviço de emissão e gerenciamento de documentos fiscais.

    Todos os métodos de emissão são @transaction.atomic.
    _raise_for_http() é o único ponto de mapeamento HTTP → exceção de domínio.
    """

    @classmethod
    def get_config(cls) -> "FiscalConfigModel":
        """Retorna a configuração fiscal ativa.

        Raises:
            FiscalConfigModel.DoesNotExist: Nenhum emissor cadastrado.
        """
        from apps.fiscal.models import FiscalConfigModel

        return FiscalConfigModel.objects.get(is_active=True)

    @classmethod
    def emit_nfse(
        cls,
        service_order: Any,
        payment: Any,
        config: "FiscalConfigModel",
        triggered_by: str = "USER",
    ) -> "FiscalDocument":
        """Emite NFS-e a partir de uma OS e pagamento.

        Implementação completa no Ciclo 06C.
        """
        raise NotImplementedError("emit_nfse será implementado no Ciclo 06C.")

    @classmethod
    def emit_manual_nfse(
        cls,
        input_data: dict[str, Any],
        config: "FiscalConfigModel",
        user: Any,
        manual_reason: str,
    ) -> "FiscalDocument":
        """Emite NFS-e manual (ad-hoc, sem OS).

        Implementação completa no Ciclo 06C.
        """
        raise NotImplementedError("emit_manual_nfse será implementado no Ciclo 06C.")

    @classmethod
    def cancel(cls, doc: "FiscalDocument", justificativa: str) -> "FiscalDocument":
        """Cancela documento fiscal autorizado.

        Implementação completa no Ciclo 06C.
        """
        raise NotImplementedError("cancel será implementado no Ciclo 06C.")

    @classmethod
    def consult(cls, doc: "FiscalDocument") -> "FiscalDocument":
        """Consulta status de documento fiscal na Focus.

        Implementação completa no Ciclo 06C.
        """
        raise NotImplementedError("consult será implementado no Ciclo 06C.")

    @staticmethod
    def _raise_for_http(resp: FocusResponse) -> None:
        """Traduz http_status_code em exceção de domínio.

        Chamado após cada resposta HTTP da Focus.
        2xx: retorna normalmente (sem exceção).
        4xx/5xx: levanta a exceção adequada com o payload de erro.

        Args:
            resp: FocusResponse retornado pelo FocusNFeClient.

        Raises:
            FocusAuthError: 401 ou 403 — token inválido/sem permissão.
            FocusNotFoundError: 404 — ref não encontrada na Focus.
            FocusConflict: 409 — conflito de ref.
            FocusRateLimitError: 429 — rate limit excedido.
            FocusValidationError: 400/415/422 — payload inválido (não fazer retry).
            FocusServerError: 5xx — erro interno Focus/SEFAZ (fazer retry).
        """
        sc = resp.status_code
        if 200 <= sc < 300:
            return

        error_payload: Any = resp.data or {"raw": resp.raw_text}

        if sc in (401, 403):
            raise FocusAuthError(error_payload)
        if sc == 404:
            raise FocusNotFoundError(error_payload)
        if sc == 409:
            raise FocusConflict(error_payload)
        if sc == 429:
            raise FocusRateLimitError(error_payload)
        if 400 <= sc < 500:
            raise FocusValidationError(error_payload)
        if sc >= 500:
            raise FocusServerError(error_payload)

        # Status desconhecido — tratar como erro de servidor
        logger.warning("FiscalService: status_code inesperado %d", sc)
        raise FocusServerError(error_payload)
