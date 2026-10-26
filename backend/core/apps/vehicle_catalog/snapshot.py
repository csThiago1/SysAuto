"""
Caminho no catálogo (para o seletor) e snapshot de texto (para OS/orçamento) de um veículo.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from django.utils import timezone

from apps.vehicle_catalog.models import VehicleFamily, VehicleMake, VehicleYearVersion


def resolve_family(
    family: VehicleFamily | None, version: VehicleYearVersion | None
) -> VehicleFamily | None:
    """Com versão, a família é sempre a da versão; sem versão, a informada."""
    return version.modelo.familia if version is not None else family


def catalog_path(
    *,
    make: VehicleMake | None = None,
    family: VehicleFamily | None = None,
    version: VehicleYearVersion | None = None,
) -> dict[str, Any] | None:
    """Tipo → montadora → família → versão FIPE → ano, derivado de baixo para cima.

    Mostra a linha mesmo inativa: uma OS antiga continua abrindo com o caminho que gravou.
    """
    model = version.modelo if version is not None else None
    if model is not None:
        family = model.familia
        make = model.marca
    elif family is not None:
        make = family.make
    if make is None:
        return None
    return {
        "tipo": make.tipo,
        "make": {"id": make.id, "label": make.display_name, "logo_url": make.logo_url},
        "family": {"id": family.id, "label": family.nome} if family else None,
        "model": {"id": model.id, "label": model.nome} if model else None,
        "version": {"id": version.id, "label": version.label} if version else None,
    }


@dataclass(frozen=True)
class VehicleSnapshot:
    make: str
    make_logo: str
    model: str
    version: str
    year: int | None
    zero_km: bool
    fuel_type: str
    fipe_value: Decimal | None

    @property
    def description(self) -> str:
        return " ".join(part for part in (self.make, self.model, self.version) if part)


def build_snapshot(
    family: VehicleFamily | None, version: VehicleYearVersion | None
) -> VehicleSnapshot:
    """Texto do veículo gravado na OS/orçamento: model = família, version = nome FIPE."""
    family = resolve_family(family, version)
    make = version.modelo.marca if version is not None else (family.make if family else None)
    if version is None:
        year, zero_km, fuel_type, fipe_value = None, False, "", None
    else:
        year = timezone.localdate().year if version.zero_km else version.ano
        zero_km = version.zero_km
        fuel_type = version.get_combustivel_display()
        fipe_value = version.valor_referencia
    return VehicleSnapshot(
        make=make.display_name if make else "",
        make_logo=make.logo_url if make else "",
        model=family.nome if family else "",
        version=version.modelo.nome if version is not None else "",
        year=year,
        zero_km=zero_km,
        fuel_type=fuel_type,
        fipe_value=fipe_value,
    )
