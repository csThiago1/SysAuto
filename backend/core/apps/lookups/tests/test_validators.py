import pytest

from apps.lookups.validators import (
    clean_cnpj,
    decode_vin,
    is_valid_cnpj,
    is_valid_cpf,
    is_valid_plate,
    is_valid_renavam,
    is_valid_vin,
    normalize_plate,
    only_digits,
)


@pytest.mark.parametrize(
    "v,ok",
    [
        ("52998224725", True),
        ("529.982.247-25", True),
        ("52998224724", False),
        ("11111111111", False),
        ("", False),
    ],
)
def test_cpf(v: str, ok: bool) -> None:
    assert is_valid_cpf(v) is ok


@pytest.mark.parametrize(
    "v,ok",
    [
        ("11222333000181", True),
        ("11.222.333/0001-81", True),
        ("12ABC34501DE35", True),
        ("12.ABC.345/01DE-35", True),
        ("12ABC34501DE36", False),
        ("33055146000193", True),
        ("61198164001142", False),
        ("00000000000000", False),
    ],
)
def test_cnpj(v: str, ok: bool) -> None:
    assert is_valid_cnpj(v) is ok


@pytest.mark.parametrize(
    "v,ok",
    [
        ("ABC1234", True),
        ("ABC1D23", True),
        ("abc-1d23", True),
        ("PHO0000", True),
        ("AB1234", False),
        ("ABCD123", False),
    ],
)
def test_plate(v: str, ok: bool) -> None:
    assert is_valid_plate(v) is ok


def test_normalizadores() -> None:
    assert only_digits("529.982.247-25") == "52998224725"
    assert clean_cnpj("12.abc.345/01de-35") == "12ABC34501DE35"
    assert normalize_plate("abc-1d23") == "ABC1D23"


def test_renavam() -> None:
    assert is_valid_renavam("12345678900") and not is_valid_renavam("12345678901")


def test_vin() -> None:
    assert is_valid_vin("8AC907655SE254082") and not is_valid_vin("8AC907655SE25408I")
    info = decode_vin("8AC907655SE254082")
    assert info.make_hint == "MERCEDES-BENZ" and info.model_year == 2025


def test_vin_wmi_desconhecido() -> None:
    info = decode_vin("ZZZ907655SE254082")
    assert info.wmi == "ZZZ" and info.make_hint is None
