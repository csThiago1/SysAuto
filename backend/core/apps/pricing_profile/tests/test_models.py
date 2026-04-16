"""
Paddock Solutions — Pricing Profile Tests: Models

Testa constraints e validators dos models do Motor de Orçamentos.
"""
import logging

from django.core.exceptions import ValidationError
from django_tenants.test.cases import TenantTestCase

from apps.pricing_profile.models import (
    CategoriaTamanho,
    EnquadramentoVeiculo,
    SegmentoVeicular,
    TipoPintura,
)

logger = logging.getLogger(__name__)


def make_segmento(
    codigo: str = "medio",
    nome: str = "Médio",
    ordem: int = 2,
    fator: str = "1.00",
) -> SegmentoVeicular:
    """Helper: cria SegmentoVeicular sem validação de campo (direto no ORM)."""
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
    multiplicador_insumos: str = "1.00",
    multiplicador_horas: str = "1.00",
) -> CategoriaTamanho:
    """Helper: cria CategoriaTamanho sem validação de campo (direto no ORM)."""
    return CategoriaTamanho.objects.create(
        codigo=codigo,
        nome=nome,
        ordem=ordem,
        multiplicador_insumos=multiplicador_insumos,
        multiplicador_horas=multiplicador_horas,
    )


def make_tipo_pintura(
    codigo: str = "solida",
    nome: str = "Sólida",
    complexidade: int = 1,
) -> TipoPintura:
    """Helper: cria TipoPintura sem validação de campo (direto no ORM)."""
    return TipoPintura.objects.create(
        codigo=codigo,
        nome=nome,
        complexidade=complexidade,
    )


class TestSegmentoVeicularValidators(TenantTestCase):
    """Testa validators do campo fator_responsabilidade em SegmentoVeicular."""

    def _build_segmento(self, fator: str) -> SegmentoVeicular:
        """Constrói (sem salvar) um segmento com o fator informado."""
        return SegmentoVeicular(
            codigo="test-seg",
            nome="Teste",
            ordem=99,
            fator_responsabilidade=fator,
        )

    def test_fator_responsabilidade_abaixo_do_minimo_rejeita(self) -> None:
        """fator_responsabilidade < 0.5 deve lançar ValidationError."""
        segmento = self._build_segmento("0.49")
        with self.assertRaises(ValidationError):
            segmento.full_clean()

    def test_fator_responsabilidade_acima_do_maximo_rejeita(self) -> None:
        """fator_responsabilidade > 5.0 deve lançar ValidationError."""
        segmento = self._build_segmento("5.01")
        with self.assertRaises(ValidationError):
            segmento.full_clean()

    def test_fator_responsabilidade_no_limite_inferior_aceita(self) -> None:
        """fator_responsabilidade = 0.5 é válido."""
        segmento = self._build_segmento("0.50")
        segmento.full_clean()  # Não deve lançar

    def test_fator_responsabilidade_no_limite_superior_aceita(self) -> None:
        """fator_responsabilidade = 5.0 é válido."""
        segmento = self._build_segmento("5.00")
        segmento.full_clean()  # Não deve lançar

    def test_fator_responsabilidade_valor_normal_aceita(self) -> None:
        """fator_responsabilidade = 1.5 é válido."""
        segmento = self._build_segmento("1.50")
        segmento.full_clean()  # Não deve lançar


class TestTipoPinturaValidators(TenantTestCase):
    """Testa validators do campo complexidade em TipoPintura."""

    def _build_tipo_pintura(self, complexidade: int) -> TipoPintura:
        """Constrói (sem salvar) um TipoPintura com complexidade informada."""
        return TipoPintura(
            codigo="test-pintura",
            nome="Teste",
            complexidade=complexidade,
        )

    def test_complexidade_zero_rejeita(self) -> None:
        """complexidade = 0 deve lançar ValidationError (mínimo é 1)."""
        tipo = self._build_tipo_pintura(0)
        with self.assertRaises(ValidationError):
            tipo.full_clean()

    def test_complexidade_cinco_rejeita(self) -> None:
        """complexidade = 5 deve lançar ValidationError (máximo é 4)."""
        tipo = self._build_tipo_pintura(5)
        with self.assertRaises(ValidationError):
            tipo.full_clean()

    def test_complexidade_um_aceita(self) -> None:
        """complexidade = 1 (Sólida) é válido."""
        tipo = self._build_tipo_pintura(1)
        tipo.full_clean()  # Não deve lançar

    def test_complexidade_quatro_aceita(self) -> None:
        """complexidade = 4 (Tricoat) é válido."""
        tipo = self._build_tipo_pintura(4)
        tipo.full_clean()  # Não deve lançar


