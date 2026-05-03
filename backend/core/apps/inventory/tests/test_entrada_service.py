"""
Paddock Solutions — Inventory Tests: EntradaEstoqueService
WMS — Testes de entrada manual e devolucao.

Requer make dev (Docker + PostgreSQL) para rodar.
"""
import hashlib
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.inventory.models_location import Armazem, Nivel, Prateleira, Rua
from apps.inventory.models_movement import MovimentacaoEstoque
from apps.inventory.models_physical import LoteInsumo, UnidadeFisica
from apps.inventory.services.entrada import EntradaEstoqueService


# --- Helpers ----------------------------------------------------------------


def make_user(email: str = "entrada-test@example.com") -> GlobalUser:
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    user, _ = GlobalUser.objects.get_or_create(
        email_hash=email_hash,
        defaults={"email": email, "name": "Entrada Test User"},
    )
    return user


def make_peca_canonica(codigo: str = "peca-ent-001") -> object:
    from apps.pricing_catalog.models import PecaCanonica

    p, _ = PecaCanonica.objects.get_or_create(
        codigo=codigo,
        defaults={"nome": f"Peca {codigo}", "tipo_peca": "genuina"},
    )
    return p


def make_material(codigo: str = "mat-ent-001") -> object:
    from apps.pricing_catalog.models import MaterialCanonico

    m, _ = MaterialCanonico.objects.get_or_create(
        codigo=codigo,
        defaults={"nome": f"Material {codigo}", "unidade_base": "L", "tipo": "consumivel"},
    )
    return m


def make_location() -> tuple[Armazem, Rua, Prateleira, Nivel]:
    armazem = Armazem.objects.create(nome="Galpao Entrada", codigo="GE1", tipo="galpao")
    rua = Rua.objects.create(armazem=armazem, codigo="R01", ordem=1)
    prateleira = Prateleira.objects.create(rua=rua, codigo="P01", ordem=1)
    nivel = Nivel.objects.create(prateleira=prateleira, codigo="N1", ordem=1)
    return armazem, rua, prateleira, nivel


def make_service_order(number: int = 9010) -> object:
    from apps.service_orders.models import ServiceOrder

    os, _ = ServiceOrder.objects.get_or_create(
        number=number,
        defaults={
            "customer_name": "Cliente Entrada Teste",
            "plate": "ENT0001",
            "make": "Honda",
            "model": "Civic",
            "color": "Preto",
            "vehicle_location": "Patio",
            "status": "open",
        },
    )
    return os


# --- Tests ------------------------------------------------------------------


class TestEntradaManualPeca(TenantTestCase):
    """Testa entrada manual de pecas."""

    def setUp(self) -> None:
        self.user = make_user()
        _, _, _, self.nivel = make_location()
        self.peca = make_peca_canonica("peca-ent-manual-001")

    def test_entrada_manual_peca_cria_unidade_e_movimentacao(self) -> None:
        """Deve criar UnidadeFisica + MovimentacaoEstoque(ENTRADA_MANUAL)."""
        unidade = EntradaEstoqueService.entrada_manual_peca(
            peca_canonica_id=self.peca.pk,
            valor_nf=Decimal("150.00"),
            nivel_id=self.nivel.pk,
            user_id=self.user.pk,
            motivo="Entrada avulsa teste",
        )

        self.assertIsNotNone(unidade.pk)
        self.assertEqual(unidade.status, UnidadeFisica.Status.AVAILABLE)
        self.assertEqual(unidade.valor_nf, Decimal("150.00"))

        mov = MovimentacaoEstoque.objects.filter(
            unidade_fisica=unidade,
            tipo=MovimentacaoEstoque.Tipo.ENTRADA_MANUAL,
        ).first()
        self.assertIsNotNone(mov)
        self.assertEqual(mov.nivel_destino, self.nivel)
        self.assertEqual(mov.realizado_por_id, self.user.pk)

    def test_entrada_manual_peca_posicionada_no_nivel(self) -> None:
        """Unidade criada deve ter FK nivel corretamente preenchido."""
        unidade = EntradaEstoqueService.entrada_manual_peca(
            peca_canonica_id=self.peca.pk,
            valor_nf=Decimal("200.00"),
            nivel_id=self.nivel.pk,
            user_id=self.user.pk,
            motivo="Posicao teste",
        )

        self.assertEqual(unidade.nivel, self.nivel)


