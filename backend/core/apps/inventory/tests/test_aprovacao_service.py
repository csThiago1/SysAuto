"""
Paddock Solutions — Inventory Tests: AprovacaoEstoqueService
WMS-2 — Fluxo de aprovacao/rejeicao de perdas e ajustes.

Requer make dev (Docker + PostgreSQL) para rodar.
"""
import hashlib
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.inventory.models_location import Armazem, Nivel, Prateleira, Rua
from apps.inventory.models_movement import MovimentacaoEstoque
from apps.inventory.models_physical import LoteInsumo, UnidadeFisica
from apps.inventory.services.aprovacao import AprovacaoEstoqueService


# --- Helpers ----------------------------------------------------------------


def make_user(email: str = "aprov-test@example.com") -> GlobalUser:
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    user, _ = GlobalUser.objects.get_or_create(
        email_hash=email_hash,
        defaults={"email": email, "name": "Aprovacao Test User"},
    )
    return user


def make_peca_canonica(codigo: str = "peca-aprov-001") -> object:
    from apps.pricing_catalog.models import PecaCanonica

    p, _ = PecaCanonica.objects.get_or_create(
        codigo=codigo,
        defaults={"nome": f"Peca {codigo}", "tipo_peca": "genuina"},
    )
    return p


def make_material(codigo: str = "mat-aprov-001") -> object:
    from apps.pricing_catalog.models import MaterialCanonico

    m, _ = MaterialCanonico.objects.get_or_create(
        codigo=codigo,
        defaults={"nome": f"Material {codigo}", "unidade_base": "L", "tipo": "consumivel"},
    )
    return m


def make_location() -> tuple[Armazem, Rua, Prateleira, Nivel]:
    armazem = Armazem.objects.create(nome="Galpao Aprov", codigo="GA1", tipo="galpao")
    rua = Rua.objects.create(armazem=armazem, codigo="R01", ordem=1)
    prateleira = Prateleira.objects.create(rua=rua, codigo="P01", ordem=1)
    nivel = Nivel.objects.create(prateleira=prateleira, codigo="N1", ordem=1)
    return armazem, rua, prateleira, nivel


def make_perda_unidade(
    peca: object,
    nivel: Nivel,
    user: GlobalUser,
) -> tuple[UnidadeFisica, MovimentacaoEstoque]:
    """Cria unidade + registra perda (movimentacao pendente)."""
    unidade = UnidadeFisica.objects.create(
        peca_canonica=peca,
        valor_nf=Decimal("100.00"),
        status=UnidadeFisica.Status.LOST,
        nivel=nivel,
    )
    mov = MovimentacaoEstoque(
        tipo=MovimentacaoEstoque.Tipo.SAIDA_PERDA,
        unidade_fisica=unidade,
        quantidade=1,
        nivel_origem=nivel,
        motivo="Avaria teste",
        realizado_por=user,
    )
    mov.save()
    return unidade, mov


def make_perda_lote(
    material: object,
    nivel: Nivel,
    user: GlobalUser,
    saldo_original: str = "10.000",
    quantidade_perdida: str = "3.000",
) -> tuple[LoteInsumo, MovimentacaoEstoque]:
    """Cria lote com saldo ja debitado + movimentacao de perda pendente."""
    qtd = Decimal(saldo_original)
    perdida = Decimal(quantidade_perdida)
    lote = LoteInsumo.objects.create(
        material_canonico=material,
        unidade_compra="GL",
        quantidade_compra=Decimal("2.000"),
        fator_conversao=Decimal("5.0000"),
        quantidade_base=qtd,
        saldo=qtd - perdida,  # Ja debitado pelo SaidaEstoqueService
        valor_total_nf=qtd * Decimal("50.0000"),
        valor_unitario_base=Decimal("50.0000"),
        nivel=nivel,
    )
    mov = MovimentacaoEstoque(
        tipo=MovimentacaoEstoque.Tipo.SAIDA_PERDA,
        lote_insumo=lote,
        quantidade=perdida,
        nivel_origem=nivel,
        motivo="Vazamento teste",
        realizado_por=user,
    )
    mov.save()
    return lote, mov


# --- Tests ------------------------------------------------------------------


