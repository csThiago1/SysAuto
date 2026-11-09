"""
Checklist de entrada 3D — trava, numeração de danos e vínculo de fotos.

O checklist finalizado fica travado: só reabrindo (MANAGER+) volta a aceitar escrita.
Devolver pertence é a exceção — acontece na entrega, com o checklist já travado.
"""

from __future__ import annotations

import logging
from typing import Any

from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from apps.authentication.models import GlobalUser

from ..models import (
    ChecklistDamage,
    CustomerBelonging,
    EntryChecklist,
    ServiceOrder,
    ServiceOrderPhoto,
)
from ..models.checklist import ENTRY

logger = logging.getLogger(__name__)


class ChecklistLocked(APIException):
    """HTTP 409 — checklist finalizado; reabrir antes de editar."""

    status_code = 409
    # dict: o corpo leva o `code` para o cliente distinguir de outros 409 (If-Match).
    default_detail = {
        "detail": "Checklist já finalizado. Reabra para editar.",
        "code": "checklist_locked",
    }
    default_code = "checklist_locked"


def get_or_create_checklist(order: ServiceOrder, checklist_type: str = ENTRY) -> EntryChecklist:
    checklist, _ = EntryChecklist.objects.get_or_create(
        service_order=order, checklist_type=checklist_type
    )
    return checklist


def assert_editable(order: ServiceOrder) -> None:
    """Levanta ChecklistLocked se o checklist de entrada da OS estiver finalizado."""
    if EntryChecklist.objects.filter(
        service_order=order, checklist_type=ENTRY, finalized_at__isnull=False
    ).exists():
        raise ChecklistLocked()


def resolve_photos(order: ServiceOrder, data: dict[str, Any]) -> list[ServiceOrderPhoto] | None:
    """Resolve `photo_ids` (UUID) ou `photo_client_uuids` em fotos ativas da OS.

    Remove as duas chaves de `data`. None = nenhuma das chaves veio (não mexer nas fotos).
    Foto ainda não sincada → 400 `{"photos": "pending"}`; o mobile reenvia depois.
    """
    ids = data.pop("photo_ids", None)
    client_uuids = data.pop("photo_client_uuids", None)
    if ids is None and client_uuids is None:
        return None
    qs = ServiceOrderPhoto.objects.filter(service_order=order, is_active=True)
    if ids is not None:
        wanted, photos = set(ids), list(qs.filter(id__in=ids))
    else:
        wanted, photos = set(client_uuids), list(qs.filter(client_uuid__in=client_uuids))
    if len(photos) != len(wanted):
        raise ValidationError({"photos": "pending"})
    return photos


@transaction.atomic
def create_damage(
    order: ServiceOrder, data: dict[str, Any], user: GlobalUser
) -> tuple[ChecklistDamage, bool]:
    """Cria dano com número sequencial por OS. Mesmo client_uuid → devolve o existente."""
    data = dict(data)
    # Trava a linha do checklist: serializa numeração e replays concorrentes da mesma OS.
    checklist = EntryChecklist.objects.select_for_update().get(pk=get_or_create_checklist(order).pk)
    client_uuid = data.pop("client_uuid", None) or None
    if client_uuid:
        existing = ChecklistDamage.objects.filter(client_uuid=client_uuid).first()
        if existing is not None:
            return existing, False
    if checklist.is_locked:
        raise ChecklistLocked()
    photos = resolve_photos(order, data)
    # Inclui inativos: número de dano desativado nunca é reaproveitado.
    last = ChecklistDamage.objects.filter(service_order=order, checklist_type=ENTRY).aggregate(
        n=Max("number")
    )["n"]
    damage = ChecklistDamage.objects.create(
        service_order=order,
        checklist_type=ENTRY,
        number=(last or 0) + 1,
        client_uuid=client_uuid,
        created_by=user,
        **data,
    )
    if photos:
        damage.photos.set(photos)
    logger.info("Dano %s criado na OS %s", damage.number, order.pk)
    return damage, True


@transaction.atomic
def update_damage(damage: ChecklistDamage, data: dict[str, Any]) -> ChecklistDamage:
    assert_editable(damage.service_order)
    data = dict(data)
    photos = resolve_photos(damage.service_order, data)
    for field, value in data.items():
        setattr(damage, field, value)
    damage.save()
    if photos is not None:
        damage.photos.set(photos)
    return damage


def _resolve_belonging_photo(order: ServiceOrder, data: dict[str, Any]) -> None:
    """Troca `photo_id` / `photo_client_uuid` de `data` pela foto (`data["photo"]`)."""
    photo_id = data.pop("photo_id", None)
    photo_client_uuid = data.pop("photo_client_uuid", None)
    if photo_id or photo_client_uuid:
        refs = (
            {"photo_ids": [photo_id]} if photo_id else {"photo_client_uuids": [photo_client_uuid]}
        )
        data["photo"] = (resolve_photos(order, refs) or [])[0]


@transaction.atomic
def create_belonging(
    order: ServiceOrder, data: dict[str, Any], user: GlobalUser
) -> tuple[CustomerBelonging, bool]:
    """Cria pertence. Mesmo client_uuid → devolve o existente."""
    data = dict(data)
    client_uuid = data.pop("client_uuid", None) or None
    if client_uuid:
        existing = CustomerBelonging.objects.filter(client_uuid=client_uuid).first()
        if existing is not None:
            return existing, False
    assert_editable(order)
    _resolve_belonging_photo(order, data)
    belonging = CustomerBelonging.objects.create(
        service_order=order, client_uuid=client_uuid, created_by=user, **data
    )
    return belonging, True


@transaction.atomic
def update_belonging(belonging: CustomerBelonging, data: dict[str, Any]) -> CustomerBelonging:
    assert_editable(belonging.service_order)
    data = dict(data)
    _resolve_belonging_photo(belonging.service_order, data)
    for field, value in data.items():
        setattr(belonging, field, value)
    belonging.save()
    return belonging


def return_belonging(belonging: CustomerBelonging, user: GlobalUser) -> CustomerBelonging:
    """Marca como devolvido. Permitido com o checklist travado (acontece na entrega)."""
    if belonging.returned_at is None:
        belonging.returned_at = timezone.now()
        belonging.returned_by = user
        belonging.save(update_fields=["returned_at", "returned_by", "updated_at"])
    return belonging
