"""
Paddock Solutions — Pricing Engine — Tests: MargemResolver
Motor de Orçamentos (MO) — Sprint MO-6: Motor de Precificação

Testa MargemResolver.para_servico() e para_peca() com dados reais no banco.
"""
from datetime import date, timedelta
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.pricing_engine.models import MargemOperacao, MarkupPeca
from apps.pricing_engine.services.margem import MargemNaoDefinida, MargemResolver
from apps.pricing_profile.models import Empresa, SegmentoVeicular


def make_empresa(cnpj: str = "11111111000191") -> Empresa:
    return Empresa.objects.create(
        cnpj=cnpj,
        nome_fantasia=f"Empresa Margem {cnpj[:4]}",
        razao_social=f"Empresa Margem Ltda {cnpj}",
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


def make_margem(
    empresa: Empresa,
    segmento: SegmentoVeicular,
    tipo: str = "servico_mao_obra",
    margem: Decimal = Decimal("0.4000"),
    vigente_desde: date | None = None,
    vigente_ate: date | None = None,
) -> MargemOperacao:
    return MargemOperacao.objects.create(
        empresa=empresa,
        segmento=segmento,
        tipo_operacao=tipo,
        margem_percentual=margem,
        vigente_desde=vigente_desde or date(2024, 1, 1),
        vigente_ate=vigente_ate,
    )


class TestMargemResolverServico(TenantTestCase):
    """Testa MargemResolver.para_servico()."""

    def setUp(self) -> None:
        super().setUp()
        self.empresa = make_empresa("22222222000100")
        self.segmento = make_segmento("popular")

    def test_vigencia_corrente_escolhida(self) -> None:
        """Retorna a margem vigente para hoje."""
        make_margem(
            self.empresa, self.segmento,
            margem=Decimal("0.4000"),
            vigente_desde=date(2024, 1, 1),
        )
        resultado = MargemResolver.para_servico(
            str(self.empresa.id), "popular"
        )
        self.assertEqual(resultado, Decimal("0.4000"))

    def test_sem_margem_vigente_raise(self) -> None:
        """Sem MargemOperacao vigente, levanta MargemNaoDefinida."""
        with self.assertRaises(MargemNaoDefinida):
            MargemResolver.para_servico(str(self.empresa.id), "popular")

    def test_margem_expirada_nao_e_selecionada(self) -> None:
        """Margem com vigente_ate < hoje não é selecionada."""
        ontem = date.today() - timedelta(days=1)
        make_margem(
            self.empresa, self.segmento,
            margem=Decimal("0.3500"),
            vigente_desde=date(2024, 1, 1),
            vigente_ate=ontem,
        )
        with self.assertRaises(MargemNaoDefinida):
            MargemResolver.para_servico(str(self.empresa.id), "popular")

    def test_margem_mais_recente_selecionada(self) -> None:
        """Entre duas vigentes, a mais recente (vigente_desde maior) prevalece."""
        make_margem(
            self.empresa, self.segmento,
            margem=Decimal("0.3000"),
            vigente_desde=date(2024, 1, 1),
        )
        make_margem(
            self.empresa, self.segmento,
            margem=Decimal("0.4500"),
            vigente_desde=date(2024, 6, 1),
        )
        resultado = MargemResolver.para_servico(str(self.empresa.id), "popular")
        self.assertEqual(resultado, Decimal("0.4500"))

    def test_segmento_diferente_nao_e_retornado(self) -> None:
        """Margem de outro segmento não é retornada para o segmento consultado."""
        seg_premium = make_segmento("premium")
        make_margem(self.empresa, seg_premium, margem=Decimal("0.5000"))

        with self.assertRaises(MargemNaoDefinida):
            MargemResolver.para_servico(str(self.empresa.id), "popular")


class TestMargemResolverPeca(TenantTestCase):
    """Testa MargemResolver.para_peca() — hierarquia: específica > faixa > segmento."""

    def setUp(self) -> None:
        super().setUp()
        self.empresa = make_empresa("33333333000133")
        self.segmento = make_segmento("popular")
        # Margem default peca_revenda para o segmento
        make_margem(
            self.empresa, self.segmento,
            tipo="peca_revenda",
            margem=Decimal("0.3000"),
        )

    def test_fallback_margem_segmento_peca(self) -> None:
        """Sem markup específico ou faixa, usa margem de peca_revenda do segmento."""
        peca_id = "00000000-0000-0000-0000-000000000001"
        custo = Decimal("100.00")
        resultado = MargemResolver.para_peca(
            str(self.empresa.id), "popular", peca_id, custo
        )
        self.assertEqual(resultado, Decimal("0.3000"))

    def test_faixa_com_custo_dentro_do_range(self) -> None:
        """MarkupPeca de faixa que engloba o custo base é selecionado."""
        from apps.pricing_catalog.models import PecaCanonica
        MarkupPeca.objects.create(
            empresa=self.empresa,
            peca_canonica=None,
            faixa_custo_min=Decimal("50.00"),
            faixa_custo_max=Decimal("200.00"),
            margem_percentual=Decimal("0.4500"),
            vigente_desde=date(2024, 1, 1),
        )
        custo = Decimal("100.00")
        peca_id = "00000000-0000-0000-0000-000000000002"
        resultado = MargemResolver.para_peca(
            str(self.empresa.id), "popular", peca_id, custo
        )
        self.assertEqual(resultado, Decimal("0.4500"))

    def test_faixa_fora_do_range_nao_aplicada(self) -> None:
        """MarkupPeca de faixa que não engloba o custo base não é selecionado."""
        MarkupPeca.objects.create(
            empresa=self.empresa,
            peca_canonica=None,
            faixa_custo_min=Decimal("500.00"),
            faixa_custo_max=Decimal("1000.00"),
            margem_percentual=Decimal("0.2500"),
            vigente_desde=date(2024, 1, 1),
        )
        custo = Decimal("100.00")
        peca_id = "00000000-0000-0000-0000-000000000003"
        # Deve cair no fallback segmento
        resultado = MargemResolver.para_peca(
            str(self.empresa.id), "popular", peca_id, custo
        )
        self.assertEqual(resultado, Decimal("0.3000"))

    def test_sem_margem_peca_revenda_raise(self) -> None:
        """Sem MargemOperacao peca_revenda e sem markup, levanta MargemNaoDefinida."""
        empresa2 = make_empresa("44444444000155")
        peca_id = "00000000-0000-0000-0000-000000000004"
        custo = Decimal("100.00")
        with self.assertRaises(MargemNaoDefinida):
            MargemResolver.para_peca(
                str(empresa2.id), "popular", peca_id, custo
            )
