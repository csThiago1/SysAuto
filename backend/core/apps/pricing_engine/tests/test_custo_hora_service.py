"""
Paddock Solutions — Pricing Engine — Tests: CustoHoraService
Motor de Orçamentos (MO) — Sprint 03: Adapters de Custo

Testa o comportamento do CustoHoraService (fallback, sem dados, etc.)
e do DespesaRecorrenteService com dados mockados.
"""
import hashlib
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django_tenants.test.cases import TenantTestCase

from apps.pricing_catalog.models import CategoriaMaoObra
from apps.pricing_engine.models import CustoHoraFallback
from apps.pricing_engine.services import (
    CustoHoraService,
    CustoNaoDefinido,
    DespesaRecorrenteService,
)
from apps.pricing_profile.models import Empresa


def make_empresa(
    cnpj: str = "12345678000190",
    nome_fantasia: str = "DS Car Teste",
) -> Empresa:
    """Cria uma Empresa de teste."""
    return Empresa.objects.create(
        cnpj=cnpj,
        nome_fantasia=nome_fantasia,
        razao_social=f"Empresa Teste Ltda — {cnpj}",
    )


def make_categoria_mao_obra(
    codigo: str = "funileiro",
    nome: str = "Funileiro",
) -> CategoriaMaoObra:
    """Cria uma CategoriaMaoObra de teste."""
    return CategoriaMaoObra.objects.create(codigo=codigo, nome=nome)


class TestCustoHoraServiceFallback(TenantTestCase):
    """Testes de CustoHoraService com apenas fallback disponível."""

    def setUp(self) -> None:
        super().setUp()
        self.empresa = make_empresa()
        self.categoria = make_categoria_mao_obra()
        self.data = date(2024, 6, 15)

    @patch("apps.pricing_engine.services.rh_adapter.RHAdapter.total_mensal_categoria")
    def test_retorna_fallback_quando_rh_retorna_none(
        self, mock_rh: object
    ) -> None:
        """Quando RH retorna None (sem Employee), deve usar o fallback e retornar origem='fallback'."""
        mock_rh.return_value = None  # type: ignore[attr-defined]

        CustoHoraFallback.objects.create(
            empresa=self.empresa,
            categoria=self.categoria,
            vigente_desde=date(2024, 1, 1),
            vigente_ate=None,
            valor_hora=Decimal("95.00"),
            motivo="Aguardando integração RH",
        )

        resultado = CustoHoraService.obter(
            self.categoria.codigo,
            self.data,
            str(self.empresa.id),
        )

        self.assertEqual(resultado.origem, "fallback")
        self.assertEqual(resultado.valor, Decimal("95.00"))
        self.assertIn("fallback_id", resultado.decomposicao)

    @patch("apps.pricing_engine.services.rh_adapter.RHAdapter.total_mensal_categoria")
    def test_custo_nao_definido_sem_rh_e_sem_fallback(
        self, mock_rh: object
    ) -> None:
        """Quando RH retorna None e não há fallback, deve levantar CustoNaoDefinido."""
        mock_rh.return_value = None  # type: ignore[attr-defined]

        with self.assertRaises(CustoNaoDefinido):
            CustoHoraService.obter(
                self.categoria.codigo,
                self.data,
                str(self.empresa.id),
            )

    @patch("apps.pricing_engine.services.rh_adapter.RHAdapter.total_mensal_categoria")
    def test_fallback_fora_de_vigencia_nao_utilizado(
        self, mock_rh: object
    ) -> None:
        """Fallback com vigente_ate anterior à data não deve ser encontrado."""
        mock_rh.return_value = None  # type: ignore[attr-defined]

        # Fallback vencido
        CustoHoraFallback.objects.create(
            empresa=self.empresa,
            categoria=self.categoria,
            vigente_desde=date(2023, 1, 1),
            vigente_ate=date(2023, 12, 31),
            valor_hora=Decimal("80.00"),
            motivo="Fallback antigo",
        )

        with self.assertRaises(CustoNaoDefinido):
            CustoHoraService.obter(
                self.categoria.codigo,
                self.data,
                str(self.empresa.id),
            )

    @patch("apps.pricing_engine.services.rh_adapter.RHAdapter.total_mensal_categoria")
    def test_retorna_fallback_mais_recente_quando_multiplos(
        self, mock_rh: object
    ) -> None:
        """Deve retornar o fallback vigente mais recente (order_by -vigente_desde)."""
        mock_rh.return_value = None  # type: ignore[attr-defined]

        CustoHoraFallback.objects.create(
            empresa=self.empresa,
            categoria=self.categoria,
            vigente_desde=date(2023, 6, 1),
            vigente_ate=None,
            valor_hora=Decimal("80.00"),
            motivo="Fallback antigo ativo",
        )
        CustoHoraFallback.objects.create(
            empresa=self.empresa,
            categoria=self.categoria,
            vigente_desde=date(2024, 3, 1),
            vigente_ate=None,
            valor_hora=Decimal("100.00"),
            motivo="Fallback novo ativo",
        )

        resultado = CustoHoraService.obter(
            self.categoria.codigo,
            self.data,
            str(self.empresa.id),
        )

        self.assertEqual(resultado.valor, Decimal("100.00"))


class TestCustoHoraServiceRH(TenantTestCase):
    """Testes de CustoHoraService com dados de RH mockados."""

    def setUp(self) -> None:
        super().setUp()
        self.empresa = make_empresa(cnpj="11111111000111")
        self.categoria = make_categoria_mao_obra(codigo="pintor", nome="Pintor")
        self.data = date(2024, 6, 15)

    @patch("apps.pricing_engine.services.custo_hora.RHAdapter.qtd_funcionarios_categoria")
    @patch("apps.pricing_engine.services.custo_hora.RHAdapter.total_mensal_categoria")
    def test_calcula_via_rh_com_defaults(
        self,
        mock_total: object,
        mock_qtd: object,
    ) -> None:
        """Quando RH tem dados e não há ParametroCustoHora, usa defaults conservadores."""
        mock_total.return_value = Decimal("5000.00")  # type: ignore[attr-defined]
        mock_qtd.return_value = 2  # type: ignore[attr-defined]

        resultado = CustoHoraService.obter(
            self.categoria.codigo,
            self.data,
            str(self.empresa.id),
        )

        self.assertEqual(resultado.origem, "rh")
        self.assertGreater(resultado.valor, Decimal("0"))
        self.assertIn("bruto_folha", resultado.decomposicao)
        self.assertIn("params_id", resultado.decomposicao)
        # Com defaults, params_id deve ser "default"
        self.assertEqual(resultado.decomposicao["params_id"], "default")


class TestDespesaRecorrenteServiceMockado(TenantTestCase):
    """Testa DespesaRecorrenteService com dados diretos no banco."""

    def setUp(self) -> None:
        super().setUp()
        self.empresa = make_empresa(cnpj="22222222000122")
        self.data = date(2024, 6, 15)

    def test_total_vigente_sem_despesas_retorna_zero(self) -> None:
        """Sem despesas cadastradas, total_vigente deve retornar Decimal('0')."""
        total = DespesaRecorrenteService.total_vigente(self.data, str(self.empresa.id))
        self.assertEqual(total, Decimal("0"))

    def test_decomposicao_vigente_sem_despesas_retorna_lista_vazia(self) -> None:
        """Sem despesas, decomposicao_vigente deve retornar lista vazia."""
        result = DespesaRecorrenteService.decomposicao_vigente(
            self.data, str(self.empresa.id)
        )
        self.assertEqual(result, [])
