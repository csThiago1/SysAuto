"""
Paddock Solutions — Parts Catalog — Signals
Auto-learning: when a ServiceOrder transitions to 'delivered', register
PartApplication entries linking each part's manufacturer_code to the OS
vehicle (make + model + year range).
"""
from __future__ import annotations

import logging
from typing import Any

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender="service_orders.ServiceOrder")
def register_part_applications_on_delivery(
    sender: type,
    instance: Any,
    created: bool,
    **kwargs: Any,
) -> None:
    """Register PartApplication entries when an OS is delivered.

    Only fires when:
    - ``instance.status == "delivered"``
    - ``instance.make`` is a non-empty string (vehicle make is known)

    For each ServiceOrderPart with a non-empty part_number, the signal looks
    up the corresponding PartReference by manufacturer_code and calls
    get_or_create on PartApplication with source=OS_AUTO and confidence_score=90.

    Args:
        sender: The ServiceOrder model class.
        instance: The ServiceOrder instance that was saved.
        created: Whether this was an INSERT (True) or UPDATE (False).
        **kwargs: Additional signal keyword arguments.
    """
    if instance.status != "delivered":
        return

    # Lazy imports to avoid circular imports at module load time.
    from apps.parts_catalog.models import PartApplication, PartReference
    from apps.vehicle_catalog.models import VehicleMake, VehicleModel

    vehicle_make_name: str = (instance.make or "").strip()
    if not vehicle_make_name:
        logger.debug(
            "parts_catalog.signal: OS #%s delivered but no vehicle make — skipping.",
            instance.number,
        )
        return

    # ── Resolve VehicleMake ───────────────────────────────────────────────────
    vehicle_make: VehicleMake | None = None

    try:
        vehicle_make = VehicleMake.objects.get(nome__iexact=vehicle_make_name)
    except VehicleMake.DoesNotExist:
        # Fallback: normalised name (lowercase, no accents).
        normalised = vehicle_make_name.lower()
        vehicle_make = (
            VehicleMake.objects.filter(nome_normalizado__iexact=normalised).first()
        )
    except VehicleMake.MultipleObjectsReturned:
        vehicle_make = VehicleMake.objects.filter(nome__iexact=vehicle_make_name).first()

    if vehicle_make is None:
        logger.warning(
            "parts_catalog.signal: OS #%s — VehicleMake '%s' not found in catalog.",
            instance.number,
            vehicle_make_name,
        )
        return

    # ── Resolve VehicleModel (optional) ──────────────────────────────────────
    vehicle_model_name: str = (instance.model or "").strip()
    vehicle_model: VehicleModel | None = None

    if vehicle_model_name:
        vehicle_model = (
            VehicleModel.objects.filter(
                marca=vehicle_make,
                nome__iexact=vehicle_model_name,
            ).first()
            or VehicleModel.objects.filter(
                marca=vehicle_make,
                nome_normalizado__iexact=vehicle_model_name.lower(),
            ).first()
        )
        if vehicle_model is None:
            logger.debug(
                "parts_catalog.signal: OS #%s — VehicleModel '%s' not found for make '%s',"
                " will register against make only.",
                instance.number,
                vehicle_model_name,
                vehicle_make.nome,
            )

    # ── Year range ────────────────────────────────────────────────────────────
    year: int | None = instance.year  # PositiveSmallIntegerField, nullable

    # ── Iterate parts and register applications ───────────────────────────────
    parts = instance.parts.filter(part_number__gt="").select_related()
    registered_count = 0

    for part in parts:
        code: str = part.part_number.strip()
        if not code:
            continue

        try:
            part_ref = PartReference.objects.get(manufacturer_code=code)
        except PartReference.DoesNotExist:
            logger.debug(
                "parts_catalog.signal: OS #%s — PartReference '%s' not found, skipping.",
                instance.number,
                code,
            )
            continue

        _, created_app = PartApplication.objects.get_or_create(
            part_ref=part_ref,
            make=vehicle_make,
            model=vehicle_model,
            source=PartApplication.Source.OS_AUTO,
            defaults={
                "year_start": year,
                "year_end": year,
                "confidence_score": 90,
            },
        )
        if created_app:
            registered_count += 1

    logger.info(
        "parts_catalog.signal: OS #%s delivered — %d new PartApplication(s) registered"
        " for make='%s' model='%s'.",
        instance.number,
        registered_count,
        vehicle_make.nome,
        vehicle_model.nome if vehicle_model else "(any)",
    )
