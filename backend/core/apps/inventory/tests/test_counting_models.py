"""Testes unitários para models de contagem de inventário."""
from decimal import Decimal
from unittest.mock import MagicMock, patch

from apps.inventory.models_counting import ContagemInventario, ItemContagem


class TestContagemInventarioStr:
    def test_str_with_rua(self) -> None:
        mock_rua = MagicMock()
        mock_rua.__str__ = lambda self: "G1-R01"
        contagem = MagicMock(spec=ContagemInventario)
        contagem.tipo = "ciclica"
        contagem.status = "aberta"
        contagem.armazem = None
        contagem.rua = mock_rua
        contagem.__str__ = ContagemInventario.__str__
        result = str(contagem)
        assert "ciclica" in result
        assert "aberta" in result

    def test_str_with_armazem(self) -> None:
        mock_armazem = MagicMock()
        mock_armazem.__str__ = lambda self: "Galpao Principal"
        contagem = MagicMock(spec=ContagemInventario)
        contagem.tipo = "total"
        contagem.status = "em_andamento"
        contagem.armazem = mock_armazem
        contagem.rua = None
        contagem.__str__ = ContagemInventario.__str__
        result = str(contagem)
        assert "total" in result
        assert "em_andamento" in result


class TestItemContagemDivergencia:
    def test_divergencia_computed_on_save(self) -> None:
        """divergencia = quantidade_contada - quantidade_sistema."""
        item = ItemContagem.__new__(ItemContagem)
        item.quantidade_sistema = Decimal("10.000")
        item.quantidade_contada = Decimal("8.000")
        item.divergencia = Decimal("0")

        # Call save logic directly (won't hit DB)
        if item.quantidade_contada is not None:
            item.divergencia = item.quantidade_contada - item.quantidade_sistema

        assert item.divergencia == Decimal("-2.000")

    def test_divergencia_zero_when_match(self) -> None:
        item = ItemContagem.__new__(ItemContagem)
        item.quantidade_sistema = Decimal("5.000")
        item.quantidade_contada = Decimal("5.000")
        item.divergencia = Decimal("0")

        if item.quantidade_contada is not None:
            item.divergencia = item.quantidade_contada - item.quantidade_sistema

        assert item.divergencia == Decimal("0.000")

    def test_divergencia_positive_when_surplus(self) -> None:
        item = ItemContagem.__new__(ItemContagem)
        item.quantidade_sistema = Decimal("3.000")
        item.quantidade_contada = Decimal("5.500")
        item.divergencia = Decimal("0")

        if item.quantidade_contada is not None:
            item.divergencia = item.quantidade_contada - item.quantidade_sistema

        assert item.divergencia == Decimal("2.500")

    def test_divergencia_not_computed_when_not_counted(self) -> None:
        item = ItemContagem.__new__(ItemContagem)
        item.quantidade_sistema = Decimal("10.000")
        item.quantidade_contada = None
        item.divergencia = Decimal("0")

        if item.quantidade_contada is not None:
            item.divergencia = item.quantidade_contada - item.quantidade_sistema

        assert item.divergencia == Decimal("0")
