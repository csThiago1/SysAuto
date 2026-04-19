"""
Paddock Solutions — Pricing Engine — Tests: MotorPrecificacaoService (Serviço)
Motor de Orçamentos (MO) — Sprint MO-6

Testa MotorPrecificacaoService.calcular_servico() com mocks das dependências
(FichaTecnicaService, CustoHoraService, RateioService, etc.) para validar
o pipeline lógico sem precisar de todos os modelos relacionados no banco.

Testes de integração completos ficam no QA manual / E2E.
"""
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django_tenants.test.cases import TenantTestCase

from apps.pricing_engine.models import CalculoCustoSnapshot, MargemOperacao
from apps.pricing_engine.services.custo_hora import CustoHora
from apps.pricing_engine.services.margem import MargemNaoDefinida
from apps.pricing_engine.services.motor import (
    ContextoCalculo,
    ErroMotorPrecificacao,
    MotorPrecificacaoService,
)
from apps.pricing_profile.models import CategoriaTamanho, Empresa, SegmentoVeicular
from apps.pricing_tech.services import FichaResolvida


def make_empresa(cnpj: str = "77777777000177") -> Empresa:
    return Empresa.objects.create(
        cnpj=cnpj,
        nome_fantasia=f"Empresa Motor {cnpj[:4]}",
        razao_social=f"Empresa Motor Ltda {cnpj}",
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


def make_tamanho(codigo: str = "medio", ordem: int = 1) -> CategoriaTamanho:
    return CategoriaTamanho.objects.get_or_create(
        codigo=codigo,
        defaults={
            "nome": f"Tamanho {codigo}",
            "ordem": ordem,
            "multiplicador_insumos": Decimal("1.00"),
            "multiplicador_horas": Decimal("1.00"),
        },
    )[0]


@dataclass
class FakeEnquadramentoResult:
    segmento_codigo: str = "popular"
    tamanho_codigo: str = "medio"
    tipo_pintura_codigo: str | None = "SOLIDA"
    origem: str = "exato"
    enquadramento_id: str | None = None


def make_ficha_simples() -> FichaResolvida:
    return FichaResolvida(
        ficha_id="ficha-uuid-1234",
        versao=1,
        maos_obra=[
            {
                "categoria_codigo": "pintor",
                "categoria_nome": "Pintor",
                "horas": Decimal("3.0"),
                "afetada_por_tamanho": True,
            }
        ],
        insumos=[
            {
                "material_codigo": "TINTA_BASE",
                "material_nome": "Tinta Base",
                "quantidade": Decimal("0.48"),
                "unidade_base": "L",
                "afetado_por_tamanho": True,
            }
        ],
    )


def make_custo_hora(valor: Decimal = Decimal("85.50")) -> CustoHora:
    return CustoHora(
        valor=valor,
        origem="fallback",
        decomposicao={"fallback_id": "fb-1"},
        calculado_em=date.today(),
    )


class TestMotorCalcularServico(TenantTestCase):
    """Testa o pipeline de calcular_servico() com mocks."""

    def setUp(self) -> None:
        super().setUp()
        self.empresa = make_empresa("77777777000177")
        self.segmento = make_segmento("popular")
        self.tamanho = make_tamanho("medio")

        # Margem vigente para o serviço
        MargemOperacao.objects.create(
            empresa=self.empresa,
            segmento=self.segmento,
            tipo_operacao="servico_mao_obra",
            margem_percentual=Decimal("0.4000"),
            vigente_desde=date(2024, 1, 1),
        )

        self.ctx = ContextoCalculo(
            empresa_id=str(self.empresa.id),
            veiculo_marca="VW",
            veiculo_modelo="Gol",
            veiculo_ano=2018,
            tipo_pintura_codigo="SOLIDA",
        )

    @patch("apps.pricing_engine.services.motor.EnquadramentoService.resolver")
    @patch("apps.pricing_engine.services.motor.FichaTecnicaService.resolver")
    @patch("apps.pricing_engine.services.motor.FichaTecnicaService.aplicar_multiplicadores")
    @patch("apps.pricing_engine.services.motor.CustoHoraService.obter")
    @patch("apps.pricing_engine.services.motor.MaterialCanonico")
    @patch("apps.pricing_engine.services.motor.CustoInsumoService.custo_base")
    @patch("apps.pricing_engine.services.motor.RateioService.por_hora")
    @patch("apps.pricing_engine.services.motor.ServicoCanonico")
    def test_fluxo_completo_grava_snapshot(
        self,
        mock_servico_cls,
        mock_rateio,
        mock_custo_insumo,
        mock_material_cls,
        mock_custo_hora,
        mock_aplicar,
        mock_resolver_ficha,
        mock_enq,
    ) -> None:
        """Pipeline completo deve gerar snapshot com preco_final > 0."""
        mock_enq.return_value = FakeEnquadramentoResult()
        mock_resolver_ficha.return_value = make_ficha_simples()
        mock_aplicar.return_value = make_ficha_simples()
        mock_custo_hora.return_value = make_custo_hora(Decimal("85.50"))

        # MaterialCanonico.objects.get
        mat_mock = MagicMock()
        mat_mock.id = "mat-uuid-0001"
        mock_material_cls.objects.get.return_value = mat_mock
        mock_custo_insumo.return_value = Decimal("120.00")

        mock_rateio.return_value = Decimal("25.30")

        # ServicoCanonico.objects.get
        svc_mock = MagicMock()
        svc_mock.aplica_multiplicador_tamanho = True
        mock_servico_cls.objects.get.return_value = svc_mock

        resultado = MotorPrecificacaoService.calcular_servico(
            self.ctx, "10000000-0000-0000-0000-000000000001", origem="simulacao"
        )

        self.assertIsNotNone(resultado.snapshot_id)
        self.assertGreater(resultado.preco_final, Decimal("0"))
        self.assertTrue(
            CalculoCustoSnapshot.objects.filter(pk=resultado.snapshot_id).exists()
        )

    @patch("apps.pricing_engine.services.motor.EnquadramentoService.resolver")
    @patch("apps.pricing_engine.services.motor.FichaTecnicaService.resolver")
    @patch("apps.pricing_engine.services.motor.FichaTecnicaService.aplicar_multiplicadores")
    @patch("apps.pricing_engine.services.motor.CustoHoraService.obter")
    @patch("apps.pricing_engine.services.motor.MaterialCanonico")
    @patch("apps.pricing_engine.services.motor.CustoInsumoService.custo_base")
    @patch("apps.pricing_engine.services.motor.RateioService.por_hora")
    @patch("apps.pricing_engine.services.motor.ServicoCanonico")
    def test_fator_responsabilidade_altera_margem(
        self,
        mock_servico_cls,
        mock_rateio,
        mock_custo_insumo,
        mock_material_cls,
        mock_custo_hora,
        mock_aplicar,
        mock_resolver_ficha,
        mock_enq,
    ) -> None:
        """Fator de responsabilidade do segmento deve ser multiplicado na margem."""
        # Segmento com fator alto
        self.segmento.fator_responsabilidade = Decimal("0.50")
        self.segmento.save()

        mock_enq.return_value = FakeEnquadramentoResult()
        mock_resolver_ficha.return_value = make_ficha_simples()
        mock_aplicar.return_value = make_ficha_simples()
        mock_custo_hora.return_value = make_custo_hora(Decimal("100.00"))

        mat_mock = MagicMock()
        mat_mock.id = "mat-uuid-0002"
        mock_material_cls.objects.get.return_value = mat_mock
        mock_custo_insumo.return_value = Decimal("100.00")
        mock_rateio.return_value = Decimal("50.00")

        svc_mock = MagicMock()
        svc_mock.aplica_multiplicador_tamanho = False
        mock_servico_cls.objects.get.return_value = svc_mock

        resultado = MotorPrecificacaoService.calcular_servico(
            self.ctx, "10000000-0000-0000-0000-000000000002", origem="simulacao"
        )

        snap = CalculoCustoSnapshot.objects.get(pk=resultado.snapshot_id)
        # margem_ajustada = margem_base × (1 + fator_responsabilidade)
        # = 0.4000 × 1.50 = 0.6000
        self.assertEqual(snap.fator_responsabilidade, Decimal("0.50"))
        self.assertEqual(snap.margem_ajustada, Decimal("0.6000"))

    @patch("apps.pricing_engine.services.motor.EnquadramentoService.resolver")
    @patch("apps.pricing_engine.services.motor.FichaTecnicaService.resolver")
    @patch("apps.pricing_engine.services.motor.FichaTecnicaService.aplicar_multiplicadores")
    @patch("apps.pricing_engine.services.motor.CustoHoraService.obter")
    @patch("apps.pricing_engine.services.motor.MaterialCanonico")
    @patch("apps.pricing_engine.services.motor.CustoInsumoService.custo_base")
    @patch("apps.pricing_engine.services.motor.RateioService.por_hora")
    @patch("apps.pricing_engine.services.motor.ServicoCanonico")
    @patch("apps.pricing_engine.services.motor.BenchmarkService.p90_servico")
    def test_teto_benchmark_limita_preco(
        self,
        mock_benchmark,
        mock_servico_cls,
        mock_rateio,
        mock_custo_insumo,
        mock_material_cls,
        mock_custo_hora,
        mock_aplicar,
        mock_resolver_ficha,
        mock_enq,
    ) -> None:
        """Quando teto < preco_calculado, preco_final deve ser o teto (A7)."""
        mock_enq.return_value = FakeEnquadramentoResult()
        mock_resolver_ficha.return_value = make_ficha_simples()
        mock_aplicar.return_value = make_ficha_simples()
        mock_custo_hora.return_value = make_custo_hora(Decimal("500.00"))  # custo alto

        mat_mock = MagicMock()
        mat_mock.id = "mat-uuid-0003"
        mock_material_cls.objects.get.return_value = mat_mock
        mock_custo_insumo.return_value = Decimal("500.00")
        mock_rateio.return_value = Decimal("200.00")

        svc_mock = MagicMock()
        svc_mock.aplica_multiplicador_tamanho = False
        mock_servico_cls.objects.get.return_value = svc_mock

        # Teto muito menor que o preço calculado
        mock_benchmark.return_value = Decimal("800.00")

        resultado = MotorPrecificacaoService.calcular_servico(
            self.ctx, "10000000-0000-0000-0000-000000000003", origem="simulacao"
        )

        self.assertEqual(resultado.preco_final, Decimal("800.00"))
        self.assertTrue(resultado.teto_aplicado)

    @patch("apps.pricing_engine.services.motor.EnquadramentoService.resolver")
    @patch("apps.pricing_engine.services.motor.FichaTecnicaService.resolver")
    @patch("apps.pricing_engine.services.motor.FichaTecnicaService.aplicar_multiplicadores")
    @patch("apps.pricing_engine.services.motor.CustoHoraService.obter")
    @patch("apps.pricing_engine.services.motor.MaterialCanonico")
    @patch("apps.pricing_engine.services.motor.CustoInsumoService.custo_base")
    @patch("apps.pricing_engine.services.motor.RateioService.por_hora")
    @patch("apps.pricing_engine.services.motor.ServicoCanonico")
    @patch("apps.pricing_engine.services.motor.BenchmarkService.p90_servico")
    def test_teto_benchmark_none_nao_aplica(
        self,
        mock_benchmark,
        mock_servico_cls,
        mock_rateio,
        mock_custo_insumo,
        mock_material_cls,
        mock_custo_hora,
        mock_aplicar,
        mock_resolver_ficha,
        mock_enq,
    ) -> None:
        """Quando benchmark retorna None, preco_final = preco_calculado (sem teto)."""
        mock_enq.return_value = FakeEnquadramentoResult()
        mock_resolver_ficha.return_value = make_ficha_simples()
        mock_aplicar.return_value = make_ficha_simples()
        mock_custo_hora.return_value = make_custo_hora(Decimal("85.50"))

        mat_mock = MagicMock()
        mat_mock.id = "mat-uuid-0004"
        mock_material_cls.objects.get.return_value = mat_mock
        mock_custo_insumo.return_value = Decimal("120.00")
        mock_rateio.return_value = Decimal("25.30")

        svc_mock = MagicMock()
        svc_mock.aplica_multiplicador_tamanho = False
        mock_servico_cls.objects.get.return_value = svc_mock

        mock_benchmark.return_value = None

        resultado = MotorPrecificacaoService.calcular_servico(
            self.ctx, "10000000-0000-0000-0000-000000000004", origem="simulacao"
        )

        snap = CalculoCustoSnapshot.objects.get(pk=resultado.snapshot_id)
        self.assertIsNone(snap.preco_teto_benchmark)
        self.assertFalse(resultado.teto_aplicado)
        self.assertEqual(resultado.preco_final, snap.preco_calculado)

    @patch("apps.pricing_engine.services.motor.EnquadramentoService.resolver")
    @patch("apps.pricing_engine.services.motor.FichaTecnicaService.resolver")
    def test_ficha_nao_encontrada_raise_erro_motor(
        self,
        mock_resolver_ficha,
        mock_enq,
    ) -> None:
        """FichaNaoEncontrada deve ser convertida em ErroMotorPrecificacao."""
        from apps.pricing_tech.services import FichaNaoEncontrada
        mock_enq.return_value = FakeEnquadramentoResult()
        mock_resolver_ficha.side_effect = FichaNaoEncontrada("sem ficha")

        with self.assertRaises(ErroMotorPrecificacao) as ctx_mgr:
            MotorPrecificacaoService.calcular_servico(
                self.ctx, "10000000-0000-0000-0000-000000000005", origem="simulacao"
            )
        self.assertEqual(ctx_mgr.exception.recurso_faltante, "ficha_tecnica")

    @patch("apps.pricing_engine.services.motor.EnquadramentoService.resolver")
    @patch("apps.pricing_engine.services.motor.FichaTecnicaService.resolver")
    @patch("apps.pricing_engine.services.motor.FichaTecnicaService.aplicar_multiplicadores")
    @patch("apps.pricing_engine.services.motor.CustoHoraService.obter")
    @patch("apps.pricing_engine.services.motor.MaterialCanonico")
    @patch("apps.pricing_engine.services.motor.CustoInsumoService.custo_base")
    @patch("apps.pricing_engine.services.motor.RateioService.por_hora")
    @patch("apps.pricing_engine.services.motor.ServicoCanonico")
    def test_grava_snapshot_com_contexto_completo(
        self,
        mock_servico_cls,
        mock_rateio,
        mock_custo_insumo,
        mock_material_cls,
        mock_custo_hora,
        mock_aplicar,
        mock_resolver_ficha,
        mock_enq,
    ) -> None:
        """Snapshot gravado deve conter todos os campos de contexto para re-cálculo (P6)."""
        mock_enq.return_value = FakeEnquadramentoResult(
            segmento_codigo="popular", tamanho_codigo="medio", tipo_pintura_codigo="SOLIDA"
        )
        mock_resolver_ficha.return_value = make_ficha_simples()
        mock_aplicar.return_value = make_ficha_simples()
        mock_custo_hora.return_value = make_custo_hora()

        mat_mock = MagicMock()
        mat_mock.id = "mat-uuid-0006"
        mock_material_cls.objects.get.return_value = mat_mock
        mock_custo_insumo.return_value = Decimal("100.00")
        mock_rateio.return_value = Decimal("25.00")

        svc_mock = MagicMock()
        svc_mock.aplica_multiplicador_tamanho = True
        mock_servico_cls.objects.get.return_value = svc_mock

        resultado = MotorPrecificacaoService.calcular_servico(
            self.ctx, "10000000-0000-0000-0000-000000000006", origem="simulacao"
        )

        snap = CalculoCustoSnapshot.objects.get(pk=resultado.snapshot_id)
        self.assertIn("veiculo", snap.contexto)
        self.assertIn("segmento_codigo", snap.contexto)
        self.assertIn("tamanho_codigo", snap.contexto)
        self.assertEqual(snap.contexto["veiculo"]["marca"], "VW")
        self.assertEqual(snap.contexto["veiculo"]["modelo"], "Gol")
        self.assertIn("ficha_id", snap.decomposicao)
        self.assertIn("mao_obra", snap.decomposicao)


class TestMotorDecimalPrecision(TenantTestCase):
    """Valida que operações monetárias usam Decimal (sem float) — A5/P5."""

    def setUp(self) -> None:
        super().setUp()
        self.empresa = make_empresa("88888888000188")
        self.segmento = make_segmento("popular")
        make_tamanho("medio")
        MargemOperacao.objects.create(
            empresa=self.empresa,
            segmento=self.segmento,
            tipo_operacao="servico_mao_obra",
            margem_percentual=Decimal("0.4000"),
            vigente_desde=date(2024, 1, 1),
        )

    @patch("apps.pricing_engine.services.motor.EnquadramentoService.resolver")
    @patch("apps.pricing_engine.services.motor.FichaTecnicaService.resolver")
    @patch("apps.pricing_engine.services.motor.FichaTecnicaService.aplicar_multiplicadores")
    @patch("apps.pricing_engine.services.motor.CustoHoraService.obter")
    @patch("apps.pricing_engine.services.motor.MaterialCanonico")
    @patch("apps.pricing_engine.services.motor.CustoInsumoService.custo_base")
    @patch("apps.pricing_engine.services.motor.RateioService.por_hora")
    @patch("apps.pricing_engine.services.motor.ServicoCanonico")
    def test_preco_final_e_decimal_nao_float(
        self,
        mock_servico_cls,
        mock_rateio,
        mock_custo_insumo,
        mock_material_cls,
        mock_custo_hora,
        mock_aplicar,
        mock_resolver_ficha,
        mock_enq,
    ) -> None:
        """preco_final deve ser instância de Decimal, nunca float."""
        mock_enq.return_value = FakeEnquadramentoResult()
        mock_resolver_ficha.return_value = make_ficha_simples()
        mock_aplicar.return_value = make_ficha_simples()
        mock_custo_hora.return_value = make_custo_hora(Decimal("85.50"))

        mat_mock = MagicMock()
        mat_mock.id = "mat-uuid-0007"
        mock_material_cls.objects.get.return_value = mat_mock
        mock_custo_insumo.return_value = Decimal("120.00")
        mock_rateio.return_value = Decimal("25.30")

        svc_mock = MagicMock()
        svc_mock.aplica_multiplicador_tamanho = False
        mock_servico_cls.objects.get.return_value = svc_mock

        ctx = ContextoCalculo(
            empresa_id=str(self.empresa.id),
            veiculo_marca="VW",
            veiculo_modelo="Gol",
            veiculo_ano=2018,
        )
        resultado = MotorPrecificacaoService.calcular_servico(
            ctx, "10000000-0000-0000-0000-000000000007", origem="simulacao"
        )

        self.assertIsInstance(resultado.preco_final, Decimal)
        self.assertIsInstance(resultado.custo_total_base, Decimal)
        self.assertIsInstance(resultado.margem_ajustada, Decimal)

    @patch("apps.pricing_engine.services.motor.EnquadramentoService.resolver")
    @patch("apps.pricing_engine.services.motor.FichaTecnicaService.resolver")
    @patch("apps.pricing_engine.services.motor.FichaTecnicaService.aplicar_multiplicadores")
    @patch("apps.pricing_engine.services.motor.CustoHoraService.obter")
    @patch("apps.pricing_engine.services.motor.MaterialCanonico")
    @patch("apps.pricing_engine.services.motor.CustoInsumoService.custo_base")
    @patch("apps.pricing_engine.services.motor.RateioService.por_hora")
    @patch("apps.pricing_engine.services.motor.ServicoCanonico")
    def test_multiplas_linhas_mo_sem_acumulo_de_erro_float(
        self,
        mock_servico_cls,
        mock_rateio,
        mock_custo_insumo,
        mock_material_cls,
        mock_custo_hora,
        mock_aplicar,
        mock_resolver_ficha,
        mock_enq,
    ) -> None:
        """Múltiplas linhas de MO não devem acumular erro de ponto flutuante."""
        ficha_multi = FichaResolvida(
            ficha_id="ficha-multi",
            versao=1,
            maos_obra=[
                {
                    "categoria_codigo": "pintor",
                    "categoria_nome": "Pintor",
                    "horas": Decimal("3.3333"),
                    "afetada_por_tamanho": True,
                },
                {
                    "categoria_codigo": "auxiliar",
                    "categoria_nome": "Auxiliar",
                    "horas": Decimal("1.1111"),
                    "afetada_por_tamanho": False,
                },
            ],
            insumos=[],
        )

        mock_enq.return_value = FakeEnquadramentoResult()
        mock_resolver_ficha.return_value = ficha_multi
        mock_aplicar.return_value = ficha_multi
        mock_custo_hora.return_value = make_custo_hora(Decimal("90.00"))
        mock_custo_insumo.return_value = Decimal("0.00")
        mock_rateio.return_value = Decimal("25.00")

        svc_mock = MagicMock()
        svc_mock.aplica_multiplicador_tamanho = False
        mock_servico_cls.objects.get.return_value = svc_mock

        ctx = ContextoCalculo(
            empresa_id=str(self.empresa.id),
            veiculo_marca="VW",
            veiculo_modelo="Gol",
            veiculo_ano=2018,
        )
        resultado = MotorPrecificacaoService.calcular_servico(
            ctx, "10000000-0000-0000-0000-000000000008", origem="simulacao"
        )

        snap = CalculoCustoSnapshot.objects.get(pk=resultado.snapshot_id)
        # custo_mo deve ter exatamente 2 casas decimais (quantize aplicado)
        self.assertEqual(snap.custo_mo, snap.custo_mo.quantize(Decimal("0.01")))
