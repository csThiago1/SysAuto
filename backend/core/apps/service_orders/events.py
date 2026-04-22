"""Helper centralizado para logar eventos na timeline da OS.

Usado por todos os services (BudgetService, ServiceOrderService, etc) para
registrar mutações de forma consistente. Substitui o uso direto de
ServiceOrderEvent.objects.create — garante assinatura uniforme.
"""
from __future__ import annotations

import logging
from typing import Any

from .models import ServiceOrder, ServiceOrderEvent

logger = logging.getLogger(__name__)


class OSEventLogger:
    """Registra eventos na timeline de uma OS.

    Todos os services devem usar este helper em vez de criar
    ServiceOrderEvent diretamente, garantindo auditoria consistente.
    """

    @staticmethod
    def log_event(
        service_order: ServiceOrder,
        event_type: str,
        *,
        actor: str = "Sistema",
        payload: dict[str, Any] | None = None,
        from_state: str = "",
        to_state: str = "",
    ) -> ServiceOrderEvent:
        """Cria um ServiceOrderEvent.

        Args:
            service_order: instância da OS.
            event_type: um dos valores de ServiceOrderEvent.EVENT_TYPES.
            actor: nome/username de quem disparou. Default "Sistema" (auto-transition).
            payload: dict JSON-serializável com detalhes.
            from_state: estado anterior (para STATUS_CHANGE).
            to_state: estado novo (para STATUS_CHANGE).

        Returns:
            Instância recém-criada de ServiceOrderEvent.
        """
        event = ServiceOrderEvent.objects.create(
            service_order=service_order,
            event_type=event_type,
            actor=actor,
            payload=payload or {},
            from_state=from_state,
            to_state=to_state,
        )
        logger.debug(
            "OS %s — evento %s registrado por %s",
            service_order.os_number,
            event_type,
            actor,
        )
        return event
