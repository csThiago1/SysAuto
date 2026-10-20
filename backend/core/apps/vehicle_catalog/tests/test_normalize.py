import pytest

from apps.vehicle_catalog.normalize import (
    canonical_brand,
    make_display_name,
    match_color,
    match_fuel,
    normalize_name,
)


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("-PRETA", "PRETA"),
        ("Preto", "PRETA"),
        ("PRTA", "PRETA"),
        ("PRETRA", "PRETA"),
        ("PRATA METÁLICO", "PRATA"),
        ("BRANCO PÉROLA", "BRANCA"),
        ("Branco", "BRANCA"),
        ("GRAFITE", "CINZA"),
        ("CHUMBO", "CINZA"),
        ("VINHO", "GRENA"),
        ("BORDÔ", "GRENA"),
        ("CHAMPAGNE", "BEGE"),
        ("vermelho sólido", "VERMELHA"),
        ("XX", None),
        ("G7 1.0 FLEX 4P 1.0 12V FLEX", None),
        ("", None),
    ],
)
def test_match_color(raw: str, expected: str | None) -> None:
    assert match_color(raw) == expected


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Gasolina/Alcool", "flex"),
        ("FLEXONE", "flex"),
        ("TOTAL FLEX", "flex"),
        ("G", "gasolina"),
        ("D", "diesel"),
        ("Die.", "diesel"),
        ("ÁLCOOL", "etanol"),
        ("GNV", "gnv"),
        ("xyz", None),
        ("CLASSE E 250", None),
    ],
)
def test_match_fuel(raw: str, expected: str | None) -> None:
    assert match_fuel(raw) == expected


def test_normalize_name() -> None:
    assert normalize_name("  Citroën  C4  ") == "CITROEN C4"


@pytest.mark.parametrize(
    "fipe,display",
    [
        ("GM - Chevrolet", "Chevrolet"),
        ("VW - VolksWagen", "Volkswagen"),
        ("Kia Motors", "Kia"),
        ("Caoa Chery/Chery", "Chery"),
        ("MERCEDES-BENZ", "Mercedes-Benz"),
        ("HONDA", "Honda"),
        ("BMW", "BMW"),
        ("Land Rover", "Land Rover"),
        ("MV AGUSTA", "MV Agusta"),
        ("DFSK", "DFSK"),
    ],
)
def test_make_display_name(fipe: str, display: str) -> None:
    assert make_display_name(fipe) == display


@pytest.mark.parametrize(
    "raw,canon",
    [
        ("VW", "VOLKSWAGEN"),
        ("GM", "CHEVROLET"),
        ("M.BENZ", "MERCEDES-BENZ"),
        ("MERCEDES", "MERCEDES-BENZ"),
        ("Chevrolet", "CHEVROLET"),
    ],
)
def test_canonical_brand(raw: str, canon: str) -> None:
    assert canonical_brand(raw) == canon
