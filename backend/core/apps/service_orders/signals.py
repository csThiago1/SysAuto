"""Avisa o tempo real quando a OS ou seu histórico (itens, fotos, pagamentos) muda."""

from typing import Any

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.realtime.publish import publish_change
from apps.service_orders.models import ServiceOrder
from apps.service_orders.models.versioning import ServiceOrderEvent


@receiver(post_save, sender=ServiceOrder)
def os_salva(sender: type[ServiceOrder], instance: ServiceOrder, **kwargs: Any) -> None:
    publish_change("service_order", instance.pk)


@receiver(post_save, sender=ServiceOrderEvent)
def evento_salvo(
    sender: type[ServiceOrderEvent], instance: ServiceOrderEvent, **kwargs: Any
) -> None:
    publish_change("service_order", instance.service_order_id)
