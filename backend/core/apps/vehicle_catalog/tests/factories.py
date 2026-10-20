import tempfile
from decimal import Decimal
from pathlib import Path

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


SAMPLE = Path(__file__).parent / "fixtures" / "fipex_2026_10_sample.tsv"


def sample_without(codigo: str) -> Path:
    """Cópia temporária da fixture fipeX sem as linhas do código FIPE dado."""
    lines = SAMPLE.read_text(encoding="utf-8").splitlines(keepends=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", suffix=".tsv", delete=False
    ) as tmp:  # ponytail: arquivo fica no /tmp do container, o SO limpa
        tmp.writelines(line for line in lines if line.split("\t")[1] != codigo)
    return Path(tmp.name)
