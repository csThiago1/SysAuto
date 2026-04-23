"""NumberAllocator — geração thread-safe de números sequenciais via SELECT FOR UPDATE."""
from __future__ import annotations

import logging

from django.db import transaction

logger = logging.getLogger(__name__)


class NumberAllocator:
    """Aloca números sequenciais atômicos por tipo (BUDGET, SERVICE_ORDER, etc.)."""

    @classmethod
    @transaction.atomic
    def allocate(cls, sequence_type: str) -> str:
        """Retorna próximo número formatado (ex: 'ORC-2026-000001').

        Args:
            sequence_type: "BUDGET" ou "SERVICE_ORDER".

        Returns:
            String formatada conforme prefix + padding da sequência.

        Raises:
            NumberSequence.DoesNotExist: se sequence_type não está seedado.
        """
        from apps.items.models import NumberSequence

        seq = NumberSequence.objects.select_for_update().get(
            sequence_type=sequence_type
        )
        number = seq.next_number
        seq.next_number += 1
        seq.save(update_fields=["next_number"])
        formatted = f"{seq.prefix}{number:0{seq.padding}d}"
        logger.debug("Allocated %s #%d as %s", sequence_type, number, formatted)
        return formatted
