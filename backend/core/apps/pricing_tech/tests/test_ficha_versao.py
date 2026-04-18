"""
Paddock Solutions — Pricing Tech Tests: Versionamento
Motor de Orçamentos (MO) — Sprint MO-4: Ficha Técnica Versionada

Testa FichaTecnicaService.criar_nova_versao() — versionamento atômico.
"""
import hashlib
import logging

from django.core.exceptions import ValidationError
from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.pricing_catalog.models import (
    CategoriaMaoObra,
    CategoriaServico,
    MaterialCanonico,
    ServicoCanonico,
)
from apps.pricing_tech.models import FichaTecnicaServico
from apps.pricing_tech.services import FichaTecnicaService

logger = logging.getLogger(__name__)


# ─── Helpers de fixture ────────────────────────────────────────────────────────


def make_user(email: str = "versao-test@example.com") -> GlobalUser:
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    user, _ = GlobalUser.objects.get_or_create(
        email_hash=email_hash,
        defaults={"email": email, "name": "Versao Test User"},
    )
    return user


def make_categoria_servico(codigo: str = "funilaria-versao") -> CategoriaServico:
    cat, _ = CategoriaServico.objects.get_or_create(
        codigo=codigo,
        defaults={"nome": f"Cat {codigo}", "ordem": 99},
    )
    return cat


def make_servico(
    codigo: str = "funilaria-porta-versao",
    categoria: CategoriaServico | None = None,
) -> ServicoCanonico:
    if categoria is None:
        categoria = make_categoria_servico()
    svc, _ = ServicoCanonico.objects.get_or_create(
        codigo=codigo,
        defaults={
            "nome": f"Serviço {codigo}",
            "categoria": categoria,
            "unidade": "un",
            "aplica_multiplicador_tamanho": True,
        },
    )
    return svc


def make_cat_mao_obra(codigo: str = "funileiro-versao") -> CategoriaMaoObra:
    cat, _ = CategoriaMaoObra.objects.get_or_create(
        codigo=codigo,
        defaults={"nome": f"Cat MO {codigo}", "ordem": 99},
    )
    return cat


def make_material(
    codigo: str = "massa-polies-versao", unidade_base: str = "kg"
) -> MaterialCanonico:
    mat, _ = MaterialCanonico.objects.get_or_create(
        codigo=codigo,
        defaults={
            "nome": f"Material {codigo}",
            "unidade_base": unidade_base,
            "tipo": "consumivel",
        },
    )
    return mat


def build_maos_obra_data(cat_mao_obra: CategoriaMaoObra) -> list[dict]:
    return [
        {
            "categoria_id": cat_mao_obra.pk,
            "horas": "2.00",
            "afetada_por_tamanho": True,
            "observacao": "",
        }
    ]


def build_insumos_data(material: MaterialCanonico) -> list[dict]:
    return [
        {
            "material_canonico_id": material.pk,
            "quantidade": "0.50",
            "unidade": material.unidade_base,
            "afetado_por_tamanho": True,
            "observacao": "",
        }
    ]


# ─── Tests: criar_nova_versao ──────────────────────────────────────────────────


