"""
Paddock Solutions — Pricing Profile Tests: Services

Testa os 4 níveis de fallback do EnquadramentoService.resolver().
"""
import logging

from django_tenants.test.cases import TenantTestCase

from apps.pricing_profile.models import (
    CategoriaTamanho,
    EnquadramentoFaltante,
    EnquadramentoVeiculo,
    SegmentoVeicular,
    TipoPintura,
)
from apps.pricing_profile.services import EnquadramentoService

logger = logging.getLogger(__name__)


def make_segmento(
    codigo: str = "medio",
    nome: str = "Médio",
    ordem: int = 2,
    fator: str = "1.00",
) -> SegmentoVeicular:
    return SegmentoVeicular.objects.create(
        codigo=codigo,
        nome=nome,
        ordem=ordem,
        fator_responsabilidade=fator,
    )


def make_tamanho(
    codigo: str = "medio",
    nome: str = "Médio",
    ordem: int = 2,
) -> CategoriaTamanho:
    return CategoriaTamanho.objects.create(
        codigo=codigo,
        nome=nome,
        ordem=ordem,
        multiplicador_insumos="1.00",
        multiplicador_horas="1.00",
    )


def make_tipo_pintura(
    codigo: str = "solida",
    nome: str = "Sólida",
    complexidade: int = 1,
) -> TipoPintura:
    return TipoPintura.objects.create(
        codigo=codigo,
        nome=nome,
        complexidade=complexidade,
    )


class TestEnquadramentoServiceNivel1Exato(TenantTestCase):
    """Nível 1 — match exato: marca + modelo + ano no intervalo."""

    def setUp(self) -> None:
        super().setUp()
        self.segmento = make_segmento(codigo="premium", nome="Premium")
        self.tamanho = make_tamanho(codigo="medio", nome="Médio")

        # Enquadramento exato: Honda Civic 2018–2022
        EnquadramentoVeiculo.objects.create(
            marca="Honda",
            modelo="Civic",
            ano_inicio=2018,
            ano_fim=2022,
            segmento=self.segmento,
            tamanho=self.tamanho,
            prioridade=10,
        )

    def test_resolver_retorna_origem_exato(self) -> None:
        """Veículo dentro do intervalo de ano → origem = 'exato'."""
        result = EnquadramentoService.resolver(
            marca="Honda", modelo="Civic", ano=2020
        )
        self.assertEqual(result.origem, "exato")
        self.assertEqual(result.segmento_codigo, "premium")
        self.assertEqual(result.tamanho_codigo, "medio")

    def test_resolver_exato_case_insensitive(self) -> None:
        """Marca e modelo em minúsculas também devem resolver como exato."""
        result = EnquadramentoService.resolver(
            marca="honda", modelo="civic", ano=2020
        )
        self.assertEqual(result.origem, "exato")

    def test_resolver_exato_retorna_enquadramento_id(self) -> None:
        """Match exato deve retornar o id do enquadramento."""
        result = EnquadramentoService.resolver(
            marca="Honda", modelo="Civic", ano=2020
        )
        self.assertIsNotNone(result.enquadramento_id)

    def test_resolver_ano_exatamente_no_limite_inferior_aceita(self) -> None:
        """ano = ano_inicio (limite inclusivo) → match exato."""
        result = EnquadramentoService.resolver(
            marca="Honda", modelo="Civic", ano=2018
        )
        self.assertEqual(result.origem, "exato")

    def test_resolver_ano_exatamente_no_limite_superior_aceita(self) -> None:
        """ano = ano_fim (limite inclusivo) → match exato."""
        result = EnquadramentoService.resolver(
            marca="Honda", modelo="Civic", ano=2022
        )
        self.assertEqual(result.origem, "exato")


class TestEnquadramentoServiceNivel2MarcaModelo(TenantTestCase):
    """Nível 2 — match marca+modelo sem restrição de ano.

    Registros com ano_inicio=None AND ano_fim=None são excluídos do nível 1
    (que requer ao menos um limite de ano definido) e capturados aqui no nível 2.
    Isso garante que o nível 2 seja atingível e produza origem='marca_modelo'.
    """

    def setUp(self) -> None:
        super().setUp()
        self.segmento_medio = make_segmento(codigo="medio", nome="Médio")
        self.tamanho = make_tamanho()

        # Enquadramento sem restrição de ano (marca + modelo, qualquer ano)
        # Nível 1 exclui esses registros (requer intervalo de ano explícito)
        # → capturado pelo nível 2 → origem='marca_modelo'
        EnquadramentoVeiculo.objects.create(
            marca="Volkswagen",
            modelo="Gol",
            ano_inicio=None,
            ano_fim=None,
            segmento=self.segmento_medio,
            tamanho=self.tamanho,
            prioridade=50,
        )

    def test_resolver_enquadramento_sem_ano_classificado_como_marca_modelo(self) -> None:
        """Enquadramento com ano_inicio=None e ano_fim=None é excluído do nível 1
        e capturado pelo nível 2, retornando origem='marca_modelo'."""
        result = EnquadramentoService.resolver(
            marca="Volkswagen", modelo="Gol", ano=1990
        )
        self.assertEqual(result.origem, "marca_modelo")
        self.assertEqual(result.segmento_codigo, "medio")

    def test_resolver_marca_modelo_retorna_enquadramento_id(self) -> None:
        """Match de marca+modelo (sem restrição de ano) deve retornar enquadramento_id."""
        result = EnquadramentoService.resolver(
            marca="Volkswagen", modelo="Gol", ano=1990
        )
        self.assertIsNotNone(result.enquadramento_id)


