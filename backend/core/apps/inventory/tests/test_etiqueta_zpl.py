"""
Paddock Solutions — Inventory Tests: ZPLService
Motor de Orçamentos (MO) — Sprint MO-5

Testa geração de ZPL sem necessidade de impressora real.
Não requer Docker.
"""
from decimal import Decimal
from unittest.mock import MagicMock

from django.test import SimpleTestCase

from apps.inventory.services.etiqueta import ZPLService


class TestZPLServicePeca(SimpleTestCase):

    def _make_unidade(self, codigo_barras: str = "P1234567890abcdef1234567890abcdef1") -> MagicMock:
        u = MagicMock()
        u.codigo_barras = codigo_barras
        u.valor_nf = Decimal("350.00")
        u.nfe_entrada_id = "uuid-1"
        u.nfe_entrada.numero = "001234"
        u.peca_canonica.nome = "Para-choque dianteiro VW Gol"
        return u

    def test_zpl_peca_contem_codigo_barras(self) -> None:
        u = self._make_unidade()
        zpl = ZPLService.gerar_zpl_peca(u)
        self.assertIn(u.codigo_barras, zpl)

    def test_zpl_peca_contem_valor_nf(self) -> None:
        u = self._make_unidade()
        zpl = ZPLService.gerar_zpl_peca(u)
        self.assertIn("350.00", zpl)

    def test_zpl_peca_contem_numero_nfe(self) -> None:
        u = self._make_unidade()
        zpl = ZPLService.gerar_zpl_peca(u)
        self.assertIn("001234", zpl)

    def test_zpl_peca_sem_nfe_usa_traco(self) -> None:
        u = self._make_unidade()
        u.nfe_entrada_id = None
        zpl = ZPLService.gerar_zpl_peca(u)
        self.assertIn("—", zpl)

    def test_zpl_peca_trunca_nome_40_chars(self) -> None:
        u = self._make_unidade()
        u.peca_canonica.nome = "A" * 60  # nome longo
        zpl = ZPLService.gerar_zpl_peca(u)
        # Nome truncado em 40 chars
        self.assertIn("A" * 40, zpl)
        self.assertNotIn("A" * 41, zpl)


class TestZPLServiceLote(SimpleTestCase):

    def _make_lote(self) -> MagicMock:
        import datetime
        l = MagicMock()
        l.codigo_barras = "Lab12345678901234567890123456789012"
        l.quantidade_compra = Decimal("5.000")
        l.unidade_compra = "GL"
        l.validade = datetime.date(2027, 6, 30)
        l.material_canonico.nome = "Tinta automotiva branca"
        return l

    def test_zpl_lote_contem_codigo_barras(self) -> None:
        l = self._make_lote()
        zpl = ZPLService.gerar_zpl_lote(l)
        self.assertIn(l.codigo_barras, zpl)

    def test_zpl_lote_contem_validade_formatada(self) -> None:
        l = self._make_lote()
        zpl = ZPLService.gerar_zpl_lote(l)
        self.assertIn("30/06/2027", zpl)

    def test_zpl_lote_sem_validade_usa_traco(self) -> None:
        l = self._make_lote()
        l.validade = None
        zpl = ZPLService.gerar_zpl_lote(l)
        self.assertIn("—", zpl)
