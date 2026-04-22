"""
OSEventLogger — helper cross-cutting para logar eventos na timeline da OS.
Chamado por ServiceOrderService e outros services. Nunca interrompe o fluxo principal.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class OSEventLogger:
    """Registra eventos imutáveis na timeline de uma OS (ServiceOrderEvent)."""

    @classmethod
    def log_event(
        cls,
        service_order: Any,
        event_type: str,
        *,
        actor: str = "Sistema",
        payload: dict[str, Any] | None = None,
        from_state: str = "",
        to_state: str = "",
        swallow_errors: bool = False,
    ) -> None:
        """
        Persiste um ServiceOrderEvent.

        Args:
            service_order: Instância de ServiceOrder (ou objeto com .pk).
            event_type: Um dos EVENT_TYPES definidos em ServiceOrderEvent.
            actor: Nome do usuário ou sistema que gerou o evento.
            payload: Dict com detalhes adicionais do evento.
            from_state: Estado anterior (status changes).
            to_state: Estado novo (status changes).
            swallow_errors: Se True, captura exceções sem propagar (uso em contextos críticos).
        """
        try:
            from apps.service_orders.models import ServiceOrderEvent

            ServiceOrderEvent.objects.create(
                service_order_id=service_order.pk,
                event_type=event_type,
                actor=actor,
                payload=payload or {},
                from_state=from_state,
                to_state=to_state,
            )
        except Exception as exc:
            logger.error(
                "OSEventLogger falhou ao registrar evento %s para OS %s: %s",
                event_type,
                getattr(service_order, "pk", "?"),
                exc,
            )
            if not swallow_errors:
                raise
