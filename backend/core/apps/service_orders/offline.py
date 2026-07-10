"""Helpers do sync offline (PWA onda 5) — idempotência por client_uuid e If-Match.

O cliente offline enfileira mutations com um UUID v7 gerado no device.
No replay, creates idempotentes devolvem a entidade já criada em vez de
duplicar; updates com If-Match divergente levantam 409 pro cliente abrir
o fluxo de resolução de conflito.
"""
from typing import Optional, Type, TypeVar

from django.db import models
from rest_framework.exceptions import APIException

M = TypeVar("M", bound=models.Model)


class Conflict(APIException):
    """HTTP 409 — recurso alterado por outro usuário (If-Match divergente)."""

    status_code = 409
    default_detail = "Recurso alterado por outro usuário."
    default_code = "conflict"


def find_by_client_uuid(model: Type[M], request) -> Optional[M]:
    """Retorna a instância já sincada se request.data trouxer um client_uuid conhecido."""
    client_uuid = request.data.get("client_uuid") or ""
    if not client_uuid:
        return None
    return model.objects.filter(client_uuid=client_uuid).first()


def check_if_match(instance: models.Model, request) -> None:
    """Levanta Conflict(409) se o header If-Match diverge do updated_at atual.

    Header ausente = sem verificação (fluxo online atual permanece intacto).
    """
    if_match = request.headers.get("If-Match")
    if not if_match:
        return
    current = instance.updated_at.isoformat()
    if current != if_match:
        raise Conflict(
            detail=(
                f"Registro alterado por outro usuário em "
                f"{instance.updated_at:%d/%m %H:%M}."
            )
        )
