# backend/core/apps/items/services.py
"""
NumberAllocator — geracao thread-safe de numeros sequenciais.

Stub para desbloquear o import em cilia/dtos.py.
Implementacao completa vira com o app budgets/.
"""
from __future__ import annotations

from django.db import transaction


class NumberAllocator:
    """Aloca numeros sequenciais por tipo (BUDGET, SERVICE_ORDER, etc.)."""

    @classmethod
    @transaction.atomic
    def allocate(cls, sequence_type: str) -> str:
        """
        Retorna proximo numero da sequencia como string formatada.
        Stub: usa MAX+1 do ServiceOrderService para SERVICE_ORDER.

        Args:
            sequence_type: "BUDGET", "SERVICE_ORDER", etc.

        Returns:
            String formatada (ex: "OS-000042")

        Raises:
            ValueError: quando sequence_type nao e suportado ainda.
        """
        if sequence_type == "SERVICE_ORDER":
            from apps.service_orders.services import ServiceOrderService

            num = ServiceOrderService.get_next_number()
            return f"OS-{num:06d}"
        raise ValueError(
            f"NumberAllocator: sequence_type '{sequence_type}' nao suportado ainda."
        )
