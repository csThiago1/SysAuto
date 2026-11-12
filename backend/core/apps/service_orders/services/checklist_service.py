"""
Checklist de entrada 3D — trava, numeração de danos, vínculo de fotos, finalizar e reabrir.

O checklist finalizado fica travado: só reabrindo (MANAGER+) volta a aceitar escrita.
Devolver pertence é a exceção — acontece na entrega, com o checklist já travado.
"""

from __future__ import annotations

import datetime
import hashlib
import logging
import re
import secrets
from typing import Any
from urllib.parse import quote

from django.conf import settings
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Max, Prefetch
from django.utils import timezone
from rest_framework.exceptions import APIException, NotFound, ValidationError

from apps.authentication.models import GlobalUser
from apps.documents.data_loaders import OSDataLoader
from apps.documents.models import DocumentType
from apps.documents.services import DocumentService
from apps.persons.models import PersonContact, TipoContato
from apps.signatures.models import Signature
from apps.signatures.services import SignatureService
from apps.vehicle_catalog.normalize import normalize_name

from ..checklist_constants import EXTERIOR_STOPS, SignatureStatus
from ..models import (
    ActivityType,
    ChecklistDamage,
    ChecklistItem,
    CustomerBelonging,
    EntryChecklist,
    EntryChecklistVersion,
    FamilyBodyType,
    OSPhotoFolder,
    ServiceOrder,
    ServiceOrderActivityLog,
    ServiceOrderPhoto,
)
from ..models.checklist import ENTRY
from ..offline import find_by_uuid
from .budget_match import run_budget_match

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


class RemoteLinkExpired(APIException):
    """HTTP 410 — link remoto vencido ou já usado."""

    status_code = 410
    default_detail = {"detail": "Link expirado ou já utilizado.", "code": "link_expired"}
    default_code = "link_expired"


class PdfGenerationFailed(APIException):
    """HTTP 503 — o render não devolveu PDF (ex.: fallback HTML do WeasyPrint)."""

    status_code = 503
    default_detail = "Falha ao gerar o PDF; tente de novo."
    default_code = "pdf_generation_failed"


def get_or_create_checklist(order: ServiceOrder, checklist_type: str = ENTRY) -> EntryChecklist:
    checklist, _ = EntryChecklist.objects.get_or_create(
        service_order=order, checklist_type=checklist_type
    )
    return checklist


def lock_checklist(order: ServiceOrder) -> EntryChecklist:
    """Cria (se preciso) e trava a linha do checklist de entrada. Exige transaction.atomic."""
    return EntryChecklist.objects.select_for_update().get(pk=get_or_create_checklist(order).pk)


def assert_editable(order: ServiceOrder) -> EntryChecklist:
    """Trava o checklist e levanta ChecklistLocked se finalizado. Exige transaction.atomic.

    A trava serializa a escrita com um finalize concorrente: nada grava depois do PDF/sha256.
    """
    checklist = lock_checklist(order)
    if checklist.is_locked:
        raise ChecklistLocked()
    return checklist


def suggest_body_type(order: ServiceOrder) -> str | None:
    """Carroceria já usada na família do veículo; None se não houver família ou registro."""
    if not order.catalog_family_id:
        return None
    return (
        FamilyBodyType.objects.filter(family_id=order.catalog_family_id, is_active=True)
        .values_list("body_type", flat=True)
        .first()
    )


def model_slug(name: str | None) -> str | None:
    """Nome do catálogo → chave do modelo 3D: minúsculas, sem acento, espaço/hífen → `_`."""
    if not name:
        return None
    return re.sub(r"[\s-]+", "_", normalize_name(name).lower())


def set_body_type(checklist: EntryChecklist, body_type: str) -> None:
    """Grava a carroceria no checklist e alimenta a sugestão da família (upsert)."""
    checklist.body_type = body_type
    checklist.save(update_fields=["body_type", "updated_at"])
    family_id = checklist.service_order.catalog_family_id
    if family_id:
        FamilyBodyType.objects.update_or_create(
            family_id=family_id, defaults={"body_type": body_type, "is_active": True}
        )


