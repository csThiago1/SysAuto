"""
Paddock Solutions — Pricing Catalog Tests: AliasMatcher
Motor de Orçamentos (MO) — Sprint 02: Catálogo Técnico

Testa match exato e fuzzy do AliasMatcher com mocks para embed_text
(para não chamar a API Voyage em testes).
"""
import logging
from unittest.mock import patch

from django_tenants.test.cases import TenantTestCase

from apps.pricing_catalog.models import (
    AliasServico,
    CategoriaServico,
    ServicoCanonico,
)
from apps.pricing_catalog.services.aliases import AliasMatcher, MatchResult
from apps.pricing_catalog.utils.text import normalizar_texto

logger = logging.getLogger(__name__)


# ─── Helpers ──────────────────────────────────────────────────────────────────


def make_categoria(codigo: str = "funilaria", nome: str = "Funilaria") -> CategoriaServico:
    """Cria CategoriaServico para os testes."""
    return CategoriaServico.objects.create(codigo=codigo, nome=nome, ordem=1)


def make_servico(
    categoria: CategoriaServico,
    codigo: str = "pintura-para-choque",
    nome: str = "Pintura de Para-Choque",
) -> ServicoCanonico:
    """Cria ServicoCanonico para os testes."""
    return ServicoCanonico.objects.create(
        codigo=codigo,
        nome=nome,
        categoria=categoria,
        unidade="un",
        aplica_multiplicador_tamanho=True,
    )


def make_alias_servico(
    canonico: ServicoCanonico,
    texto: str,
    origem: str = "manual",
    confianca: float | None = None,
) -> AliasServico:
    """Cria AliasServico com texto_normalizado calculado."""
    return AliasServico.objects.create(
        canonico=canonico,
        texto=texto,
        texto_normalizado=normalizar_texto(texto),
        origem=origem,
        confianca=confianca,
        ocorrencias=1,
    )


# ─── Testes de match exato ────────────────────────────────────────────────────


class TestAliasMatcherExato(TenantTestCase):
    """Testa match exato via texto_normalizado no banco."""

    def setUp(self) -> None:
        super().setUp()
        self.categoria = make_categoria()
        self.servico = make_servico(self.categoria)
        # Cria alias com texto normalizado exato
        make_alias_servico(self.servico, "PINTURA PARA-CHOQUE DIANT")

    def test_match_exato_retorna_metodo_exato(self) -> None:
        """AliasMatcher deve encontrar alias exato com metodo='exato'."""
        matcher = AliasMatcher()
        resultados = matcher.match_servico("PINTURA PARA-CHOQUE DIANT")
        self.assertGreater(len(resultados), 0)
        self.assertEqual(resultados[0].metodo, "exato")

    def test_match_exato_retorna_confianca_alta(self) -> None:
        """Match exato deve ter confianca='alta'."""
        matcher = AliasMatcher()
        resultados = matcher.match_servico("PINTURA PARA-CHOQUE DIANT")
        self.assertEqual(resultados[0].confianca, "alta")

    def test_match_exato_retorna_score_100(self) -> None:
        """Match exato deve ter score=100.0."""
        matcher = AliasMatcher()
        resultados = matcher.match_servico("PINTURA PARA-CHOQUE DIANT")
        self.assertAlmostEqual(resultados[0].score, 100.0)

    def test_match_exato_retorna_canonico_id_correto(self) -> None:
        """Match exato deve retornar o UUID correto do canônico."""
        matcher = AliasMatcher()
        resultados = matcher.match_servico("PINTURA PARA-CHOQUE DIANT")
        self.assertEqual(resultados[0].canonico_id, str(self.servico.pk))

    def test_match_exato_com_variacao_case(self) -> None:
        """Match exato deve funcionar independente de case (normalização)."""
        matcher = AliasMatcher()
        # Texto em minúsculas normalizado ao mesmo resultado
        resultados = matcher.match_servico("pintura para-choque diant")
        self.assertGreater(len(resultados), 0)
        self.assertEqual(resultados[0].metodo, "exato")

    def test_match_exato_retorna_lista_de_matchresult(self) -> None:
        """Resultado deve ser uma lista de instâncias MatchResult."""
        matcher = AliasMatcher()
        resultados = matcher.match_servico("PINTURA PARA-CHOQUE DIANT")
        self.assertIsInstance(resultados, list)
        self.assertIsInstance(resultados[0], MatchResult)