class TestCriarNovaVersao(TenantTestCase):
    """Testa FichaTecnicaService.criar_nova_versao() — atomicidade e versionamento."""

    def setUp(self) -> None:
        super().setUp()
        self.user = make_user()
        self.categoria = make_categoria_servico()
        self.servico = make_servico("servico-nova-versao-test", self.categoria)
        self.cat_mo = make_cat_mao_obra()
        self.material = make_material()
        self.maos_obra_data = build_maos_obra_data(self.cat_mo)
        self.insumos_data = build_insumos_data(self.material)

    def test_cria_primeira_versao_sem_anterior(self) -> None:
        """Primeira ficha do serviço deve ter versao=1."""
        nova = FichaTecnicaService.criar_nova_versao(
            servico_id=str(self.servico.pk),
            tipo_pintura_id=None,
            maos_obra_data=self.maos_obra_data,
            insumos_data=self.insumos_data,
            motivo="Primeira versão da ficha técnica",
            user_id=str(self.user.pk),
        )

        self.assertEqual(nova.versao, 1)
        self.assertTrue(nova.is_active)
        self.assertEqual(str(nova.servico_id), str(self.servico.pk))

    def test_cria_segunda_versao_e_desativa_anterior(self) -> None:
        """Segunda versão deve ser criada e a anterior desativada."""
        primeira = FichaTecnicaService.criar_nova_versao(
            servico_id=str(self.servico.pk),
            tipo_pintura_id=None,
            maos_obra_data=self.maos_obra_data,
            insumos_data=self.insumos_data,
            motivo="Primeira versão da ficha técnica",
            user_id=str(self.user.pk),
        )

        segunda = FichaTecnicaService.criar_nova_versao(
            servico_id=str(self.servico.pk),
            tipo_pintura_id=None,
            maos_obra_data=self.maos_obra_data,
            insumos_data=self.insumos_data,
            motivo="Segunda versão com horas ajustadas",
            user_id=str(self.user.pk),
        )

        # Versão anterior desativada
        primeira.refresh_from_db()
        self.assertFalse(primeira.is_active)

        # Nova versão ativa
        self.assertEqual(segunda.versao, 2)
        self.assertTrue(segunda.is_active)

    def test_numeracao_versao_incrementa_corretamente(self) -> None:
        """Versões devem ser 1, 2, 3 consecutivamente."""
        for i in range(1, 4):
            nova = FichaTecnicaService.criar_nova_versao(
                servico_id=str(self.servico.pk),
                tipo_pintura_id=None,
                maos_obra_data=self.maos_obra_data,
                insumos_data=self.insumos_data,
                motivo=f"Versão {i} — ajuste de testes",
                user_id=str(self.user.pk),
            )
            self.assertEqual(nova.versao, i)

        # Apenas a última deve estar ativa
        fichas = FichaTecnicaServico.objects.filter(
            servico=self.servico, tipo_pintura__isnull=True
        )
        self.assertEqual(fichas.filter(is_active=True).count(), 1)
        self.assertEqual(fichas.filter(is_active=False).count(), 2)
        self.assertEqual(fichas.filter(is_active=True).first().versao, 3)

    def test_cria_maos_obra_e_insumos_para_nova_versao(self) -> None:
        """Nova versão deve ter as mãos de obra e insumos criados corretamente."""
        nova = FichaTecnicaService.criar_nova_versao(
            servico_id=str(self.servico.pk),
            tipo_pintura_id=None,
            maos_obra_data=self.maos_obra_data,
            insumos_data=self.insumos_data,
            motivo="Ficha com itens completos",
            user_id=str(self.user.pk),
        )

        self.assertEqual(nova.maos_obra.count(), 1)
        self.assertEqual(nova.insumos.count(), 1)

        mo = nova.maos_obra.first()
        self.assertIsNotNone(mo)
        self.assertEqual(mo.horas, 2)

        ins = nova.insumos.first()
        self.assertIsNotNone(ins)
        self.assertEqual(str(ins.quantidade), "0.5000")

    def test_motivo_salvo_na_ficha(self) -> None:
        """O motivo passado deve ser salvo na nova ficha."""
        motivo = "Ajuste de horas após nova metodologia de trabalho"
        nova = FichaTecnicaService.criar_nova_versao(
            servico_id=str(self.servico.pk),
            tipo_pintura_id=None,
            maos_obra_data=self.maos_obra_data,
            insumos_data=self.insumos_data,
            motivo=motivo,
            user_id=str(self.user.pk),
        )

        self.assertEqual(nova.motivo_nova_versao, motivo)

    def test_rollback_atomico_com_insumo_invalido(self) -> None:
        """Deve fazer rollback completo se algum insumo for inválido (unidade errada)."""
        insumos_invalidos = [
            {
                "material_canonico_id": self.material.pk,
                "quantidade": "0.30",
                "unidade": "un",  # ERRADO: material tem unidade_base="kg"
                "afetado_por_tamanho": True,
                "observacao": "",
            }
        ]

        count_antes = FichaTecnicaServico.objects.filter(
            servico=self.servico
        ).count()

        with self.assertRaises((ValidationError, Exception)):
            FichaTecnicaService.criar_nova_versao(
                servico_id=str(self.servico.pk),
                tipo_pintura_id=None,
                maos_obra_data=self.maos_obra_data,
                insumos_data=insumos_invalidos,
                motivo="Tentativa com insumo inválido",
                user_id=str(self.user.pk),
            )

        # Nenhuma ficha deve ter sido criada (rollback)
        count_depois = FichaTecnicaServico.objects.filter(
            servico=self.servico
        ).count()
        self.assertEqual(count_antes, count_depois)

    def test_versoes_independentes_por_tipo_pintura(self) -> None:
        """Versionamento de ficha genérica e específica são independentes."""
        from apps.pricing_profile.models import TipoPintura

        tipo_solida, _ = TipoPintura.objects.get_or_create(
            codigo="SOLIDA-VER",
            defaults={"nome": "Tinta Sólida Ver", "complexidade": 1},
        )

        generica = FichaTecnicaService.criar_nova_versao(
            servico_id=str(self.servico.pk),
            tipo_pintura_id=None,
            maos_obra_data=self.maos_obra_data,
            insumos_data=self.insumos_data,
            motivo="Genérica versão 1 inicial teste",
            user_id=str(self.user.pk),
        )
        especifica = FichaTecnicaService.criar_nova_versao(
            servico_id=str(self.servico.pk),
            tipo_pintura_id=str(tipo_solida.pk),
            maos_obra_data=self.maos_obra_data,
            insumos_data=self.insumos_data,
            motivo="Específica SOLIDA versão 1 teste",
            user_id=str(self.user.pk),
        )

        # Ambas versao=1, ambas ativas, mas com tipo_pintura diferente
        self.assertEqual(generica.versao, 1)
        self.assertEqual(especifica.versao, 1)
        self.assertTrue(generica.is_active)
        self.assertTrue(especifica.is_active)
        self.assertIsNone(generica.tipo_pintura_id)
        self.assertEqual(str(especifica.tipo_pintura_id), str(tipo_solida.pk))
