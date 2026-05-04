"""Testes unitarios para models de compras — sem banco."""
import uuid

from apps.purchasing.models import ItemOrdemCompra, OrdemCompra, PedidoCompra


class TestPedidoCompraStr:
    def test_str_format(self) -> None:
        pc = PedidoCompra.__new__(PedidoCompra)
        pc.pk = uuid.uuid4()
        pc.descricao = "Farol Esquerdo Gol G5"
        pc.status = "solicitado"
        result = str(pc)
        assert "Farol Esquerdo" in result
        assert "solicitado" in result


class TestOrdemCompraStr:
    def test_str_format(self) -> None:
        oc = OrdemCompra.__new__(OrdemCompra)
        oc.numero = "OC-2026-0001"
        oc.status = "rascunho"
        oc.valor_total = 1200
        result = str(oc)
        assert "OC-2026-0001" in result
        assert "rascunho" in result


class TestItemOCStr:
    def test_str_format(self) -> None:
        item = ItemOrdemCompra.__new__(ItemOrdemCompra)
        item.descricao = "Parabrisa Dianteiro"
        item.fornecedor_nome = "Autoglass"
        item.valor_total = 780
        result = str(item)
        assert "Parabrisa" in result
        assert "Autoglass" in result
