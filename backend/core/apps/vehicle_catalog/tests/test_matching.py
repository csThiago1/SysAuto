import pytest

from apps.vehicle_catalog.fipe_sync import load_fipex
from apps.vehicle_catalog.matching import match_vehicle, record_alias_confirmation
from apps.vehicle_catalog.models import VehicleAlias, VehicleFamily, VehicleYearVersion
from apps.vehicle_catalog.tests.factories import SAMPLE

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _catalogo(db: None) -> None:
    load_fipex(SAMPLE, ref="2026-10")


CASES = [  # (brand, text, year, fipe esperado ou None, família esperada, confiança)
    (
        "",
        "CHEVROLET NOVA MONTANA CAB DUPLA RS 1.2 12V TURBO FLEX AUT 4p Gasolina/Alcool",
        2025,
        "004546-2",
        "Montana",
        "alta",
    ),
    (
        "",
        "HONDA NOVO FIT EXL-AT 1.5 I-VTEC FLEXONE 5p Gasolina/Alcool",
        2021,
        "014056-2",
        "Fit",
        "alta",
    ),
    ("VOLKSWAGEN", "GOL 1.0MI TOTAL FLEX 8V 4P", 2013, None, "Gol", "baixa"),
    ("HYUNDAI", "HB20X PREMIUM 1.6 FLEX 16V AUT", 2018, "015097-5", "HB20X", "alta"),
    ("VOLKSWAGEN", "VIRTUS 1.6 MSI Flex 16V 5p Mec.", 2018, "005486-0", "Virtus", "alta"),
    (
        "NISSAN",
        "KICKS (2017 A 2021) S DIRECT AUT 1.6 16V FLEX 2019",
        2019,
        "023158-4",
        "Kicks",
        "alta",
    ),
    (
        "CHEVROLET",
        "ONIX PLUS (2020 A 2025) PREMIER 1.0 12V TURBO FLEX 2025",
        2025,
        "004504-7",
        "Onix Plus",
        "alta",
    ),
    (
        "MERCEDES-BENZ",
        "SPRINTER VANS (2023 A 2026) 517 CDI - EXTRA LONGO TETO ALTO 18L OM-654 CDI 2025",
        2025,
        None,
        "Sprinter",
        "baixa",
    ),
]


@pytest.mark.parametrize("brand,text,year,fipe,fam,conf", CASES)
def test_fixtures_reais(
    brand: str, text: str, year: int, fipe: str | None, fam: str, conf: str
) -> None:
    m = match_vehicle(brand, text, year)
    assert (m.family.nome, m.confidence) == (fam, conf)
    assert (m.version.modelo.codigo_fipe if m.version else None) == fipe
    assert m.review is (fipe is None)


def test_baixa_traz_candidatos_da_familia() -> None:
    m = match_vehicle("VOLKSWAGEN", "GOL 1.0MI TOTAL FLEX 8V 4P", 2013)
    assert 0 < len(m.candidates) <= 5
    assert all(c.familia_id == m.family.pk for c in m.candidates)
    assert m.model is None


def test_codigo_fipe_e_exato() -> None:
    m = match_vehicle("Honda", "POP 110I", 2020, codigo_fipe="811132-4")
    assert m.confidence == "exata" and m.version.ano == 2020 and m.make.tipo == "moto"
    assert not m.review


def test_codigo_fipe_sem_ano_usa_ano_do_chassi() -> None:
    m = match_vehicle("Honda", "POP 110I", None, codigo_fipe="811132-4", vin="9C2KC0000LR000000")
    assert m.confidence == "exata" and m.version.ano == 2020


def test_marca_de_duas_palavras_no_texto() -> None:
    m = match_vehicle("LAND", "ROVER RANGE ROVER EVOQUE AUTOBIOGRAPHY 2.0 AUT", 2018)
    assert m.make.nome == "Land Rover"
    assert m.family.nome == "Range Rover Evoque"


def test_nada_casa() -> None:
    assert match_vehicle("", "XX", 2020).confidence == "nenhuma"


