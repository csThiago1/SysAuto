"""
Paddock Solutions — Pricing Engine — Tests: MotorPrecificacaoService (Peça)
Motor de Orçamentos (MO) — Sprint MO-6

Testa MotorPrecificacaoService.calcular_peca() e MargemResolver para peças.
"""
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django_tenants.test.cases import TenantTestCase

from apps.pricing_engine.models import CalculoCustoSnapshot, MargemOperacao, MarkupPeca
from apps.pricing_engine.services.motor import (
    ContextoCalculo,
    ErroMotorPrecificacao,
    MotorPrecificacaoService,
)
from apps.pricing_profile.models import Empresa, SegmentoVeicular


def make_empresa(cnpj: str = "99999999000199") -> Empresa:
    return Empresa.objects.create(
        cnpj=cnpj,
        nome_fantasia=f"Empresa Peca {cnpj[:4]}",
        razao_social=f"Empresa Peca Ltda {cnpj}",
    )


def make_segmento(codigo: str = "popular", ordem: int = 1) -> SegmentoVeicular:
    return SegmentoVeicular.objects.get_or_create(
        codigo=codigo,
        defaults={
            "nome": f"Segmento {codigo}",
            "ordem": ordem,
            "fator_responsabilidade": Decimal("1.00"),
        },
    )[0]


@dataclass
class FakeEnquadramentoResult:
    segmento_codigo: str = "popular"
    tamanho_codigo: str = "medio"
    tipo_pintura_codigo: str | None = None
    origem: str = "exato"
    enquadramento_id: str | None = None