@transaction.atomic
def update_checklist_state(order: ServiceOrder, data: dict[str, Any]) -> EntryChecklist:
    """PATCH do estado: `body_type` e `stops_done` (merge por chave)."""
    # Trava a linha: dois PATCHs de paradas simultâneos não se sobrescrevem.
    checklist = assert_editable(order)
    if "stops_done" in data:
        checklist.stops_done = {**checklist.stops_done, **data["stops_done"]}
        checklist.save(update_fields=["stops_done", "updated_at"])
    if "body_type" in data:
        set_body_type(checklist, data["body_type"])
    return checklist


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
    lookup = {"id__in": ids} if ids is not None else {"client_uuid__in": client_uuids}
    wanted = set(ids if ids is not None else client_uuids)
    photos = list(qs.filter(folder=OSPhotoFolder.ENTRY_CHECKLIST, checklist_type=ENTRY, **lookup))
    if len(photos) != len(wanted):
        # Foto existe mas é de outra etapa: erro definitivo, o mobile não deve reenviar.
        if qs.filter(**lookup).count() > len(photos):
            raise ValidationError({"photos": "not_entry_checklist"})
        raise ValidationError({"photos": "pending"})
    return photos


@transaction.atomic
def create_damage(
    order: ServiceOrder, data: dict[str, Any], user: GlobalUser
) -> tuple[ChecklistDamage, bool]:
    """Cria dano com número sequencial por OS. Mesmo client_uuid → devolve o existente."""
    data = dict(data)
    # Trava a linha do checklist: serializa numeração e replays concorrentes da mesma OS.
    checklist = lock_checklist(order)
    client_uuid = data.pop("client_uuid", None) or None
    existing = find_by_uuid(ChecklistDamage, client_uuid)
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
    # Trava antes do replay, como create_damage: serializa replays concorrentes do mesmo uuid.
    checklist = lock_checklist(order)
    client_uuid = data.pop("client_uuid", None) or None
    existing = find_by_uuid(CustomerBelonging, client_uuid)
    if existing is not None:
        return existing, False
    if checklist.is_locked:
        raise ChecklistLocked()
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


@transaction.atomic
def deactivate_damage(damage: ChecklistDamage) -> ChecklistDamage:
    assert_editable(damage.service_order)
    damage.soft_delete()
    return damage


def return_belonging(belonging: CustomerBelonging, user: GlobalUser) -> CustomerBelonging:
    """Marca como devolvido. Permitido com o checklist travado (acontece na entrega)."""
    if belonging.returned_at is None:
        belonging.returned_at = timezone.now()
        belonging.returned_by = user
        belonging.save(update_fields=["returned_at", "returned_by", "updated_at"])
    return belonging


SNAPSHOT_KEYS: tuple[str, ...] = ("front34", "rear34", "left", "right")
MODEL_CREDIT_MAX = 300
_PNG_DATA_URI = "data:image/png;base64,"


def _active_damages(order: ServiceOrder) -> list[ChecklistDamage]:
    active_photos = ServiceOrderPhoto.objects.filter(is_active=True).order_by("uploaded_at")
    return list(
        ChecklistDamage.objects.filter(service_order=order, checklist_type=ENTRY, is_active=True)
        .prefetch_related(Prefetch("photos", queryset=active_photos))
        .order_by("number")
    )