def test_alias_primeira_confirmacao_preenche_com_selo() -> None:
    v = VehicleYearVersion.objects.get(modelo__codigo_fipe="005275-2", ano=2013)
    record_alias_confirmation(
        "hdi", "VOLKSWAGEN GOL 1.0MI TOTAL FLEX 8V 4P", 2013, version=v, family=None
    )
    m = match_vehicle("VOLKSWAGEN", "GOL 1.0MI TOTAL FLEX 8V 4P", 2013, source="hdi")
    assert m.version == v and m.confidence == "alta" and m.review is True


def test_alias_duas_confirmacoes_vira_exata() -> None:
    v = VehicleYearVersion.objects.get(modelo__codigo_fipe="005275-2", ano=2013)
    for _ in range(2):
        alias = record_alias_confirmation(
            "hdi", "VOLKSWAGEN GOL 1.0MI TOTAL FLEX 8V 4P", 2013, version=v, family=None
        )
    assert alias.confirmacoes == 2 and alias.is_exact
    m = match_vehicle("VOLKSWAGEN", "GOL 1.0MI TOTAL FLEX 8V 4P", 2013, source="hdi")
    assert m.version == v and m.confidence == "exata" and m.review is False
    assert m.model == v.modelo and m.family == v.modelo.familia


def test_alias_aprovado_vira_exata_com_uma_confirmacao() -> None:
    v = VehicleYearVersion.objects.get(modelo__codigo_fipe="005275-2", ano=2013)
    alias = record_alias_confirmation(
        "hdi", "VOLKSWAGEN GOL 1.0MI TOTAL FLEX 8V 4P", 2013, version=v, family=None
    )
    VehicleAlias.objects.filter(pk=alias.pk).update(aprovado=True)
    m = match_vehicle("VOLKSWAGEN", "GOL 1.0MI TOTAL FLEX 8V 4P", 2013, source="hdi")
    assert m.confidence == "exata" and m.review is False


def test_alias_alvo_diferente_reinicia() -> None:
    v = VehicleYearVersion.objects.get(modelo__codigo_fipe="005275-2", ano=2013)
    outra = VehicleYearVersion.objects.filter(modelo__familia=v.modelo.familia, ano=2013).exclude(
        pk=v.pk
    )[0]
    texto = "VOLKSWAGEN GOL 1.0MI TOTAL FLEX 8V 4P"
    for _ in range(2):
        record_alias_confirmation("hdi", texto, 2013, version=v, family=None)
    VehicleAlias.objects.update(aprovado=True)
    alias = record_alias_confirmation("hdi", texto, 2013, version=outra, family=None)
    alias.refresh_from_db()
    assert (alias.version, alias.confirmacoes, alias.aprovado) == (outra, 1, False)
    assert VehicleAlias.objects.count() == 1


def test_alias_de_familia_preenche_familia_sem_versao() -> None:
    fam = VehicleFamily.objects.get(nome="Gol")
    texto = "VOLKSWAGEN GOL 1.0MI TOTAL FLEX 8V 4P"
    for _ in range(2):
        record_alias_confirmation("hdi", texto, 2013, version=None, family=fam)
    m = match_vehicle("VOLKSWAGEN", "GOL 1.0MI TOTAL FLEX 8V 4P", 2013, source="hdi")
    assert (m.family, m.version, m.confidence) == (fam, None, "exata")
    assert m.review is True  # sem versão a OS continua com selo


def test_alias_de_outra_fonte_nao_vale() -> None:
    v = VehicleYearVersion.objects.get(modelo__codigo_fipe="005275-2", ano=2013)
    for _ in range(2):
        record_alias_confirmation(
            "hdi", "VOLKSWAGEN GOL 1.0MI TOTAL FLEX 8V 4P", 2013, version=v, family=None
        )
    m = match_vehicle("VOLKSWAGEN", "GOL 1.0MI TOTAL FLEX 8V 4P", 2013, source="cilia")
    assert m.version is None and m.confidence == "baixa"
