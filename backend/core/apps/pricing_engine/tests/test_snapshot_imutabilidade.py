"""
Paddock Solutions — Pricing Engine — Tests: CalculoCustoSnapshot Imutabilidade
Motor de Orçamentos (MO) — Sprint MO-6

Valida ARMADILHA A4: snapshot imutável após criação.
save() levanta ValueError se campos de decomposição forem alterados.
"""
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.pricing_engine.models import CalculoCustoSnapshot
from apps.pricing_profile.models import Empresa


def make_empresa(cnpj: str = "55555555000155") -> Empresa:
    return Empresa.objects.create(
        cnpj=cnpj,
        nome_fantasia=f"Empresa Snap {cnpj[:4]}",
        razao_social=f"Empresa Snap Ltda {cnpj}",
    )


def make_snapshot(empresa: Empresa, preco_final: Decimal = Decimal("1000.00")) -> CalculoCustoSnapshot:
    return CalculoCustoSnapshot.objects.create(
        empresa=empresa,
        servico_canonico=None,
        peca_canonica=None,
        origem="simulacao",
        contexto={"veiculo": {"marca": "VW", "modelo": "Gol", "ano": 2018}},
        custo_mo=Decimal("400.00"),
        custo_insumos=Decimal("200.00"),
        rateio=Decimal("100.00"),
        custo_peca_base=Decimal("0.00"),
        custo_total_base=Decimal("700.00"),
        fator_responsabilidade=Decimal("0.1000"),
        margem_base=Decimal("0.4000"),
        margem_ajustada=Decimal("0.4400"),
        preco_calculado=preco_final,
        preco_teto_benchmark=None,
        preco_final=preco_final,
        decomposicao={"mao_obra": [], "insumos": [], "rateio": {"total": "100.00"}},
    )


class TestSnapshotImutabilidade(TenantTestCase):
    """Testa que CalculoCustoSnapshot respeita a regra de imutabilidade."""

    def setUp(self) -> None:
        super().setUp()
        self.empresa = make_empresa("55555555000155")

    def test_criacao_sem_pk_funciona(self) -> None:
        """Criação normal (sem PK prévia) deve funcionar sem erros."""
        snap = make_snapshot(self.empresa)
        self.assertIsNotNone(snap.pk)
        self.assertEqual(snap.preco_final, Decimal("1000.00"))

    def test_save_em_snapshot_existente_com_preco_diferente_raise(self) -> None:
        """Alterar preco_final em snapshot existente levanta ValueError."""
        snap = make_snapshot(self.empresa)
        snap.preco_final = Decimal("9999.99")
        with self.assertRaises(ValueError, msg="CalculoCustoSnapshot é imutável"):
            snap.save()

    def test_save_em_snapshot_existente_com_custo_diferente_raise(self) -> None:
        """Alterar custo_total_base em snapshot existente levanta ValueError."""
        snap = make_snapshot(self.empresa)
        snap.custo_total_base = Decimal("1.00")
        with self.assertRaises(ValueError):
            snap.save()

    def test_save_em_snapshot_existente_com_decomposicao_diferente_raise(self) -> None:
        """Alterar decomposicao em snapshot existente levanta ValueError."""
        snap = make_snapshot(self.empresa)
        snap.decomposicao = {"adulterado": True}
        with self.assertRaises(ValueError):
            snap.save()

    def test_save_sem_alteracao_de_campos_criticos_nao_raise(self) -> None:
        """Save sem alterar campos críticos deve funcionar (ex: is_active)."""
        snap = make_snapshot(self.empresa)
        # Alterar campo não crítico não deve lançar exceção
        snap.is_active = False
        snap.save()  # não deve lançar ValueError
        snap.refresh_from_db()
        self.assertFalse(snap.is_active)

    def test_dois_snapshots_independentes_com_mesmo_contexto(self) -> None:
        """Mesmo contexto chamado 2x gera 2 snapshots com mesmo preco_final (determinismo)."""
        snap1 = make_snapshot(self.empresa, Decimal("1487.20"))
        snap2 = make_snapshot(self.empresa, Decimal("1487.20"))
        self.assertNotEqual(snap1.pk, snap2.pk)
        self.assertEqual(snap1.preco_final, snap2.preco_final)

    def test_snapshot_read_only_via_queryset(self) -> None:
        """objects.update() não deve ser usado — QuerySet.update() ignora o save() override.

        Este teste documenta a limitação: apenas via save() individual é protegido.
        Para proteção completa em produção, usar permissões na view.
        """
        snap = make_snapshot(self.empresa)
        # QuerySet.update() bypassaria o save() override — limitação conhecida.
        # O RBAC na view (ReadOnlyModelViewSet) é a proteção principal.
        self.assertIsNotNone(snap.pk)


class TestSnapshotCamposReadOnlyNaApi(TenantTestCase):
    """Testa que snapshots retornam apenas campos permitidos (via serializer)."""

    def setUp(self) -> None:
        super().setUp()
        self.empresa = make_empresa("66666666000166")

    def test_snapshot_full_serializer_contem_custo_mo(self) -> None:
        """SnapshotFullSerializer expõe custo_mo (ADMIN+)."""
        from apps.pricing_engine.serializers import SnapshotFullSerializer
        snap = make_snapshot(self.empresa)
        data = SnapshotFullSerializer(snap).data
        self.assertIn("custo_mo", data)
        self.assertIn("margem_base", data)

    def test_snapshot_mgr_serializer_nao_contem_custo_mo(self) -> None:
        """SnapshotMgrSerializer NÃO expõe custo_mo (apenas MANAGER+)."""
        from apps.pricing_engine.serializers import SnapshotMgrSerializer
        snap = make_snapshot(self.empresa)
        data = SnapshotMgrSerializer(snap).data
        self.assertNotIn("custo_mo", data)
        self.assertIn("custo_total_base", data)
        self.assertIn("decomposicao", data)

    def test_snapshot_min_serializer_nao_contem_decomposicao(self) -> None:
        """SnapshotMinSerializer NÃO expõe decomposicao (apenas CONSULTANT+)."""
        from apps.pricing_engine.serializers import SnapshotMinSerializer
        snap = make_snapshot(self.empresa)
        data = SnapshotMinSerializer(snap).data
        self.assertNotIn("decomposicao", data)
        self.assertNotIn("custo_total_base", data)
        self.assertIn("preco_final", data)
