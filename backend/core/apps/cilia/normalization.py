"""
Normalização de um ParsedBudget (Cilia, XML, HDI) contra as listas: veículo, cor e seguradora.

Os parsers entregam o texto como veio da fonte; daqui saem só valores das listas.
"""

from apps.cilia.dtos import ParsedBudget
from apps.insurers.matching import match_insurer
from apps.insurers.models import Insurer
from apps.lookups.validators import clean_cnpj, is_valid_cnpj
from apps.vehicle_catalog.matching import match_vehicle
from apps.vehicle_catalog.models import VehicleFamily, VehicleYearVersion
from apps.vehicle_catalog.normalize import TipoVeiculo, match_color

# type_key do Cilia → tipo do catálogo; van e outros ficam sem pista
TYPE_KEY_TO_TIPO: dict[str, str] = {
    "car": TipoVeiculo.CARRO,
    "truck": TipoVeiculo.CAMINHAO,
    "motorcycle": TipoVeiculo.MOTO,
}


class UnknownInsurerError(Exception):
    """Importação que cria OS parou: a seguradora do arquivo não casou com nenhuma."""

    def __init__(self, trade: str, cnpj: str) -> None:
        super().__init__(f"Seguradora não reconhecida: '{trade}'")
        self.trade = trade
        self.cnpj = cnpj


def vehicle_source_text(parsed: ParsedBudget) -> str:
    """Texto do veículo como veio da fonte; é também a chave da regra aprendida."""
    text = parsed.vehicle_model or parsed.vehicle_description
    return f"{parsed.vehicle_brand} {text}".strip()[:300]


def normalize_parsed_budget(parsed: ParsedBudget) -> None:
    """Casa veículo, cor e seguradora e grava os resultados no próprio DTO (idempotente)."""
    if parsed.normalized:
        return
    match = match_vehicle(
        parsed.vehicle_brand,
        parsed.vehicle_model or parsed.vehicle_description,
        parsed.vehicle_year,
        vin=parsed.vehicle_chassis or None,
        tipo=TYPE_KEY_TO_TIPO.get(parsed.vehicle_tipo_hint),
        source=parsed.source,
    )
    parsed.catalog_family_id = match.family.pk if match.family else None
    parsed.catalog_version_id = match.version.pk if match.version else None
    parsed.vehicle_review = match.review
    parsed.color = match_color(parsed.vehicle_color) or ""
    parsed.insurer_cnpj = clean_cnpj(parsed.insurer_cnpj)
    insurer = match_insurer(
        cnpj=parsed.insurer_cnpj, name=parsed.insurer_trade, code=parsed.insurer_code
    )
    if insurer is not None:
        parsed.insurer_id = insurer.pk
        parsed.insurer_code = insurer.code or ""  # o código a jusante ainda lê insurer_code
    parsed.normalized = True


def matched_vehicle(
    parsed: ParsedBudget,
) -> tuple[VehicleFamily | None, VehicleYearVersion | None]:
    """Família e versão casadas por normalize_parsed_budget."""
    version = (
        VehicleYearVersion.objects.select_related("modelo__marca", "modelo__familia")
        .filter(pk=parsed.catalog_version_id)
        .first()
        if parsed.catalog_version_id
        else None
    )
    family = (
        VehicleFamily.objects.select_related("make").filter(pk=parsed.catalog_family_id).first()
        if parsed.catalog_family_id
        else None
    )
    return family, version


def matched_insurer(parsed: ParsedBudget) -> Insurer | None:
    return Insurer.objects.filter(pk=parsed.insurer_id).first() if parsed.insurer_id else None


def note_cnpj(insurer: Insurer, cnpj: str) -> str:
    """CNPJ da nota: o do arquivo quando válido; filial nova entra em insurer.cnpjs."""
    cnpj = clean_cnpj(cnpj)
    if not is_valid_cnpj(cnpj):
        return ""  # vazio: o fiscal cai no Insurer.cnpj
    if cnpj not in insurer.cnpjs:
        insurer.cnpjs = [*insurer.cnpjs, cnpj]
        insurer.save(update_fields=["cnpjs"])
    return cnpj


def color_warning(parsed: ParsedBudget) -> str | None:
    """Texto original da cor que não casou, guardado como aviso na OS."""
    if parsed.vehicle_color and not parsed.color:
        return f"Cor do arquivo não reconhecida: '{parsed.vehicle_color}'"
    return None