def _pdf_data(
    order: ServiceOrder,
    damages: list[ChecklistDamage],
    snapshots: dict[str, str],
    model_credit: str,
) -> dict[str, Any]:
    """Contexto do PDF — também vira o `data_snapshot` do DocumentGeneration."""
    data = OSDataLoader._base_context(order)
    data["order"]["customer_name"] = order.customer_name
    data["vehicle"] = OSDataLoader._vehicle_dict(order)
    data["snapshots"] = {key: snapshots[key] for key in SNAPSHOT_KEYS}
    data["model_credit"] = model_credit
    data["damages"] = [
        {
            "number": d.number,
            "panel": d.get_panel_key_display(),
            "type": d.get_damage_type_display(),
            "severity": d.severity,
            "severity_label": d.get_severity_display(),
            "relation": d.get_relation_display(),
            "photo_url": default_storage.url(d.photos.all()[0].s3_key),
        }
        for d in damages
    ]
    data["items"] = [
        {
            "category": item.get_category_display(),
            "item_key": item.item_key,
            "status": item.get_status_display(),
            "notes": item.notes,
        }
        for item in ChecklistItem.objects.filter(service_order=order, checklist_type=ENTRY)
    ]
    data["belongings"] = list(
        CustomerBelonging.objects.filter(service_order=order, is_active=True)
        .order_by("created_at")
        .values_list("description", flat=True)
    )
    return data


@transaction.atomic
def finalize(
    checklist: EntryChecklist,
    snapshots: dict[str, str],
    user: GlobalUser,
    model_credit: str = "",
) -> EntryChecklist:
    """Valida, gera o PDF e trava o checklist. Pendências → 400 `{"missing": [...]}`.

    `model_credit`: crédito do modelo 3D usado nas vistas, impresso no rodapé do PDF.
    """
    model_credit = model_credit.strip()
    if len(model_credit) > MODEL_CREDIT_MAX:
        raise ValidationError({"model_credit": f"Máximo de {MODEL_CREDIT_MAX} caracteres."})
    checklist = (
        EntryChecklist.objects.select_for_update(of=("self",))
        .select_related("service_order")
        .get(pk=checklist.pk)
    )
    if checklist.is_locked:
        raise ChecklistLocked()
    order = checklist.service_order
    damages = _active_damages(order)
    missing = [f"stop:{stop}" for stop in EXTERIOR_STOPS if stop not in checklist.stops_done]
    missing += [f"damage:{d.number}:photo" for d in damages if not d.photos.all()]
    if not checklist.body_type:
        missing.append("body_type")
    missing += [
        f"snapshot:{key}"
        for key in SNAPSHOT_KEYS
        if not (isinstance(snapshots.get(key), str) and snapshots[key].startswith(_PNG_DATA_URI))
    ]
    if missing:
        raise ValidationError({"missing": missing})

    run_budget_match(order)
    doc = DocumentService.generate(
        order.pk,
        DocumentType.CHECKLIST_ENTRADA,
        _pdf_data(order, damages, snapshots, model_credit),
        user,
    )
    with default_storage.open(doc.s3_key, "rb") as f:
        pdf_bytes = f.read()
    if not pdf_bytes.startswith(b"%PDF-"):
        # Sem PDF não trava: o atomic desfaz o DocumentGeneration.
        logger.error("Render do checklist da OS %s não gerou PDF", order.pk)
        raise PdfGenerationFailed()
    pdf_sha256 = hashlib.sha256(pdf_bytes).hexdigest()

    checklist.finalized_at = timezone.now()
    checklist.finalized_by = user
    checklist.pdf = doc
    checklist.pdf_sha256 = pdf_sha256
    checklist.signature_status = SignatureStatus.PENDENTE
    checklist.signature = None
    checklist.save()
    ServiceOrderActivityLog.objects.create(
        service_order=order,
        user=user,
        activity_type=ActivityType.CHECKLIST_FINALIZED,
        description=f"Checklist de entrada v{checklist.version} finalizado",
        metadata={"version": checklist.version, "document_id": str(doc.pk)},
    )
    logger.info("Checklist de entrada v%s finalizado na OS %s", checklist.version, order.pk)
    return checklist


