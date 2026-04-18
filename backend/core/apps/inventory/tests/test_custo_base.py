"""
Paddock Solutions — Inventory Tests: CustoPecaService + CustoInsumoService
Motor de Orçamentos (MO) — Sprint MO-5

ARMADILHA A2: custo de peça inclui unidades RESERVADAS (teste explícito).
Requer make dev (Docker + PostgreSQL) para rodar.
"""
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.inventory.models import LoteInsumo, UnidadeFisica
from apps.pricing_engine.services.custo_base import (
    CustoBaseIndisponivel,
    CustoInsumoService,
    CustoPecaService,
)


def make_peca(codigo: str = "peca-custo-001") -> object:
    from apps.pricing_catalog.models import PecaCanonica
    p, _ = PecaCanonica.objects.get_or_create(
        codigo=codigo,
        defaults={"nome": f"Peça {codigo}", "tipo_peca": "genuina"},
    )
    return p


def make_material(codigo: str = "mat-custo-001") -> object:
    from apps.pricing_catalog.models import MaterialCanonico
    m, _ = MaterialCanonico.objects.get_or_create(
        codigo=codigo,
        defaults={"nome": f"Material {codigo}", "unidade_base": "L", "tipo": "consumivel"},
    )
    return m


class TestCustoPecaService(TenantTestCase):

    def test_custo_peca_retorna_max_valor_nf(self) -> None:
        """Deve retornar o maior valor_nf das unidades disponíveis."""
        peca = make_peca("peca-max-001")
        UnidadeFisica.objects.create(peca_canonica=peca, valor_nf=Decimal("100.00"), status="available")
        UnidadeFisica.objects.create(peca_canonica=peca, valor_nf=Decimal("150.00"), status="available")
        UnidadeFisica.objects.create(peca_canonica=peca, valor_nf=Decimal("120.00"), status="available")

        custo = CustoPecaService.custo_base(str(peca.pk))
        self.assertEqual(custo, Decimal("150.00"))

    def test_custo_peca_inclui_reservadas_armadilha_a2(self) -> None:
        """A2: custo DEVE incluir unidades reservadas — crítico para precificação correta."""
        peca = make_peca("peca-reservada-001")
        # Unidade cara reservada (ordem_servico=None é válido) — sem ela o custo seria subestimado
        UnidadeFisica.objects.create(
            peca_canonica=peca, valor_nf=Decimal("500.00"),
            status="reserved",  # ordem_servico nullable: OK para teste
        )
        UnidadeFisica.objects.create(
            peca_canonica=peca, valor_nf=Decimal("300.00"), status="available"
        )

        custo = CustoPecaService.custo_base(str(peca.pk))
        # Deve retornar 500 (da reservada), não 300 (só da disponível)
        self.assertEqual(custo, Decimal("500.00"))

    def test_custo_peca_ignora_consumidas(self) -> None:
        """Unidades consumed/lost não entram no custo base."""
        peca = make_peca("peca-consumida-001")
        UnidadeFisica.objects.create(peca_canonica=peca, valor_nf=Decimal("999.00"), status="consumed")

        with self.assertRaises(CustoBaseIndisponivel):
            CustoPecaService.custo_base(str(peca.pk))

    def test_custo_peca_sem_unidades_raises(self) -> None:
        peca = make_peca("peca-vazia-001")
        with self.assertRaises(CustoBaseIndisponivel):
            CustoPecaService.custo_base(str(peca.pk))


class TestCustoInsumoService(TenantTestCase):

    def _make_lote(self, material: object, saldo: str, valor: str) -> LoteInsumo:
        qtd = Decimal(saldo)
        return LoteInsumo.objects.create(
            material_canonico=material,
            unidade_compra="L",
            quantidade_compra=qtd,
            fator_conversao=Decimal("1.0000"),
            quantidade_base=qtd,
            saldo=qtd,
            valor_total_nf=qtd * Decimal(valor),
            valor_unitario_base=Decimal(valor),
        )

    def test_custo_insumo_retorna_max_valor_unit_base(self) -> None:
        material = make_material("mat-max-001")
        self._make_lote(material, "5.000", "40.0000")
        self._make_lote(material, "3.000", "70.0000")
        self._make_lote(material, "8.000", "55.0000")

        custo = CustoInsumoService.custo_base(str(material.pk))
        self.assertEqual(custo, Decimal("70.0000"))

    def test_custo_insumo_ignora_saldo_zero(self) -> None:
        """Lotes com saldo=0 não entram no custo base."""
        material = make_material("mat-zero-001")
        self._make_lote(material, "0.000", "999.0000")  # saldo=0, valor alto

        with self.assertRaises(CustoBaseIndisponivel):
            CustoInsumoService.custo_base(str(material.pk))

    def test_saldo_disponivel_soma_lotes_positivos(self) -> None:
        material = make_material("mat-saldo-001")
        self._make_lote(material, "5.000", "50.0000")
        self._make_lote(material, "3.000", "60.0000")

        saldo = CustoInsumoService.saldo_disponivel(str(material.pk))
        self.assertEqual(saldo, Decimal("8.000"))