class TestMotorCalcularPeca(TenantTestCase):
    """Testa calcular_peca() com mocks das dependências de custo."""

    def setUp(self) -> None:
        super().setUp()
        self.empresa = make_empresa("99999999000199")
        self.segmento = make_segmento("popular")
        # Margem padrão peca_revenda
        MargemOperacao.objects.create(
            empresa=self.empresa,
            segmento=self.segmento,
            tipo_operacao="peca_revenda",
            margem_percentual=Decimal("0.3000"),
            vigente_desde=date(2024, 1, 1),
        )
        self.ctx = ContextoCalculo(
            empresa_id=str(self.empresa.id),
            veiculo_marca="Toyota",
            veiculo_modelo="Corolla",
            veiculo_ano=2020,
        )

    @patch("apps.pricing_engine.services.motor.EnquadramentoService.resolver")
    @patch("apps.pricing_engine.services.motor.CustoPecaService.custo_base")
    @patch("apps.pricing_engine.services.motor.CustoPecaService.unidades_disponiveis")
    def test_usa_max_valor_nf_como_custo_base(
        self,
        mock_unidades,
        mock_custo_peca,
        mock_enq,
    ) -> None:
        """calcular_peca usa CustoPecaService.custo_base() que retorna max(valor_nf)."""
        mock_enq.return_value = FakeEnquadramentoResult()
        mock_custo_peca.return_value = Decimal("450.00")
        mock_unidades.return_value = 3

        peca_id = "20000000-0000-0000-0000-000000000001"
        resultado = MotorPrecificacaoService.calcular_peca(
            self.ctx, peca_id, quantidade=1, origem="simulacao"
        )

        # custo_base deve ser exatamente o que CustoPecaService retornou
        snap = CalculoCustoSnapshot.objects.get(pk=resultado.snapshot_id)
        self.assertEqual(snap.custo_peca_base, Decimal("450.00"))
        # preco_final deve ser maior que custo (margem aplicada)
        self.assertGreater(resultado.preco_final, Decimal("450.00"))

    @patch("apps.pricing_engine.services.motor.EnquadramentoService.resolver")
    @patch("apps.pricing_engine.services.motor.CustoPecaService.custo_base")
    @patch("apps.pricing_engine.services.motor.CustoPecaService.unidades_disponiveis")
    def test_markup_peca_especifica_sobrescreve_segmento(
        self,
        mock_unidades,
        mock_custo_peca,
        mock_enq,
    ) -> None:
        """MarkupPeca com peca_canonica sobrescreve a margem do segmento."""
        from apps.pricing_catalog.models import PecaCanonica

        peca_id_str = "00000000-aaaa-0000-0000-000000000001"

        # Criar MarkupPeca específico com margem alta
        MarkupPeca.objects.create(
            empresa=self.empresa,
            peca_canonica_id=peca_id_str,
            faixa_custo_min=None,
            faixa_custo_max=None,
            margem_percentual=Decimal("0.6000"),
            vigente_desde=date(2024, 1, 1),
        )

        mock_enq.return_value = FakeEnquadramentoResult()
        mock_custo_peca.return_value = Decimal("200.00")
        mock_unidades.return_value = 2

        resultado = MotorPrecificacaoService.calcular_peca(
            self.ctx, peca_id_str, quantidade=1, origem="simulacao"
        )

        snap = CalculoCustoSnapshot.objects.get(pk=resultado.snapshot_id)
        # margem_base deve ser 0.6000 (específica), não 0.3000 (segmento)
        self.assertEqual(snap.margem_base, Decimal("0.6000"))

    @patch("apps.pricing_engine.services.motor.EnquadramentoService.resolver")
    @patch("apps.pricing_engine.services.motor.CustoPecaService.custo_base")
    @patch("apps.pricing_engine.services.motor.CustoPecaService.unidades_disponiveis")
    def test_markup_por_faixa_aplicado(
        self,
        mock_unidades,
        mock_custo_peca,
        mock_enq,
    ) -> None:
        """MarkupPeca de faixa é aplicado quando custo está dentro do range."""
        MarkupPeca.objects.create(
            empresa=self.empresa,
            peca_canonica=None,
            faixa_custo_min=Decimal("100.00"),
            faixa_custo_max=Decimal("300.00"),
            margem_percentual=Decimal("0.4500"),
            vigente_desde=date(2024, 1, 1),
        )

        mock_enq.return_value = FakeEnquadramentoResult()
        mock_custo_peca.return_value = Decimal("200.00")  # dentro da faixa
        mock_unidades.return_value = 1

        peca_id = "20000000-0000-0000-0000-000000000002"
        resultado = MotorPrecificacaoService.calcular_peca(
            self.ctx, peca_id, quantidade=1, origem="simulacao"
        )

        snap = CalculoCustoSnapshot.objects.get(pk=resultado.snapshot_id)
        self.assertEqual(snap.margem_base, Decimal("0.4500"))

    @patch("apps.pricing_engine.services.motor.EnquadramentoService.resolver")
    @patch("apps.pricing_engine.services.motor.CustoPecaService.custo_base")
    @patch("apps.pricing_engine.services.motor.CustoPecaService.unidades_disponiveis")
    def test_fallback_margem_segmento_peca(
        self,
        mock_unidades,
        mock_custo_peca,
        mock_enq,
    ) -> None:
        """Sem markup específico ou faixa, usa peca_revenda do segmento."""
        mock_enq.return_value = FakeEnquadramentoResult()
        mock_custo_peca.return_value = Decimal("100.00")
        mock_unidades.return_value = 5

        peca_id = "20000000-0000-0000-0000-000000000003"
        resultado = MotorPrecificacaoService.calcular_peca(
            self.ctx, peca_id, quantidade=1, origem="simulacao"
        )

        snap = CalculoCustoSnapshot.objects.get(pk=resultado.snapshot_id)
        self.assertEqual(snap.margem_base, Decimal("0.3000"))  # padrão segmento

    @patch("apps.pricing_engine.services.motor.EnquadramentoService.resolver")
    @patch("apps.pricing_engine.services.motor.CustoPecaService.custo_base")
    @patch("apps.pricing_engine.services.motor.CustoPecaService.unidades_disponiveis")
    def test_quantidade_multiplica_preco_final(
        self,
        mock_unidades,
        mock_custo_peca,
        mock_enq,
    ) -> None:
        """Quantidade > 1 deve multiplicar o preço final unitário."""
        mock_enq.return_value = FakeEnquadramentoResult()
        mock_custo_peca.return_value = Decimal("100.00")
        mock_unidades.return_value = 10

        peca_id = "20000000-0000-0000-0000-000000000004"

        resultado_1 = MotorPrecificacaoService.calcular_peca(
            self.ctx, peca_id, quantidade=1, origem="simulacao"
        )
        resultado_3 = MotorPrecificacaoService.calcular_peca(
            self.ctx, peca_id, quantidade=3, origem="simulacao"
        )

        # 3 unidades = 3× o preço de 1 unidade
        self.assertEqual(resultado_3.preco_final, resultado_1.preco_final * 3)

    @patch("apps.pricing_engine.services.motor.EnquadramentoService.resolver")
    @patch("apps.pricing_engine.services.motor.CustoPecaService.custo_base")
    def test_custo_indisponivel_raise_erro_motor(
        self,
        mock_custo_peca,
        mock_enq,
    ) -> None:
        """CustoBaseIndisponivel deve ser convertido em ErroMotorPrecificacao (P8)."""
        from apps.pricing_engine.services.custo_base import CustoBaseIndisponivel
        mock_enq.return_value = FakeEnquadramentoResult()
        mock_custo_peca.side_effect = CustoBaseIndisponivel("Sem estoque")

        peca_id = "20000000-0000-0000-0000-000000000099"
        with self.assertRaises(ErroMotorPrecificacao) as ctx_mgr:
            MotorPrecificacaoService.calcular_peca(
                self.ctx, peca_id, quantidade=1, origem="simulacao"
            )
        self.assertIn("custo_peca", ctx_mgr.exception.recurso_faltante)