@transaction.atomic
def reopen(checklist: EntryChecklist, reason: str, user: GlobalUser) -> EntryChecklist:
    """Guarda a versão atual em EntryChecklistVersion e destrava (version + 1)."""
    reason = (reason or "").strip()
    if not reason:
        raise ValidationError({"reason": "Informe o motivo da reabertura."})
    checklist = (
        EntryChecklist.objects.select_for_update()
        .select_related("service_order")
        .get(pk=checklist.pk)
    )
    if not checklist.is_locked:
        raise ValidationError({"detail": "Checklist não está finalizado."})
    EntryChecklistVersion.objects.create(
        checklist=checklist,
        version=checklist.version,
        pdf=checklist.pdf,
        pdf_sha256=checklist.pdf_sha256,
        signature_status=checklist.signature_status,
        signature=checklist.signature,
        reopened_reason=reason,
        reopened_by=user,
        created_by=user,
    )
    previous = checklist.version
    checklist.finalized_at = None
    checklist.pdf = None
    checklist.pdf_sha256 = ""
    checklist.signature = None
    checklist.remote_token_hash = ""
    checklist.remote_expires_at = None
    checklist.version = previous + 1
    checklist.signature_status = SignatureStatus.PENDENTE
    checklist.save()
    ServiceOrderActivityLog.objects.create(
        service_order=checklist.service_order,
        user=user,
        activity_type=ActivityType.CHECKLIST_REOPENED,
        description=f"Checklist de entrada v{previous} reaberto: {reason}",
        metadata={"version": previous, "reason": reason},
    )
    logger.info("Checklist de entrada v%s reaberto na OS %s", previous, checklist.service_order_id)
    return checklist


SIGNATURE_DOC_TYPE = "VISTORIA_ENTRADA"
REMOTE_LINK_TTL = datetime.timedelta(days=7)


def _assert_signable(checklist: EntryChecklist, signer_name: str) -> None:
    if not checklist.is_locked:
        raise ValidationError({"detail": "Finalize o checklist antes de assinar."})
    if checklist.signature_status != SignatureStatus.PENDENTE:
        raise ValidationError({"detail": "Checklist já assinado."})
    if not signer_name.strip():
        raise ValidationError({"signer_name": "Informe o nome de quem assina."})
    if len(signer_name.strip()) > 200:
        raise ValidationError({"signer_name": "Máximo de 200 caracteres."})


def _record_signature(checklist: EntryChecklist, signature: Signature, status: str) -> None:
    """Liga a assinatura ao checklist, inutiliza o link remoto e registra no log da OS."""
    checklist.signature = signature
    checklist.signature_status = status
    # Hash fica: o mesmo link responde 410 (já usado) em vez de 404.
    checklist.remote_expires_at = None
    checklist.save(
        update_fields=["signature", "signature_status", "remote_expires_at", "updated_at"]
    )
    ServiceOrderActivityLog.objects.create(
        service_order=checklist.service_order,
        # Aceite remoto não tem usuário logado: atribui a quem finalizou o checklist.
        user_id=checklist.finalized_by_id,
        activity_type=ActivityType.CHECKLIST_SIGNED,
        description=f"Checklist de entrada v{checklist.version} assinado ({status})",
        metadata={"version": checklist.version, "method": signature.method},
    )
    logger.info(
        "Checklist de entrada v%s assinado (%s) na OS %s",
        checklist.version,
        status,
        checklist.service_order_id,
    )


@transaction.atomic
def sign_presencial(
    checklist: EntryChecklist, signer_name: str, png_b64: str, ip: str | None, ua: str
) -> Signature:
    """Assinatura no iPad (canvas). Exige checklist finalizado."""
    checklist = (
        EntryChecklist.objects.select_for_update(of=("self",))
        .select_related("service_order")
        .get(pk=checklist.pk)
    )
    _assert_signable(checklist, signer_name)
    signature = SignatureService.capture(
        document_type=SIGNATURE_DOC_TYPE,
        method="CANVAS_TABLET",
        signer_name=signer_name.strip(),
        # Canvas do navegador manda data URI; o capture espera base64 puro.
        signature_png_base64=png_b64.removeprefix(_PNG_DATA_URI),
        service_order=checklist.service_order,
        ip_address=ip,
        user_agent=ua,
        notes=f"Checklist v{checklist.version} · sha256 {checklist.pdf_sha256}",
    )
    _record_signature(checklist, signature, SignatureStatus.PRESENCIAL)
    return signature


