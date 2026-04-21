import logging

from django.db import transaction

from .models import NumberSequence

logger = logging.getLogger(__name__)


class NumberAllocator:
    """Aloca números sequenciais atômicos (SELECT FOR UPDATE)."""

    @classmethod
    @transaction.atomic
    def allocate(cls, sequence_type: str) -> str:
        """Retorna próximo número formatado (ex: 'OR-000042').

        Raises:
            NumberSequence.DoesNotExist: se sequence_type desconhecido.
        """
        seq = NumberSequence.objects.select_for_update().get(sequence_type=sequence_type)
        number = seq.next_number
        seq.next_number += 1
        seq.save(update_fields=["next_number"])
        formatted = f"{seq.prefix}{number:0{seq.padding}d}"
        logger.debug("Allocated %s #%d as %s", sequence_type, number, formatted)
        return formatted
