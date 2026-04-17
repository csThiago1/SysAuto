"""
Paddock Solutions — Pricing Catalog Tests: Normalização de Texto
Motor de Orçamentos (MO) — Sprint 02: Catálogo Técnico

Testa 30 pares de entrada/esperado para normalizar_texto.
Não requer banco de dados — apenas lógica de string.
"""
import logging
from unittest import TestCase

from apps.pricing_catalog.utils.text import normalizar_texto

logger = logging.getLogger(__name__)


class TestNormalizarTexto(TestCase):
    """Testa 30 pares de entrada/esperado para normalizar_texto."""

    def _assert_norm(self, entrada: str, esperado: str) -> None:
        """Helper: normaliza e compara com o esperado."""
        resultado = normalizar_texto(entrada)
        self.assertEqual(resultado, esperado, msg=f"Input: {entrada!r}")

    # ── Acentos e case ────────────────────────────────────────────────────────

    def test_01_uppercase_to_lowercase(self) -> None:
        """Texto em maiúsculas deve ser convertido para minúsculas."""
        self._assert_norm("PINTURA PORTA", "pintura porta")

    def test_02_acento_cedilha(self) -> None:
        """Cedilha deve ser removida."""
        self._assert_norm("substituição de peça", "substituicao de peca")

    def test_03_acento_tinta_metalica(self) -> None:
        """Tinta Azul Metálica → tinta azul metalica."""
        self._assert_norm("Tinta Azul Metálica", "tinta azul metalica")

    def test_04_acento_instalacao(self) -> None:
        """Instalação deve perder o acento."""
        self._assert_norm("Instalação de Parachoque", "instalacao de parachoque")

    def test_05_acento_revisao(self) -> None:
        """Revisão deve perder o acento."""
        self._assert_norm("Revisão de freios", "revisao de freios")

    # ── Abreviações básicas ───────────────────────────────────────────────────

    def test_06_subst_expande(self) -> None:
        """'subst' deve expandir para 'substituicao'."""
        resultado = normalizar_texto("SUBST PORTA ESQ")
        self.assertIn("substituicao", resultado)

    def test_07_diant_expande(self) -> None:
        """'diant' deve expandir para 'dianteiro'."""
        resultado = normalizar_texto("para-choque diant")
        self.assertIn("dianteiro", resultado)

    def test_08_dto_expande(self) -> None:
        """'dto' deve expandir para 'direito'."""
        resultado = normalizar_texto("porta dto")
        self.assertIn("direito", resultado)

    def test_09_esq_expande(self) -> None:
        """'esq' deve expandir para 'esquerdo'."""
        resultado = normalizar_texto("porta esq")
        self.assertIn("esquerdo", resultado)

    def test_10_rem_expande(self) -> None:
        """'rem' deve expandir para 'remocao'."""
        resultado = normalizar_texto("rem paralama")
        self.assertIn("remocao", resultado)

    def test_11_inst_expande(self) -> None:
        """'inst' deve expandir para 'instalacao'."""
        resultado = normalizar_texto("inst para-lama")
        self.assertIn("instalacao", resultado)

    def test_12_pint_expande(self) -> None:
        """'pint' isolado deve expandir para 'pintura'."""
        resultado = normalizar_texto("pint porta")
        self.assertIn("pintura", resultado)

    def test_13_lat_expande(self) -> None:
        """'lat' deve expandir para 'lateral'."""
        resultado = normalizar_texto("painel lat")
        self.assertIn("lateral", resultado)

    def test_14_cap_expande(self) -> None:
        """'cap' deve expandir para 'capo'."""
        resultado = normalizar_texto("pintura cap")
        self.assertIn("capo", resultado)

    def test_15_frt_expande(self) -> None:
        """'frt' deve expandir para 'frontal'."""
        resultado = normalizar_texto("parachoque frt")
        self.assertIn("frontal", resultado)

    # ── Para-choque e para-lama ───────────────────────────────────────────────

    def test_16_p_choque_expande(self) -> None:
        """'p/choque' deve expandir para 'para-choque'."""
        resultado = normalizar_texto("subst p/choque diant dto")
        self.assertIn("para-choque", resultado)

    def test_17_para_choque_mantido(self) -> None:
        """'para-choque' já completo deve ser mantido."""
        resultado = normalizar_texto("para-choque dianteiro")
        self.assertIn("para-choque", resultado)
        self.assertIn("dianteiro", resultado)

    def test_18_paralama_de_para_lama(self) -> None:
        """'para-lama' deve ser expandido para 'paralama'."""
        resultado = normalizar_texto("instalação de para-lama")
        self.assertIn("paralama", resultado)
        self.assertIn("instalacao", resultado)

    def test_19_para_lamas_plural(self) -> None:
        """'para lamas' (plural, com espaço) deve virar 'paralama'."""
        resultado = normalizar_texto("troca para lamas")
        self.assertIn("paralama", resultado)

    # ── Espaços e pontuação ───────────────────────────────────────────────────

    def test_20_espacos_multiplos_colapsam(self) -> None:
        """Múltiplos espaços devem colapsar para um único."""
        resultado = normalizar_texto("LIXA  P320  D'AGUA")
        # Não deve ter espaços duplos
        self.assertNotIn("  ", resultado)

    def test_21_apostrofe_removida(self) -> None:
        """Apóstrofo deve ser removido (pontuação exceto hífen e barra)."""
        resultado = normalizar_texto("D'AGUA")
        self.assertNotIn("'", resultado)

    def test_22_strip_final(self) -> None:
        """Espaços no início e fim devem ser removidos."""
        resultado = normalizar_texto("  pintura porta  ")
        self.assertEqual(resultado, resultado.strip())
        self.assertEqual(resultado, "pintura porta")

    def test_23_virgula_removida(self) -> None:
        """Vírgula deve ser removida."""
        resultado = normalizar_texto("pintura, polimento")
        self.assertNotIn(",", resultado)

    def test_24_ponto_removido(self) -> None:
        """Ponto deve ser removido."""
        resultado = normalizar_texto("pintura. polimento")
        self.assertNotIn(".", resultado)

    # ── Casos complexos / compostos ───────────────────────────────────────────

    def test_25_subst_p_choque_diant_dto(self) -> None:
        """Caso real de OS: 'SUBST P/CHOQUE DIANT DTO'."""
        resultado = normalizar_texto("SUBST P/CHOQUE DIANT DTO")
        self.assertIn("substituicao", resultado)
        self.assertIn("para-choque", resultado)
        self.assertIn("dianteiro", resultado)
        self.assertIn("direito", resultado)

    def test_26_pintura_porta_esq(self) -> None:
        """'pintura porta esq' → deve ter esquerdo."""
        resultado = normalizar_texto("pintura porta esq")
        self.assertIn("pintura", resultado)
        self.assertIn("porta", resultado)
        self.assertIn("esquerdo", resultado)

    def test_27_rem_paralama(self) -> None:
        """'rem paralama' → remocao paralama."""
        resultado = normalizar_texto("rem paralama")
        self.assertIn("remocao", resultado)
        self.assertIn("paralama", resultado)

    def test_28_tinta_azul_metalica(self) -> None:
        """'Tinta Azul Metálica' → 'tinta azul metalica'."""
        resultado = normalizar_texto("Tinta Azul Metálica")
        self.assertEqual(resultado, "tinta azul metalica")

    def test_29_lixa_p320_dagua(self) -> None:
        """'LIXA  P320  D'AGUA' → sem espaços duplos e sem apóstrofo."""
        resultado = normalizar_texto("LIXA  P320  D'AGUA")
        self.assertNotIn("  ", resultado)
        self.assertNotIn("'", resultado)
        self.assertIn("lixa", resultado)
        self.assertIn("p320", resultado)

    def test_30_inst_paralama(self) -> None:
        """'instalação de para-lama' → instalacao + paralama."""
        resultado = normalizar_texto("instalação de para-lama")
        self.assertIn("instalacao", resultado)
        self.assertIn("paralama", resultado)
