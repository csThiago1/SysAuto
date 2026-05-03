"""
Paddock Solutions — Inventory Tests: SaidaEstoqueService
WMS — Testes de registro de perdas de pecas e lotes.

Requer make dev (Docker + PostgreSQL) para rodar.
"""
import hashlib
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.inventory.models_location import Armazem, Nivel, Prateleira, Rua
from apps.inventory.models_movement import MovimentacaoEstoque
from apps.inventory.models_physical import LoteInsumo, UnidadeFisica
from apps.inventory.services.saida import SaidaEstoqueService


# --- Helpers ----------------------------------------------------------------


def make_user(email: str = "saida-test@example.com") -> GlobalUser:
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    user, _ = GlobalUser.objects.get_or_create(
        email_hash=email_hash,
        defaults={"email": email, "name": "Saida Test User"},
    )
    return user


def make_peca_canonica(codigo: str = "peca-saida-001") -> object:
    from apps.pricing_catalog.models import PecaCanonica

    p, _ = PecaCanonica.objects.get_or_create(
        codigo=codigo,
        defaults={"nome": f"Peca {codigo}", "tipo_peca": "genuina"},
    )
    return p


def make_material(codigo: str = "mat-saida-001") -> object:
    from apps.pricing_catalog.models import MaterialCanonico

    m, _ = MaterialCanonico.objects.get_or_create(
        codigo=codigo,
        defaults={"nome": f"Material {codigo}", "unidade_base": "L", "tipo": "consumivel"},
    )
    return m


def make_location() -> tuple[Armazem, Rua, Prateleira, Nivel]:
    armazem = Armazem.objects.create(nome="Galpao Saida", codigo="GS1", tipo="galpao")
    rua = Rua.objects.create(armazem=armazem, codigo="R01", ordem=1)
    prateleira = Prateleira.objects.create(rua=rua, codigo="P01", ordem=1)
    nivel = Nivel.objects.create(prateleira=prateleira, codigo="N1", ordem=1)
    return armazem, rua, prateleira, nivel


# --- Tests ------------------------------------------------------------------


class TestRegistrarPerdaUnidade(TenantTestCase):
    """Testa registro de perda de UnidadeFisica."""

    def setUp(self) -> None:
        self.user = make_user()
        _, _, _, self.nivel = make_location()
        self.peca = make_peca_canonica("peca-perda-001")

    def test_registrar_perda_unidade_status_lost(self) -> None:
        """Perda deve mudar status para lost + criar MovimentacaoEstoque(SAIDA_PERDA)."""
        unidade = UnidadeFisica.objects.create(
            peca_canonica=self.peca,
            valor_nf=Decimal("100.00"),
            status=UnidadeFisica.Status.AVAILABLE,
            nivel=self.nivel,
        )

        mov = SaidaEstoqueService.registrar_perda_unidade(
            unidade_fisica_id=unidade.pk,
            motivo="Avaria no transporte",
            user_id=self.user.pk,
        )

        unidade.refresh_from_db()
        self.assertEqual(unidade.status, UnidadeFisica.Status.LOST)
        self.assertEqual(mov.tipo, MovimentacaoEstoque.Tipo.SAIDA_PERDA)
        self.assertEqual(mov.nivel_origem, self.nivel)

    def test_registrar_perda_unidade_motivo_obrigatorio(self) -> None:
        """Motivo vazio deve levantar ValueError."""
        unidade = UnidadeFisica.objects.create(
            peca_canonica=self.peca,
            valor_nf=Decimal("100.00"),
            status=UnidadeFisica.Status.AVAILABLE,
            nivel=self.nivel,
        )

        with self.assertRaises(ValueError):
            SaidaEstoqueService.registrar_perda_unidade(
                unidade_fisica_id=unidade.pk,
                motivo="   ",
                user_id=self.user.pk,
            )


class TestRegistrarPerdaLote(TenantTestCase):
    """Testa registro de perda em LoteInsumo."""

    def setUp(self) -> None:
        self.user = make_user()
        _, _, _, self.nivel = make_location()
        self.material = make_material("mat-perda-001")

    def _make_lote(self, saldo: str = "10.000") -> LoteInsumo:
        qtd = Decimal(saldo)
        return LoteInsumo.objects.create(
            material_canonico=self.material,
            unidade_compra="GL",
            quantidade_compra=Decimal("2.000"),
            fator_conversao=Decimal("5.0000"),
            quantidade_base=qtd,
            saldo=qtd,
            valor_total_nf=qtd * Decimal("50.0000"),
            valor_unitario_base=Decimal("50.0000"),
            nivel=self.nivel,
        )

    def test_registrar_perda_lote_debita_saldo(self) -> None:
        """Perda parcial deve debitar saldo do lote."""
        lote = self._make_lote("10.000")

        mov = SaidaEstoqueService.registrar_perda_lote(
            lote_insumo_id=lote.pk,
            quantidade_perdida=Decimal("3.000"),
            motivo="Vazamento",
            user_id=self.user.pk,
        )

        lote.refresh_from_db()
        self.assertEqual(lote.saldo, Decimal("7.000"))
        self.assertEqual(mov.tipo, MovimentacaoEstoque.Tipo.SAIDA_PERDA)
        self.assertEqual(mov.quantidade, Decimal("3.000"))

    def test_registrar_perda_lote_quantidade_maior_que_saldo_erro(self) -> None:
        """Quantidade perdida maior que saldo deve levantar ValueError."""
        lote = self._make_lote("5.000")

        with self.assertRaises(ValueError):
            SaidaEstoqueService.registrar_perda_lote(
                lote_insumo_id=lote.pk,
                quantidade_perdida=Decimal("8.000"),
                motivo="Perda total impossivel",
                user_id=self.user.pk,
            )
