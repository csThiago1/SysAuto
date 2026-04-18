"""
Paddock Solutions — Inventory Tests: LoteInsumo + BaixaInsumoService
Motor de Orçamentos (MO) — Sprint MO-5

Requer make dev (Docker + PostgreSQL) para rodar.
"""
from decimal import Decimal

import pytest
from django_tenants.test.cases import TenantTestCase

from apps.inventory.models import ConsumoInsumo, LoteInsumo
from apps.inventory.services.reserva import BaixaInsumoService, ReservaIndisponivel


# ─── Helpers ──────────────────────────────────────────────────────────────────


def make_material(codigo: str = "tinta-branca-001") -> object:
    from apps.pricing_catalog.models import MaterialCanonico
    m, _ = MaterialCanonico.objects.get_or_create(
        codigo=codigo,
        defaults={"nome": f"Material {codigo}", "unidade_base": "L", "tipo": "consumivel"},
    )
    return m


def make_lote(
    material: object,
    saldo: str = "10.000",
    valor_unitario_base: str = "50.0000",
) -> LoteInsumo:
    qtd = Decimal(saldo)
    return LoteInsumo.objects.create(
        material_canonico=material,
        unidade_compra="GL",
        quantidade_compra=Decimal("2.000"),
        fator_conversao=Decimal("5.0000"),
        quantidade_base=qtd,
        saldo=qtd,
        valor_total_nf=qtd * Decimal(valor_unitario_base),
        valor_unitario_base=Decimal(valor_unitario_base),
    )


def make_service_order(number: int = 9002) -> object:
    from apps.service_orders.models import ServiceOrder
    os, _ = ServiceOrder.objects.get_or_create(
        number=number,
        defaults={
            "customer_name": "Cliente Lote Teste",
            "plate": "LOT0001",
            "make": "Fiat",
            "model": "Palio",
            "color": "Prata",
            "vehicle_location": "Pátio",
            "status": "open",
        },
    )
    return os


# ─── Tests ────────────────────────────────────────────────────────────────────


class TestLoteInsumoModelo(TenantTestCase):

    def test_codigo_barras_gerado_automaticamente(self) -> None:
        material = make_material("mat-barras-001")
        lote = make_lote(material)
        self.assertTrue(lote.codigo_barras.startswith("L"))
        self.assertEqual(len(lote.codigo_barras), 33)  # "L" + 32 hex chars

    def test_valor_unitario_base_calculado_no_save(self) -> None:
        """valor_unitario_base = valor_total_nf / quantidade_base."""
        material = make_material("mat-calc-001")
        lote = LoteInsumo.objects.create(
            material_canonico=material,
            unidade_compra="GL",
            quantidade_compra=Decimal("2.000"),
            fator_conversao=Decimal("5.0000"),
            quantidade_base=Decimal("10.000"),
            saldo=Decimal("10.000"),
            valor_total_nf=Decimal("500.00"),
            valor_unitario_base=Decimal("0"),  # será recalculado no save
        )
        lote.refresh_from_db()
        self.assertEqual(lote.valor_unitario_base, Decimal("50.0000"))

    def test_saldo_nao_pode_ficar_negativo_constraint(self) -> None:
        """Constraint de DB deve bloquear saldo negativo."""
        from django.db import IntegrityError
        material = make_material("mat-negativo-001")
        lote = make_lote(material, saldo="5.000")
        with self.assertRaises(IntegrityError):
            lote.saldo = Decimal("-1.000")
            lote.save(update_fields=["saldo"])


class TestBaixaInsumoService(TenantTestCase):

    def setUp(self) -> None:
        self.os = make_service_order(9002)
        self.os_id = str(self.os.pk)

    def test_baixa_fifo_ordem_criacao(self) -> None:
        """Deve consumir o lote mais antigo primeiro (FIFO)."""
        material = make_material("mat-fifo-001")
        lote1 = make_lote(material, saldo="5.000", valor_unitario_base="40.0000")
        lote2 = make_lote(material, saldo="5.000", valor_unitario_base="60.0000")

        BaixaInsumoService.baixar(
            material_canonico_id=str(material.pk),
            quantidade_base=Decimal("3.000"),
            ordem_servico_id=self.os_id,
        )

        lote1.refresh_from_db()
        lote2.refresh_from_db()
        self.assertEqual(lote1.saldo, Decimal("2.000"))  # consumiu do mais antigo
        self.assertEqual(lote2.saldo, Decimal("5.000"))  # intacto

    def test_baixa_atravessa_multiplos_lotes(self) -> None:
        """Deve atravessar lotes até zerar a quantidade pedida."""
        material = make_material("mat-multi-001")
        lote1 = make_lote(material, saldo="3.000")
        lote2 = make_lote(material, saldo="10.000")

        consumos = BaixaInsumoService.baixar(
            material_canonico_id=str(material.pk),
            quantidade_base=Decimal("7.000"),
            ordem_servico_id=self.os_id,
        )

        self.assertEqual(len(consumos), 2)
        lote1.refresh_from_db()
        lote2.refresh_from_db()
        self.assertEqual(lote1.saldo, Decimal("0.000"))
        self.assertEqual(lote2.saldo, Decimal("6.000"))

    def test_baixa_quantidade_insuficiente_raises(self) -> None:
        """Deve levantar ReservaIndisponivel se saldo total insuficiente."""
        material = make_material("mat-insuf-001")
        make_lote(material, saldo="2.000")

        with self.assertRaises(ReservaIndisponivel):
            BaixaInsumoService.baixar(
                material_canonico_id=str(material.pk),
                quantidade_base=Decimal("10.000"),
                ordem_servico_id=self.os_id,
            )

    def test_valor_unitario_na_baixa_e_snapshot(self) -> None:
        """P8: o valor registrado no consumo é o valor do lote no momento da baixa."""
        material = make_material("mat-snapshot-001")
        lote = make_lote(material, saldo="5.000", valor_unitario_base="75.5000")

        consumos = BaixaInsumoService.baixar(
            material_canonico_id=str(material.pk),
            quantidade_base=Decimal("2.000"),
            ordem_servico_id=self.os_id,
        )
        self.assertEqual(consumos[0].valor_unitario_na_baixa, Decimal("75.5000"))