def _whatsapp_number(order: ServiceOrder) -> str:
    """Dígitos do WhatsApp principal do cliente com DDI 55; vazio se não houver."""
    if not order.customer_id:
        return ""
    contact = (
        PersonContact.objects.filter(person_id=order.customer_id, contact_type=TipoContato.WHATSAPP)
        .order_by("-is_primary", "pk")
        .first()
    )
    digits = re.sub(r"\D", "", contact.value) if contact else ""
    if not digits:
        return ""
    # Já salvo com DDI (+55 92 9…): não duplica.
    return digits if digits.startswith("55") and len(digits) > 11 else f"55{digits}"


@transaction.atomic
def create_remote_link(checklist: EntryChecklist) -> dict[str, str]:
    """Gera o link de aceite remoto (7 dias) e a URL wa.me com a mensagem pronta."""
    checklist = (
        EntryChecklist.objects.select_for_update(of=("self",))
        .select_related("service_order")
        .get(pk=checklist.pk)
    )
    if not checklist.is_locked:
        raise ValidationError({"detail": "Finalize o checklist antes de enviar o link."})
    if checklist.signature_status != SignatureStatus.PENDENTE:
        raise ValidationError({"detail": "Checklist já assinado."})
    token = secrets.token_urlsafe(32)
    checklist.remote_token_hash = hashlib.sha256(token.encode()).hexdigest()
    checklist.remote_expires_at = timezone.now() + REMOTE_LINK_TTL
    checklist.save(update_fields=["remote_token_hash", "remote_expires_at", "updated_at"])

    order = checklist.service_order
    url = f"{settings.FRONTEND_URL}/confirmar-checklist/{token}"
    message = (
        f"Olá! Segue o checklist de entrada do seu veículo {order.plate} na DS Car. "
        f"Confira e confirme: {url}"
    )
    whatsapp_url = f"https://wa.me/{_whatsapp_number(order)}?text={quote(message)}"
    logger.info("Link remoto do checklist v%s gerado na OS %s", checklist.version, order.pk)
    return {"url": url, "whatsapp_url": whatsapp_url}


def get_by_remote_token(token: str, for_update: bool = False) -> EntryChecklist:
    """Checklist do token. Não existe → 404; vencido ou já usado → 410."""
    qs = EntryChecklist.objects.select_related("service_order", "pdf")
    if for_update:
        qs = qs.select_for_update(of=("self",))
    checklist = qs.filter(
        remote_token_hash=hashlib.sha256(token.encode()).hexdigest(),
        finalized_at__isnull=False,
    ).first()
    if checklist is None:
        raise NotFound()
    if checklist.remote_expires_at is None or checklist.remote_expires_at <= timezone.now():
        raise RemoteLinkExpired()
    return checklist


@transaction.atomic
def confirm_remote(token: str, signer_name: str, ip: str | None, ua: str) -> Signature:
    """Aceite remoto: sem desenho, grava o hash do PDF confirmado nas notas."""
    checklist = get_by_remote_token(token, for_update=True)
    _assert_signable(checklist, signer_name)
    signature = SignatureService.capture(
        document_type=SIGNATURE_DOC_TYPE,
        method="REMOTE_LINK",
        signer_name=signer_name.strip(),
        signature_png_base64="",
        service_order=checklist.service_order,
        ip_address=ip,
        user_agent=ua,
        notes=f"Aceite remoto · checklist v{checklist.version} · sha256 {checklist.pdf_sha256}",
    )
    _record_signature(checklist, signature, SignatureStatus.REMOTO)
    return signature
