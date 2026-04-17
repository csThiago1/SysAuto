"""
Paddock Solutions — Pricing Engine — Tests: RateioService
Motor de Orçamentos (MO) — Sprint 03: Adapters de Custo

Testa RateioService.por_hora() com ParametroRateio e DespesaRecorrente reais no banco.
"""
from datetime import date
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.pricing_engine.models import ParametroRateio
from apps.pricing_engine.services import ParametroRateioNaoDefinido, RateioService
from apps.pricing_profile.models import Empresa


def make_empresa(
    cnpj: str = "33333333000133",
    nome_fantasia: str = "DS Car Rateio",
) -> Empresa:
    """Cria uma Empresa de teste."""
    return Empresa.objects.create(
        cnpj=cnpj,
        nome_fantasia=nome_fantasia,
        razao_social=f"Empresa Rateio Ltda — {cnpj}",
    )


class TestRateioServiceSemParametro(TenantTestCase):
    """Testa que RateioService levanta exceção quando não há parâmetro."""

    def setUp(self) -> None:
        super().setUp()
        self.empresa = make_empresa()
        self.data = date(2024, 6, 15)

    def test_parametro_rateio_nao_definido_sem_parametro(self) -> None:
        """Sem ParametroRateio cadastrado, deve levantar ParametroRateioNaoDefinido."""
        with self.assertRaises(ParametroRateioNaoDefinido):
            RateioService.por_hora(self.data, str(self.empresa.id))

    def test_parametro_rateio_nao_definido_fora_de_vigencia(self) -> None:
        """ParametroRateio vencido antes da data não deve ser encontrado."""
        ParametroRateio.objects.create(
            empresa=self.empresa,
            vigente_desde=date(2023, 1, 1),
            vigente_ate=date(2023, 12, 31),  # venceu antes de 2024-06-15
            horas_produtivas_mes=Decimal("168.00"),
            metodo="por_hora",
        )

        with self.assertRaises(ParametroRateioNaoDefinido):
            RateioService.por_hora(self.data, str(self.empresa.id))


class TestRateioServiceComParametro(TenantTestCase):
    """Testa RateioService.por_hora() com ParametroRateio vigente."""

    def setUp(self) -> None:
        super().setUp()
        self.empresa = make_empresa(cnpj="44444444000144")
        self.data = date(2024, 6, 15)

    def test_rateio_zero_quando_sem_despesas(self) -> None:
        """Com ParametroRateio válido e sem despesas, rateio = 0 / horas = Decimal('0.0000')."""
        ParametroRateio.objects.create(
            empresa=self.empresa,
            vigente_desde=date(2024, 1, 1),
            vigente_ate=None,
            horas_produtivas_mes=Decimal("168.00"),
            metodo="por_hora",
        )

        resultado = RateioService.por_hora(self.data, str(self.empresa.id))

        self.assertEqual(resultado, Decimal("0.0000"))

    def test_rateio_calculo_correto_com_despesas_mockadas(self) -> None:
        """Com total_despesas=1680 e horas=168, rateio=10.0000."""
        from unittest.mock import patch

        ParametroRateio.objects.create(
            empresa=self.empresa,
            vigente_desde=date(2024, 1, 1),
            vigente_ate=None,
            horas_produtivas_mes=Decimal("168.00"),
            metodo="por_hora",
        )

        with patch(
            "apps.pricing_engine.services.rateio.DespesaRecorrenteService.total_vigente",
            return_value=Decimal("1680.00"),
        ):
            resultado = RateioService.por_hora(self.data, str(self.empresa.id))

        # 1680 / 168 = 10.0000
        self.assertEqual(resultado, Decimal("10.0000"))

    def test_rateio_usa_parametro_mais_recente_dentro_vigencia(self) -> None:
        """Quando há múltiplos ParametroRateio vigentes, deve usar o mais recente."""
        from unittest.mock import patch

        ParametroRateio.objects.create(
            empresa=self.empresa,
            vigente_desde=date(2023, 6, 1),
            vigente_ate=None,
            horas_produtivas_mes=Decimal("160.00"),
            metodo="por_hora",
        )
        ParametroRateio.objects.create(
            empresa=self.empresa,
            vigente_desde=date(2024, 3, 1),
            vigente_ate=None,
            horas_produtivas_mes=Decimal("200.00"),  # mais recente
            metodo="por_hora",
        )

        with patch(
            "apps.pricing_engine.services.rateio.DespesaRecorrenteService.total_vigente",
            return_value=Decimal("2000.00"),
        ):
            resultado = RateioService.por_hora(self.data, str(self.empresa.id))

        # Deve usar 200h: 2000 / 200 = 10.0000
        self.assertEqual(resultado, Decimal("10.0000"))

    def test_rateio_nao_definido_quando_empresa_diferente(self) -> None:
        """ParametroRateio de outra empresa não deve ser utilizado."""
        outra_empresa = make_empresa(cnpj="55555555000155", nome_fantasia="Outra Empresa")
        ParametroRateio.objects.create(
            empresa=outra_empresa,
            vigente_desde=date(2024, 1, 1),
            vigente_ate=None,
            horas_produtivas_mes=Decimal("168.00"),
            metodo="por_hora",
        )

        with self.assertRaises(ParametroRateioNaoDefinido):
            RateioService.por_hora(self.data, str(self.empresa.id))
