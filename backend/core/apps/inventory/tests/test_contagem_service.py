"""
Paddock Solutions — Inventory Tests: ContagemService
WMS — Testes de contagem de inventario (ciclica e total).

Requer make dev (Docker + PostgreSQL) para rodar.
"""
import hashlib
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.inventory.models_counting import ContagemInventario, ItemContagem
from apps.inventory.models_location import Armazem, Nivel, Prateleira, Rua
from apps.inventory.models_movement import MovimentacaoEstoque
from apps.inventory.models_physical import LoteInsumo, UnidadeFisica
from apps.inventory.services.contagem import ContagemService


# --- Helpers ----------------------------------------------------------------


def make_user(email: str = "contagem-test@example.com") -> GlobalUser:
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    user, _ = GlobalUser.objects.get_or_create(
        email_hash=email_hash,
        defaults={"email": email, "name": "Contagem Test User"},
    )
    return user


def make_peca_canonica(codigo: str = "peca-cont-001") -> object:
    from apps.pricing_catalog.models import PecaCanonica

    p, _ = PecaCanonica.objects.get_or_create(
        codigo=codigo,
        defaults={"nome": f"Peca {codigo}", "tipo_peca": "genuina"},
    )
    return p


def make_material(codigo: str = "mat-cont-001") -> object:
    from apps.pricing_catalog.models import MaterialCanonico

    m, _ = MaterialCanonico.objects.get_or_create(
        codigo=codigo,
        defaults={"nome": f"Material {codigo}", "unidade_base": "L", "tipo": "consumivel"},
    )
    return m


def make_location() -> tuple[Armazem, Rua, Prateleira, Nivel]:
    armazem = Armazem.objects.create(nome="Galpao Contagem", codigo="GC1", tipo="galpao")
    rua = Rua.objects.create(armazem=armazem, codigo="R01", ordem=1)
    prateleira = Prateleira.objects.create(rua=rua, codigo="P01", ordem=1)
    nivel = Nivel.objects.create(prateleira=prateleira, codigo="N1", ordem=1)
    return armazem, rua, prateleira, nivel


def make_unidade(peca: object, nivel: Nivel) -> UnidadeFisica:
    return UnidadeFisica.objects.create(
        peca_canonica=peca,
        valor_nf=Decimal("100.00"),
        nivel=nivel,
        status=UnidadeFisica.Status.AVAILABLE,
    )


def make_lote(material: object, nivel: Nivel, saldo: str = "10.000") -> LoteInsumo:
    qtd = Decimal(saldo)
    return LoteInsumo.objects.create(
        material_canonico=material,
        unidade_compra="GL",
        quantidade_compra=Decimal("2.000"),
        fator_conversao=Decimal("5.0000"),
        quantidade_base=qtd,
        saldo=qtd,
        valor_total_nf=qtd * Decimal("50.0000"),
        valor_unitario_base=Decimal("50.0000"),
        nivel=nivel,
    )


# --- Tests ------------------------------------------------------------------


class TestAbrirContagem(TenantTestCase):
    """Testa abertura de contagem ciclica com pre-populacao de itens."""

    def setUp(self) -> None:
        self.user = make_user()
        self.armazem, self.rua, self.prat, self.nivel = make_location()
        self.peca = make_peca_canonica("peca-abrir-001")
        self.material = make_material("mat-abrir-001")

    def test_abrir_contagem_ciclica_prepopula_itens(self) -> None:
        """Contagem ciclica por rua deve criar ItemContagem para cada unidade e lote."""
        unidade1 = make_unidade(self.peca, self.nivel)
        unidade2 = make_unidade(self.peca, self.nivel)
        lote = make_lote(self.material, self.nivel, saldo="5.000")

        contagem = ContagemService.abrir_contagem(
            tipo=ContagemInventario.Tipo.CICLICA,
            user_id=self.user.pk,
            rua_id=self.rua.pk,
        )

        itens = ItemContagem.objects.filter(contagem=contagem)
        self.assertEqual(itens.count(), 3)  # 2 unidades + 1 lote

        # Verificar que unidades tem quantidade_sistema = 1
        itens_unidade = itens.filter(unidade_fisica__isnull=False)
        for item in itens_unidade:
            self.assertEqual(item.quantidade_sistema, Decimal("1"))

        # Verificar que lote tem quantidade_sistema = saldo
        item_lote = itens.get(lote_insumo=lote)
        self.assertEqual(item_lote.quantidade_sistema, Decimal("5.000"))


