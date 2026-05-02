"""Testes unitários para models de produto comercial."""
import uuid

from apps.inventory.models_product import (
    CategoriaInsumo,
    CategoriaProduto,
    ProdutoComercialInsumo,
    ProdutoComercialPeca,
    TipoPeca,
)


class TestTipoPecaStr:
    def test_str(self) -> None:
        tipo = TipoPeca(id=uuid.uuid4(), nome="Para-choque", codigo="PCHQ")
        assert str(tipo) == "Para-choque"


class TestCategoriaProdutoStr:
    def test_str_with_margem(self) -> None:
        cat = CategoriaProduto(
            id=uuid.uuid4(), nome="Funilaria", codigo="FUN", margem_padrao_pct=35,
        )
        assert "35" in str(cat)
        assert "FUN" in str(cat)


class TestProdutoComercialPecaStr:
    def test_str(self) -> None:
        prod = ProdutoComercialPeca(
            id=uuid.uuid4(), sku_interno="PC-001", nome_interno="Para-choque Gol G5",
        )
        assert str(prod) == "[PC-001] Para-choque Gol G5"


class TestProdutoComercialInsumoStr:
    def test_str(self) -> None:
        prod = ProdutoComercialInsumo(
            id=uuid.uuid4(), sku_interno="VN-001", nome_interno="Verniz PU",
        )
        assert str(prod) == "[VN-001] Verniz PU"