class TestCategoriaTamanhoValidators(TenantTestCase):
    """Testa validators do campo multiplicador_insumos em CategoriaTamanho."""

    def _build_categoria(self, multiplicador_insumos: str) -> CategoriaTamanho:
        """Constrói (sem salvar) uma CategoriaTamanho com o multiplicador informado."""
        return CategoriaTamanho(
            codigo="test-tam",
            nome="Teste",
            ordem=99,
            multiplicador_insumos=multiplicador_insumos,
            multiplicador_horas="1.00",
        )

    def test_multiplicador_insumos_abaixo_do_minimo_rejeita(self) -> None:
        """multiplicador_insumos < 0.1 deve lançar ValidationError."""
        categoria = self._build_categoria("0.09")
        with self.assertRaises(ValidationError):
            categoria.full_clean()

    def test_multiplicador_insumos_no_limite_inferior_aceita(self) -> None:
        """multiplicador_insumos = 0.1 é válido."""
        categoria = self._build_categoria("0.10")
        categoria.full_clean()  # Não deve lançar

    def test_multiplicador_insumos_valor_normal_aceita(self) -> None:
        """multiplicador_insumos = 1.5 é válido."""
        categoria = self._build_categoria("1.50")
        categoria.full_clean()  # Não deve lançar


class TestEnquadramentoVeiculoClean(TenantTestCase):
    """Testa clean() de EnquadramentoVeiculo — validação de intervalo de ano."""

    def setUp(self) -> None:
        super().setUp()
        self.segmento = make_segmento()
        self.tamanho = make_tamanho()

    def _build_enquadramento(
        self,
        ano_inicio: int | None = None,
        ano_fim: int | None = None,
    ) -> EnquadramentoVeiculo:
        """Constrói (sem salvar) um EnquadramentoVeiculo com os anos informados."""
        return EnquadramentoVeiculo(
            marca="Honda",
            modelo="Civic",
            ano_inicio=ano_inicio,
            ano_fim=ano_fim,
            segmento=self.segmento,
            tamanho=self.tamanho,
        )

    def test_clean_ano_inicio_maior_que_ano_fim_rejeita(self) -> None:
        """ano_inicio > ano_fim deve lançar ValidationError em clean()."""
        enq = self._build_enquadramento(ano_inicio=2022, ano_fim=2020)
        with self.assertRaises(ValidationError) as ctx:
            enq.clean()
        self.assertIn("ano_fim", str(ctx.exception))

    def test_clean_ano_inicio_igual_ano_fim_aceita(self) -> None:
        """ano_inicio == ano_fim deve passar na validação."""
        enq = self._build_enquadramento(ano_inicio=2020, ano_fim=2020)
        enq.clean()  # Não deve lançar

    def test_clean_intervalo_valido_aceita(self) -> None:
        """ano_inicio < ano_fim deve passar na validação."""
        enq = self._build_enquadramento(ano_inicio=2018, ano_fim=2022)
        enq.clean()  # Não deve lançar

    def test_clean_ano_inicio_none_com_ano_fim_aceita(self) -> None:
        """ano_inicio=None com ano_fim=2020 não deve lançar ValidationError."""
        enq = self._build_enquadramento(ano_inicio=None, ano_fim=2020)
        enq.clean()  # Não deve lançar

    def test_clean_ambos_none_aceita(self) -> None:
        """ano_inicio=None e ano_fim=None são permitidos (sem limite)."""
        enq = self._build_enquadramento(ano_inicio=None, ano_fim=None)
        enq.clean()  # Não deve lançar

    def test_clean_ano_fim_none_com_ano_inicio_aceita(self) -> None:
        """ano_inicio=2020, ano_fim=None deve passar (sem limite superior)."""
        enq = self._build_enquadramento(ano_inicio=2020, ano_fim=None)
        enq.clean()  # Não deve lançar
