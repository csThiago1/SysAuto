"""
Paddock Solutions — Accounting: Serviço de Numeração Sequencial

NumberingService — gera numeração sequencial thread-safe por tenant.
"""
import logging

from django.db import transaction

from apps.accounting.models.sequences import NumberSequence

logger = logging.getLogger(__name__)


class NumberingService:
    """
    Gera numeração sequencial thread-safe por tenant.

    Usa select_for_update() para evitar race condition em ambientes
    com múltiplas threads/workers Gunicorn.

    Sequences disponíveis:
        JE: Lançamento Contábil (JE000001)
        AP: Contas a Pagar      (AP000001)
        AR: Contas a Receber    (AR000001)
    """

    SEQUENCES: dict[str, tuple[str, int]] = {
        "JE": ("JE", 6),
        "AP": ("AP", 6),
        "AR": ("AR", 6),
    }

    @classmethod
    @transaction.atomic
    def next(cls, key: str) -> str:
        """
        Gera e retorna o próximo número da sequência, incrementando o contador.

        Args:
            key: Chave da sequência (ex: 'JE', 'AP', 'AR').

        Returns:
            Número formatado (ex: 'JE000001').

        Raises:
            KeyError: Se a chave não estiver registrada em SEQUENCES.
        """
        if key not in cls.SEQUENCES:
            raise KeyError(f"Sequência '{key}' não registrada. Use: {list(cls.SEQUENCES)}")

        seq, _ = NumberSequence.objects.select_for_update().get_or_create(
            key=key,
            defaults={"last_number": 0},
        )
        seq.last_number += 1
        seq.save(update_fields=["last_number", "updated_at"])

        prefix, digits = cls.SEQUENCES[key]
        number = f"{prefix}{seq.last_number:0{digits}d}"
        logger.debug("NumberingService.next: %s -> %s", key, number)
        return number

    @classmethod
    def peek_next(cls, key: str) -> str:
        """
        Retorna o próximo número SEM incrementar (apenas consulta).

        Útil para exibir ao usuário antes de confirmar a criação.

        Args:
            key: Chave da sequência (ex: 'JE').

        Returns:
            Número formatado que seria gerado na próxima chamada a next().

        Raises:
            KeyError: Se a chave não estiver registrada em SEQUENCES.
        """
        if key not in cls.SEQUENCES:
            raise KeyError(f"Sequência '{key}' não registrada. Use: {list(cls.SEQUENCES)}")

        seq = NumberSequence.objects.filter(key=key).first()
        current = seq.last_number if seq else 0
        prefix, digits = cls.SEQUENCES[key]
        return f"{prefix}{current + 1:0{digits}d}"
