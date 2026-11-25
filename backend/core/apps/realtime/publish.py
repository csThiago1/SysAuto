"""Publica aviso de mudança no grupo do tenant, só depois do commit."""

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from django.conf import settings
from django.db import connection, transaction

from apps.realtime.consumers import group_name

logger = logging.getLogger(__name__)


def publish_change(entity: str, obj_id: object) -> None:
    if not settings.REALTIME_ENABLED:
        return
    group = group_name(connection.schema_name)  # lido agora: o on_commit roda depois
    message = {
        "type": "realtime.event",
        "event": {"entity": entity, "id": str(obj_id), "action": "changed"},
    }

    def send() -> None:
        try:
            async_to_sync(get_channel_layer().group_send)(group, message)
        except Exception:
            logger.warning("realtime: falha ao publicar %s", entity)

    transaction.on_commit(send)
