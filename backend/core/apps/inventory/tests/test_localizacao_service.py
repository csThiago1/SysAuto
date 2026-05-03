"""
Paddock Solutions — Inventory Tests: LocalizacaoService
WMS — Testes de movimentacao e ocupacao de localizacao.

Requer make dev (Docker + PostgreSQL) para rodar.
"""
import hashlib
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.inventory.models_location import Armazem, Nivel, Prateleira, Rua
from apps.inventory.models_movement import MovimentacaoEstoque
from apps.inventory.models_physical import LoteInsumo, UnidadeFisica
from apps.inventory.services.localizacao import LocalizacaoService


# --- Helpers ----------------------------------------------------------------


def make_user(email: str = "loc-test@example.com") -> GlobalUser:
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    user, _ = GlobalUser.objects.get_or_create(
        email_hash=email_hash,
        defaults={"email": email, "name": "Loc Test User"},
    )
    return user


def make_peca_canonica(codigo: str = "peca-loc-001") -> object:
    from apps.pricing_catalog.models import PecaCanonica

    p, _ = PecaCanonica.objects.get_or_create(
        codigo=codigo,
        defaults={"nome": f"Peca {codigo}", "tipo_peca": "genuina"},
    )
    return p


def make_material(codigo: str = "mat-loc-001") -> object:
    from apps.pricing_catalog.models import MaterialCanonico

    m, _ = MaterialCanonico.objects.get_or_create(
        codigo=codigo,
        defaults={"nome": f"Material {codigo}", "unidade_base": "L", "tipo": "consumivel"},
    )
    return m


def make_location(suffix: str = "1") -> tuple[Armazem, Rua, Prateleira, Nivel]:
    armazem = Armazem.objects.create(nome=f"Galpao Test {suffix}", codigo=f"GT{suffix}", tipo="galpao")
    rua = Rua.objects.create(armazem=armazem, codigo=f"R0{suffix}", ordem=1)
    prateleira = Prateleira.objects.create(rua=rua, codigo=f"P0{suffix}", ordem=1)
    nivel = Nivel.objects.create(prateleira=prateleira, codigo=f"N{suffix}", ordem=1)
    return armazem, rua, prateleira, nivel