class TestEnquadramentoServiceNivel3Marca(TenantTestCase):
    """Nível 3 — match apenas marca (modelo vazio)."""

    def setUp(self) -> None:
        super().setUp()
        self.segmento_generica = make_segmento(
            codigo="generica-fiat", nome="Genérica Fiat"
        )
        self.tamanho = make_tamanho()

        # Enquadramento genérico da marca Fiat (modelo vazio)
        EnquadramentoVeiculo.objects.create(
            marca="Fiat",
            modelo="",  # regra de marca genérica
            ano_inicio=None,
            ano_fim=None,
            segmento=self.segmento_generica,
            tamanho=self.tamanho,
            prioridade=100,
        )

    def test_resolver_modelo_desconhecido_retorna_marca(self) -> None:
        """Modelo não mapeado usa enquadramento genérico da marca."""
        result = EnquadramentoService.resolver(
            marca="Fiat", modelo="ModeloInexistente", ano=2020
        )
        self.assertEqual(result.origem, "marca")
        self.assertEqual(result.segmento_codigo, "generica-fiat")

    def test_resolver_marca_retorna_enquadramento_id(self) -> None:
        """Match de marca genérica deve retornar o id do enquadramento."""
        result = EnquadramentoService.resolver(
            marca="Fiat", modelo="ModeloInexistente", ano=2020
        )
        self.assertIsNotNone(result.enquadramento_id)


class TestEnquadramentoServiceNivel4Fallback(TenantTestCase):
    """Nível 4 — fallback genérico quando nenhum enquadramento existe."""

    def setUp(self) -> None:
        super().setUp()
        # Garante banco limpo: nenhum enquadramento para marca/modelo usados
        EnquadramentoVeiculo.objects.filter(
            marca__iexact="MARCAINEXISTENTE"
        ).delete()
        EnquadramentoFaltante.objects.filter(
            marca="MARCAINEXISTENTE"
        ).delete()

    def test_resolver_sem_enquadramento_retorna_fallback(self) -> None:
        """Sem nenhum enquadramento → origem = 'fallback'."""
        result = EnquadramentoService.resolver(
            marca="MarcaInexistente", modelo="ModeloInexistente", ano=2020
        )
        self.assertEqual(result.origem, "fallback")
        self.assertEqual(result.segmento_codigo, EnquadramentoService.FALLBACK_SEGMENTO)
        self.assertEqual(result.tamanho_codigo, EnquadramentoService.FALLBACK_TAMANHO)

    def test_resolver_fallback_cria_enquadramento_faltante(self) -> None:
        """Fallback deve criar (ou incrementar) EnquadramentoFaltante para curadoria."""
        EnquadramentoFaltante.objects.filter(
            marca="MARCAINEXISTENTE", modelo="MODELOINEXISTENTE"
        ).delete()

        EnquadramentoService.resolver(
            marca="MarcaInexistente", modelo="ModeloInexistente", ano=2020
        )

        self.assertTrue(
            EnquadramentoFaltante.objects.filter(
                marca="MARCAINEXISTENTE", modelo="MODELOINEXISTENTE"
            ).exists(),
            "EnquadramentoFaltante deve ser criado quando nenhum enquadramento existe.",
        )

    def test_resolver_fallback_incrementa_ocorrencias(self) -> None:
        """Segunda chamada com mesma marca/modelo incrementa ocorrencias."""
        EnquadramentoFaltante.objects.filter(
            marca="MARCAINEXISTENTE", modelo="MODELOINEXISTENTE"
        ).delete()

        EnquadramentoService.resolver(
            marca="MarcaInexistente", modelo="ModeloInexistente", ano=2020
        )
        EnquadramentoService.resolver(
            marca="MarcaInexistente", modelo="ModeloInexistente", ano=2020
        )

        faltante = EnquadramentoFaltante.objects.get(
            marca="MARCAINEXISTENTE", modelo="MODELOINEXISTENTE"
        )
        self.assertGreaterEqual(faltante.ocorrencias, 2)

    def test_resolver_fallback_nao_retorna_enquadramento_id(self) -> None:
        """Fallback não tem enquadramento associado — enquadramento_id deve ser None."""
        result = EnquadramentoService.resolver(
            marca="MarcaInexistente", modelo="ModeloInexistente", ano=2020
        )
        self.assertIsNone(result.enquadramento_id)