class TestPendentes(TenantTestCase):
    """Testa listagem de movimentacoes pendentes de aprovacao."""

    def setUp(self) -> None:
        self.user = make_user()
        _, _, _, self.nivel = make_location()
        self.peca = make_peca_canonica("peca-pend-001")

    def test_pendentes_retorna_apenas_perda_e_ajuste_sem_aprovacao(self) -> None:
        """Deve retornar PERDA e AJUSTE sem aprovado_por; excluir TRANSFERENCIA."""
        # Perda (pendente)
        _, mov_perda = make_perda_unidade(self.peca, self.nivel, self.user)

        # Transferencia (nao deve aparecer)
        nivel_b = Nivel.objects.create(
            prateleira=self.nivel.prateleira, codigo="N2", ordem=2,
        )
        peca2 = make_peca_canonica("peca-pend-002")
        unidade_transf = UnidadeFisica.objects.create(
            peca_canonica=peca2,
            valor_nf=Decimal("100.00"),
            nivel=self.nivel,
        )
        mov_transf = MovimentacaoEstoque(
            tipo=MovimentacaoEstoque.Tipo.TRANSFERENCIA,
            unidade_fisica=unidade_transf,
            quantidade=1,
            nivel_origem=self.nivel,
            nivel_destino=nivel_b,
            realizado_por=self.user,
        )
        mov_transf.save()

        pendentes = list(AprovacaoEstoqueService.pendentes())

        pks = [m.pk for m in pendentes]
        self.assertIn(mov_perda.pk, pks)
        self.assertNotIn(mov_transf.pk, pks)


class TestAprovar(TenantTestCase):
    """Testa aprovacao de movimentacoes."""

    def setUp(self) -> None:
        self.operador = make_user("operador@example.com")
        self.manager = make_user("manager@example.com")
        _, _, _, self.nivel = make_location()
        self.peca = make_peca_canonica("peca-apr-001")

    def test_aprovar_preenche_aprovado_por_e_aprovado_em(self) -> None:
        """Aprovacao deve preencher aprovado_por e aprovado_em."""
        _, mov = make_perda_unidade(self.peca, self.nivel, self.operador)

        resultado = AprovacaoEstoqueService.aprovar(
            movimentacao_id=mov.pk,
            user_id=self.manager.pk,
        )

        self.assertEqual(resultado.aprovado_por_id, self.manager.pk)
        self.assertIsNotNone(resultado.aprovado_em)

    def test_aprovar_ja_aprovada_levanta_erro(self) -> None:
        """Dupla aprovacao deve levantar ValueError."""
        _, mov = make_perda_unidade(self.peca, self.nivel, self.operador)

        AprovacaoEstoqueService.aprovar(
            movimentacao_id=mov.pk,
            user_id=self.manager.pk,
        )

        with self.assertRaises(ValueError):
            AprovacaoEstoqueService.aprovar(
                movimentacao_id=mov.pk,
                user_id=self.manager.pk,
            )


class TestRejeitar(TenantTestCase):
    """Testa rejeicao de movimentacoes com reversao."""

    def setUp(self) -> None:
        self.operador = make_user("op-rej@example.com")
        self.manager = make_user("mgr-rej@example.com")
        _, _, _, self.nivel = make_location()

    def test_rejeitar_reverte_perda_unidade(self) -> None:
        """Rejeicao de perda de unidade deve restaurar status para available."""
        peca = make_peca_canonica("peca-rej-001")
        unidade, mov = make_perda_unidade(peca, self.nivel, self.operador)

        AprovacaoEstoqueService.rejeitar(
            movimentacao_id=mov.pk,
            user_id=self.manager.pk,
            motivo="Perda nao confirmada",
        )

        unidade.refresh_from_db()
        self.assertEqual(unidade.status, UnidadeFisica.Status.AVAILABLE)

        # Movimentacao deve estar soft-deleted
        mov.refresh_from_db()
        self.assertFalse(mov.is_active)

    def test_rejeitar_reverte_perda_lote_saldo(self) -> None:
        """Rejeicao de perda de lote deve restaurar saldo."""
        material = make_material("mat-rej-001")
        lote, mov = make_perda_lote(
            material, self.nivel, self.operador,
            saldo_original="10.000",
            quantidade_perdida="3.000",
        )

        # Saldo apos perda: 10 - 3 = 7
        self.assertEqual(lote.saldo, Decimal("7.000"))

        AprovacaoEstoqueService.rejeitar(
            movimentacao_id=mov.pk,
            user_id=self.manager.pk,
            motivo="Saldo estava correto",
        )

        lote.refresh_from_db()
        # Saldo restaurado: 7 + 3 = 10
        self.assertEqual(lote.saldo, Decimal("10.000"))
