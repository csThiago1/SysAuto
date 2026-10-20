from decimal import Decimal

from apps.vehicle_catalog.models import VehicleFamily, VehicleMake, VehicleModel, VehicleYearVersion
from apps.vehicle_catalog.normalize import make_display_name, normalize_name


def make_catalog(
    *,
    fipe_make: str = "GM - Chevrolet",
    tipo: str = "carro",
    family: str = "Onix Plus",
    model: str = "ONIX SED. Plus PREM. 1.0 12V TB Flex Aut",
    codigo: str = "004504-7",
    ano: int = 2025,
    combustivel: str = "flex",
    valor: Decimal = Decimal("98765.00"),
    zero_km: bool = False,
) -> VehicleYearVersion:
    """Marca → família → versão FIPE → ano-versão, idempotente (get_or_create)."""
    make, _ = VehicleMake.objects.get_or_create(
        tipo=tipo,
        nome_normalizado=normalize_name(fipe_make),
        defaults={"nome": fipe_make, "display_name": make_display_name(fipe_make)},
    )
    familia, _ = VehicleFamily.objects.get_or_create(
        make=make, nome_normalizado=normalize_name(family), defaults={"nome": family}
    )
    modelo, _ = VehicleModel.objects.get_or_create(
        tipo=tipo,
        codigo_fipe=codigo,
        defaults={
            "marca": make,
            "familia": familia,
            "nome": model,
            "nome_normalizado": normalize_name(model),
        },
    )
    version, _ = VehicleYearVersion.objects.get_or_create(
        modelo=modelo,
        ano=ano,
        combustivel=combustivel,
        defaults={
            "descricao": model,
            "codigo_fipe": codigo,
            "valor_referencia": valor,
            "zero_km": zero_km,
        },
    )
    return version