class TestEntradaManualLote(TenantTestCase):
    """Testa entrada manual de lotes de insumo."""

    def setUp(self) -> None:
        self.user = make_user()
        _, _, _, self.nivel = make_location()
        self.material = make_material("mat-ent-manual-001")

    def test_entrada_manual_lote_cria_lote_e_movimentacao(self) -> None:
        """Deve criar LoteInsumo + MovimentacaoEstoque(ENTRADA_MANUAL)."""
        lote = EntradaEstoqueService.entrada_manual_lote(
            material_canonico_id=self.material.pk,
            quantidade_compra=Decimal("2.000"),
            unidade_compra="GL",
            fator_conversao=Decimal("5.0000"),
            valor_total_nf=Decimal("500.00"),
            nivel_id=self.nivel.pk,
            user_id=self.user.pk,
            motivo="Entrada lote teste",
        )

        self.assertIsNotNone(lote.pk)
        self.assertEqual(lote.quantidade_base, Decimal("10.000"))
        self.assertEqual(lote.saldo, Decimal("10.000"))

        mov = MovimentacaoEstoque.objects.filter(
            lote_insumo=lote,
            tipo=MovimentacaoEstoque.Tipo.ENTRADA_MANUAL,
        ).first()
        self.assertIsNotNone(mov)
        self.assertEqual(mov.quantidade, Decimal("10.000"))

    def test_entrada_manual_lote_calcula_valor_unitario_base(self) -> None:
        """valor_unitario_base deve ser valor_total_nf / quantidade_base."""
        lote = EntradaEstoqueService.entrada_manual_lote(
            material_canonico_id=self.material.pk,
            quantidade_compra=Decimal("4.000"),
            unidade_compra="GL",
            fator_conversao=Decimal("2.5000"),
            valor_total_nf=Decimal("1000.00"),
            nivel_id=self.nivel.pk,
            user_id=self.user.pk,
            motivo="Calculo valor unitario",
        )

        lote.refresh_from_db()
        # quantidade_base = 4 * 2.5 = 10, valor_unitario_base = 1000 / 10 = 100
        self.assertEqual(lote.valor_unitario_base, Decimal("100.0000"))


class TestRegistrarDevolucao(TenantTestCase):
    """Testa devolucao de pecas consumed -> available."""

    def setUp(self) -> None:
        self.user = make_user()
        _, _, _, self.nivel = make_location()
        self.peca = make_peca_canonica("peca-dev-001")
        self.os = make_service_order(9011)

    def test_registrar_devolucao_status_consumed_para_available(self) -> None:
        """Peca consumed devolvida deve virar available + MovimentacaoEstoque(ENTRADA_DEVOLUCAO)."""
        unidade = UnidadeFisica.objects.create(
            peca_canonica=self.peca,
            valor_nf=Decimal("100.00"),
            status=UnidadeFisica.Status.CONSUMED,
            ordem_servico=self.os,
            nivel=self.nivel,
        )

        mov = EntradaEstoqueService.registrar_devolucao(
            unidade_fisica_id=unidade.pk,
            nivel_destino_id=self.nivel.pk,
            user_id=self.user.pk,
            motivo="Peca errada",
        )

        unidade.refresh_from_db()
        self.assertEqual(unidade.status, UnidadeFisica.Status.AVAILABLE)
        self.assertEqual(mov.tipo, MovimentacaoEstoque.Tipo.ENTRADA_DEVOLUCAO)
        self.assertIsNone(unidade.ordem_servico)

    def test_registrar_devolucao_rejeita_unidade_nao_consumed(self) -> None:
        """Tentar devolver unidade available deve levantar ValueError."""
        unidade = UnidadeFisica.objects.create(
            peca_canonica=self.peca,
            valor_nf=Decimal("100.00"),
            status=UnidadeFisica.Status.AVAILABLE,
            nivel=self.nivel,
        )

        with self.assertRaises(ValueError):
            EntradaEstoqueService.registrar_devolucao(
                unidade_fisica_id=unidade.pk,
                nivel_destino_id=self.nivel.pk,
                user_id=self.user.pk,
                motivo="Tentativa invalida",
            )
