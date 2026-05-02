# backend/core/apps/inventory/tests/test_location_models.py
"""Testes unitários para models de localização — sem banco."""
import uuid
from unittest.mock import MagicMock, PropertyMock

import pytest
from django.db.models.base import ModelState

from apps.inventory.models_location import Armazem, Nivel, Prateleira, Rua


def _make_nivel(armazem_code: str, rua_code: str, prat_code: str, nivel_code: str) -> Nivel:
    """Build Nivel with mocked FK chain — bypasses DB by setting _state + cache fields."""
    armazem = MagicMock(spec=Armazem)
    armazem.codigo = armazem_code

    rua = MagicMock(spec=Rua)
    rua.codigo = rua_code
    rua.armazem = armazem
    rua.__str__ = lambda self: f"{self.armazem.codigo}-{self.codigo}"

    prateleira = MagicMock(spec=Prateleira)
    prateleira.codigo = prat_code
    prateleira.rua = rua
    prat_id = uuid.uuid4()
    prateleira.pk = prat_id

    nivel = Nivel.__new__(Nivel)
    nivel._state = ModelState()
    nivel.id = uuid.uuid4()
    nivel.codigo = nivel_code
    nivel.prateleira_id = prat_id
    # Set the FK cache so Django doesn't hit the DB
    Nivel.prateleira.field.set_cached_value(nivel, prateleira)

    return nivel


def _make_rua(armazem_code: str, rua_code: str) -> Rua:
    """Build Rua with mocked Armazem FK."""
    armazem = MagicMock(spec=Armazem)
    armazem.codigo = armazem_code
    armazem_id = uuid.uuid4()
    armazem.pk = armazem_id

    rua = Rua.__new__(Rua)
    rua._state = ModelState()
    rua.id = uuid.uuid4()
    rua.codigo = rua_code
    rua.armazem_id = armazem_id
    Rua.armazem.field.set_cached_value(rua, armazem)

    return rua


class TestNivelEnderecoCompleto:
    """WMS-4: endereco_completo é computed, nunca stored."""

    def test_endereco_completo_format(self) -> None:
        nivel = _make_nivel("G1", "R03", "P02", "N4")
        assert nivel.endereco_completo == "G1-R03-P02-N4"

    def test_endereco_completo_patio(self) -> None:
        nivel = _make_nivel("PT1", "A01", "Z01", "N1")
        assert nivel.endereco_completo == "PT1-A01-Z01-N1"

    def test_str_uses_endereco_completo(self) -> None:
        nivel = _make_nivel("G2", "R01", "P01", "N1")
        assert str(nivel) == "G2-R01-P01-N1"


class TestArmazemStr:
    def test_str_format(self) -> None:
        armazem = Armazem(id=uuid.uuid4(), codigo="G1", nome="Galpão Principal")
        assert str(armazem) == "G1 — Galpão Principal"


class TestRuaStr:
    def test_str_format(self) -> None:
        rua = _make_rua("G1", "R01")
        assert str(rua) == "G1-R01"