def make_unidade(peca: object, nivel: Nivel, valor_nf: str = "100.00") -> UnidadeFisica:
    return UnidadeFisica.objects.create(
        peca_canonica=peca,
        valor_nf=Decimal(valor_nf),
        nivel=nivel,
        status="available",
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


class TestMoverUnidade(TenantTestCase):
    """Testa movimentacao de UnidadeFisica entre niveis."""

    def setUp(self) -> None:
        self.user = make_user()
        self.armazem, self.rua, self.prat, self.nivel_a = make_location("A")
        # Criar segundo nivel na mesma rua
        self.nivel_b = Nivel.objects.create(prateleira=self.prat, codigo="NB", ordem=2)
        self.peca = make_peca_canonica("peca-mover-001")

    def test_mover_unidade_cria_movimentacao_transferencia(self) -> None:
        """Mover unidade deve criar MovimentacaoEstoque(TRANSFERENCIA) com nivel correto."""
        unidade = make_unidade(self.peca, self.nivel_a)

        mov = LocalizacaoService.mover_unidade(
            unidade_fisica_id=unidade.pk,
            nivel_destino_id=self.nivel_b.pk,
            user_id=self.user.pk,
        )

        self.assertEqual(mov.tipo, MovimentacaoEstoque.Tipo.TRANSFERENCIA)
        self.assertEqual(mov.nivel_origem, self.nivel_a)
        self.assertEqual(mov.nivel_destino, self.nivel_b)
        self.assertEqual(mov.quantidade, Decimal("1"))

    def test_mover_unidade_atualiza_nivel_fk(self) -> None:
        """Apos mover, unidade.nivel deve ser o novo nivel."""
        unidade = make_unidade(self.peca, self.nivel_a)

        LocalizacaoService.mover_unidade(
            unidade_fisica_id=unidade.pk,
            nivel_destino_id=self.nivel_b.pk,
            user_id=self.user.pk,
        )

        unidade.refresh_from_db()
        self.assertEqual(unidade.nivel, self.nivel_b)


class TestMoverLote(TenantTestCase):
    """Testa movimentacao de LoteInsumo entre niveis."""

    def setUp(self) -> None:
        self.user = make_user()
        self.armazem, self.rua, self.prat, self.nivel_a = make_location("C")
        self.nivel_b = Nivel.objects.create(prateleira=self.prat, codigo="NC2", ordem=2)
        self.material = make_material("mat-mover-001")

    def test_mover_lote_cria_movimentacao(self) -> None:
        """Mover lote deve criar MovimentacaoEstoque(TRANSFERENCIA)."""
        lote = make_lote(self.material, self.nivel_a, saldo="8.000")

        mov = LocalizacaoService.mover_lote(
            lote_insumo_id=lote.pk,
            nivel_destino_id=self.nivel_b.pk,
            user_id=self.user.pk,
        )

        self.assertEqual(mov.tipo, MovimentacaoEstoque.Tipo.TRANSFERENCIA)
        self.assertEqual(mov.nivel_origem, self.nivel_a)
        self.assertEqual(mov.nivel_destino, self.nivel_b)
        self.assertEqual(mov.quantidade, Decimal("8.000"))

        lote.refresh_from_db()
        self.assertEqual(lote.nivel, self.nivel_b)


class TestOcupacao(TenantTestCase):
    """Testa consultas de ocupacao de nivel e armazem."""

    def setUp(self) -> None:
        self.user = make_user()
        self.peca = make_peca_canonica("peca-ocup-001")
        self.material = make_material("mat-ocup-001")

    def test_ocupacao_nivel_retorna_contagem_correta(self) -> None:
        """2 unidades no nivel devem retornar total_unidades=2."""
        _, _, _, nivel = make_location("D")
        make_unidade(self.peca, nivel, "100.00")
        make_unidade(self.peca, nivel, "120.00")

        result = LocalizacaoService.ocupacao_nivel(nivel.pk)

        self.assertEqual(result["total_unidades"], 2)
        self.assertEqual(result["total_lotes"], 0)

    def test_ocupacao_armazem_retorna_resumo_por_rua(self) -> None:
        """Itens em 2 ruas devem retornar stats separadas por rua."""
        armazem = Armazem.objects.create(nome="Galpao Multi", codigo="GM1", tipo="galpao")
        rua1 = Rua.objects.create(armazem=armazem, codigo="R01", ordem=1, descricao="Rua 1")
        rua2 = Rua.objects.create(armazem=armazem, codigo="R02", ordem=2, descricao="Rua 2")
        prat1 = Prateleira.objects.create(rua=rua1, codigo="P01", ordem=1)
        prat2 = Prateleira.objects.create(rua=rua2, codigo="P01", ordem=1)
        nivel1 = Nivel.objects.create(prateleira=prat1, codigo="N1", ordem=1)
        nivel2 = Nivel.objects.create(prateleira=prat2, codigo="N1", ordem=1)

        make_unidade(self.peca, nivel1)
        make_unidade(self.peca, nivel1)
        make_lote(self.material, nivel2, saldo="5.000")

        result = LocalizacaoService.ocupacao_armazem(armazem.pk)

        self.assertEqual(len(result), 2)
        rua1_data = next(r for r in result if r["rua_codigo"] == "R01")
        rua2_data = next(r for r in result if r["rua_codigo"] == "R02")
        self.assertEqual(rua1_data["total_unidades"], 2)
        self.assertEqual(rua1_data["total_lotes"], 0)
        self.assertEqual(rua2_data["total_unidades"], 0)
        self.assertEqual(rua2_data["total_lotes"], 1)