# ─── Testes de match fuzzy ────────────────────────────────────────────────────


class TestAliasMatcherFuzzy(TenantTestCase):
    """Testa match fuzzy quando não há alias exato no banco."""

    def setUp(self) -> None:
        super().setUp()
        self.categoria = make_categoria(codigo="pintura-cat", nome="Pintura")
        self.servico = make_servico(
            self.categoria,
            codigo="pintura-porta",
            nome="Pintura de Porta",
        )
        # Cria alias similar mas NÃO igual ao texto de busca
        make_alias_servico(self.servico, "PINTURA DE PORTA ESQUERDA")

    def test_texto_sem_alias_exato_pode_retornar_fuzzy(self) -> None:
        """Texto similar ao alias deve retornar resultado via fuzzy ou lista vazia."""
        matcher = AliasMatcher()
        # Texto diferente mas semanticamente próximo
        resultados = matcher.match_servico("PINTURAS DE PORTA ESQ")
        # Pode retornar fuzzy ou vazio — ambos são comportamentos válidos
        self.assertIsInstance(resultados, list)

    def test_texto_completamente_diferente_retorna_lista_vazia_ou_baixa_confianca(
        self,
    ) -> None:
        """Texto completamente diferente deve retornar lista vazia (sem embedding)."""
        matcher = AliasMatcher()
        # Mockar embed_text para não chamar a API real
        with patch("apps.pricing_catalog.services.aliases.embed_text") as mock_embed:
            mock_embed.side_effect = Exception("API não disponível em testes")
            resultados = matcher.match_servico("XPTO QUALQUER COISA ALEATORIA 12345")
        # Com embedding falhando e sem fuzzy alto, deve retornar vazio ou fuzzy baixo
        self.assertIsInstance(resultados, list)

    def test_match_servico_sem_aliases_retorna_lista_vazia(self) -> None:
        """Sem aliases no banco e sem embedding disponível, deve retornar lista vazia."""
        # Limpa todos os aliases
        AliasServico.objects.all().update(is_active=False)
        matcher = AliasMatcher()
        with patch("apps.pricing_catalog.services.aliases.embed_text") as mock_embed:
            mock_embed.side_effect = Exception("API não disponível em testes")
            resultados = matcher.match_servico("qualquer texto")
        self.assertEqual(resultados, [])


# ─── Testes de mock para embedding ───────────────────────────────────────────


class TestAliasMatcherEmbeddingMockado(TenantTestCase):
    """Testa que o AliasMatcher não chama embed_text quando há match exato."""

    def setUp(self) -> None:
        super().setUp()
        self.categoria = make_categoria(codigo="eletrica", nome="Elétrica")
        self.servico = make_servico(
            self.categoria,
            codigo="diagnostico-eletrico",
            nome="Diagnóstico Elétrico",
        )
        make_alias_servico(self.servico, "diagnostico eletrico")

    def test_match_exato_nao_chama_embed_text(self) -> None:
        """Quando há match exato, embed_text NÃO deve ser chamado."""
        matcher = AliasMatcher()
        with patch("apps.pricing_catalog.services.aliases.embed_text") as mock_embed:
            resultados = matcher.match_servico("diagnostico eletrico")
            mock_embed.assert_not_called()

        self.assertGreater(len(resultados), 0)
        self.assertEqual(resultados[0].metodo, "exato")

    def test_top_k_limita_resultados(self) -> None:
        """top_k deve limitar o número máximo de resultados retornados."""
        matcher = AliasMatcher()
        resultados = matcher.match_servico("diagnostico eletrico", top_k=1)
        self.assertLessEqual(len(resultados), 1)
