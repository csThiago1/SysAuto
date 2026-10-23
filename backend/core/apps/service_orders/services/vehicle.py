"""
Veículo da OS a partir do catálogo: família/versão (FKs) → snapshot de texto do servidor.
"""

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any

from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.vehicle_catalog.matching import match_vehicle
from apps.vehicle_catalog.models import VehicleFamily, VehicleYearVersion
from apps.vehicle_catalog.snapshot import build_snapshot, resolve_family

if TYPE_CHECKING:
    from apps.service_orders.models import ServiceOrder

CATALOG_KEYS = frozenset({"catalog_family", "catalog_version"})


def apply_catalog_vehicle(
    order: "ServiceOrder",
    *,
    family: VehicleFamily | None,
    version: VehicleYearVersion | None,
    needs_review: bool | None = None,
    source: str = "",
    source_text: str = "",
    source_year: int | None = None,
) -> None:
    """Grava FKs + snapshot na OS (não salva). Sem versão, o selo "a confirmar" liga."""
    snap = build_snapshot(family, version)
    order.catalog_family = resolve_family(family, version)
    order.catalog_version = version
    order.make = snap.make
    order.make_logo = snap.make_logo
    order.model = snap.model
    order.vehicle_version = snap.version
    order.year = snap.year
    order.zero_km = snap.zero_km
    order.fuel_type = snap.fuel_type
    order.fipe_value = snap.fipe_value
    order.vehicle_fipe_value_snapshot = snap.fipe_value
    order.vehicle_needs_review = needs_review if needs_review is not None else version is None
    if source:
        order.vehicle_source = source
    if source_text:
        order.vehicle_source_text = source_text
    if source_year is not None:
        order.vehicle_source_year = source_year


def apply_vehicle_text(
    order: "ServiceOrder", *, brand: str, text: str, year: int | None, source: str
) -> None:
    """Casa um texto livre de veículo com o catálogo e grava o resultado na OS (não salva)."""
    match = match_vehicle(brand, text, year, source=source)
    apply_catalog_vehicle(
        order,
        family=match.family,
        version=match.version,
        needs_review=match.review,
        source=source,
        source_text=f"{brand} {text}".strip()[:300],
        source_year=year,
    )


def resulting_catalog_pair(
    order: "ServiceOrder | None", data: Mapping[str, Any]
) -> tuple[VehicleFamily | None, VehicleYearVersion | None]:
    """Família/versão depois do payload: chave ausente mantém o atual, só null explícito limpa.

    Veio só a família e a versão atual é de outra família → a versão cai.
    """
    family = data.get("catalog_family", order.catalog_family if order else None)
    version = data.get("catalog_version", order.catalog_version if order else None)
    if (
        "catalog_version" not in data
        and family is not None
        and version is not None
        and version.modelo.familia_id != family.id
    ):
        version = None
    return family, version


def validate_catalog_vehicle(
    family: VehicleFamily | None,
    version: VehicleYearVersion | None,
    year_manufacture: int | None,
) -> None:
    """Versão precisa ser da família; ano de fabricação = ano-modelo ou o anterior."""
    if family is not None and version is not None and version.modelo.familia_id != family.id:
        raise ValidationError({"catalog_version": "Versão não pertence ao modelo."})
    if version is not None and year_manufacture is not None:
        ano = timezone.localdate().year if version.zero_km else version.ano
        if year_manufacture not in (ano, ano - 1):
            raise ValidationError(
                {"year_manufacture": f"Ano de fabricação deve ser {ano} ou {ano - 1}."}
            )