class TestRegistrarItem(TenantTestCase):
    """Testa registro de quantidade contada e calculo de divergencia."""

    def setUp(self) -> None:
        self.user = make_user()
        self.armazem, self.rua, self.prat, self.nivel = make_location()
        self.peca = make_peca_canonica("peca-reg-001")

    def test_registrar_item_calcula_divergencia(self) -> None:
        """Divergencia deve ser quantidade_contada - quantidade_sistema."""
        make_unidade(self.peca, self.nivel)

        contagem = ContagemService.abrir_contagem(
            tipo=ContagemInventario.Tipo.CICLICA,
            user_id=self.user.pk,
            rua_id=self.rua.pk,
        )
        item = ItemContagem.objects.filter(contagem=contagem).first()

        result = ContagemService.registrar_item(
            item_id=item.pk,
            quantidade_contada=Decimal("0"),
            user_id=self.user.pk,
            observacao="Nao encontrada",
        )

        # sistema=1, contada=0, divergencia=-1
        self.assertEqual(result.divergencia, Decimal("-1"))
        self.assertEqual(result.contado_por_id, self.user.pk)


class TestFinalizarContagem(TenantTestCase):
    """Testa finalizacao de contagem com geracao de ajustes."""

    def setUp(self) -> None:
        self.user = make_user()
        self.armazem, self.rua, self.prat, self.nivel = make_location()
        self.peca = make_peca_canonica("peca-fin-001")

    def test_finalizar_contagem_gera_ajustes(self) -> None:
        """Finalizacao deve gerar MovimentacaoEstoque(AJUSTE_INVENTARIO) para divergencias."""
        make_unidade(self.peca, self.nivel)

        contagem = ContagemService.abrir_contagem(
            tipo=ContagemInventario.Tipo.CICLICA,
            user_id=self.user.pk,
            rua_id=self.rua.pk,
        )

        # Registrar quantidade divergente
        item = ItemContagem.objects.filter(contagem=contagem).first()
        ContagemService.registrar_item(
            item_id=item.pk,
            quantidade_contada=Decimal("0"),
            user_id=self.user.pk,
        )

        result = ContagemService.finalizar_contagem(
            contagem_id=contagem.pk,
            user_id=self.user.pk,
        )

        self.assertEqual(result.status, ContagemInventario.Status.FINALIZADA)

        ajustes = MovimentacaoEstoque.objects.filter(
            tipo=MovimentacaoEstoque.Tipo.AJUSTE_INVENTARIO,
        )
        self.assertEqual(ajustes.count(), 1)
        self.assertEqual(ajustes.first().quantidade, Decimal("1"))

    def test_finalizar_contagem_ja_finalizada_erro(self) -> None:
        """Dupla finalizacao deve levantar ValueError."""
        contagem = ContagemService.abrir_contagem(
            tipo=ContagemInventario.Tipo.CICLICA,
            user_id=self.user.pk,
            rua_id=self.rua.pk,
        )

        ContagemService.finalizar_contagem(
            contagem_id=contagem.pk,
            user_id=self.user.pk,
        )

        with self.assertRaises(ValueError):
            ContagemService.finalizar_contagem(
                contagem_id=contagem.pk,
                user_id=self.user.pk,
            )


class TestCancelarContagem(TenantTestCase):
    """Testa cancelamento de contagem."""

    def setUp(self) -> None:
        self.user = make_user()
        self.armazem, self.rua, self.prat, self.nivel = make_location()

    def test_cancelar_contagem_muda_status(self) -> None:
        """Cancelamento deve mudar status para CANCELADA."""
        contagem = ContagemService.abrir_contagem(
            tipo=ContagemInventario.Tipo.CICLICA,
            user_id=self.user.pk,
            rua_id=self.rua.pk,
        )

        result = ContagemService.cancelar_contagem(
            contagem_id=contagem.pk,
            user_id=self.user.pk,
            motivo="Contagem duplicada",
        )

        self.assertEqual(result.status, ContagemInventario.Status.CANCELADA)
        self.assertIsNotNone(result.data_fechamento)
