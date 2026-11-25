"""Ticket assinado de curta duração para autenticar o websocket (sem PII)."""

from django.core.signing import BadSignature, TimestampSigner

_signer = TimestampSigner(salt="realtime.ticket")
MAX_AGE_SEGUNDOS = 60


def make_ticket(user_id: str, schema: str) -> str:
    return _signer.sign_object({"u": user_id, "s": schema})


def read_ticket(ticket: str) -> tuple[str, str] | None:
    """Devolve (user_id, schema) ou None se inválido/vencido."""
    try:
        dados = _signer.unsign_object(ticket, max_age=MAX_AGE_SEGUNDOS)
        return str(dados["u"]), str(dados["s"])
    except (BadSignature, KeyError, TypeError):
        return None
