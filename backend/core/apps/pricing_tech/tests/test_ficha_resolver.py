"""
Paddock Solutions — Pricing Tech Tests: Resolver
Motor de Orçamentos (MO) — Sprint MO-4: Ficha Técnica Versionada

Testa FichaTecnicaService.resolver() com fallback por tipo_pintura.
"""
import hashlib
import logging

from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.pricing_catalog.models import (
    CategoriaMaoObra,
    CategoriaServico,
    MaterialCanonico,
    ServicoCanonico,
)
from apps.pricing_profile.models import TipoPintura
from apps.pricing_tech.models import (
    FichaTecnicaInsumo,
    FichaTecnicaMaoObra,
    FichaTecnicaServico,
)
from apps.pricing_tech.services import FichaNaoEncontrada, FichaTecnicaService

logger = logging.getLogger(__name__)


# ─── Helpers de fixture ────────────────────────────────────────────────────────


def make_user(email: str = "tech-test@example.com") -> GlobalUser:
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    user, _ = GlobalUser.objects.get_or_create(
        email_hash=email_hash,
        defaults={"email": email, "name": "Tech Test User"},
    )
    return user


def make_categoria_servico(codigo: str = "pintura-test") -> CategoriaServico:
    cat, _ = CategoriaServico.objects.get_or_create(
        codigo=codigo,
        defaults={"nome": f"Cat {codigo}", "ordem": 99},
    )
    return cat


def make_servico(
    codigo: str = "pintura-porta-test",
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


def make_tipo_pintura(codigo: str = "SOLIDA") -> TipoPintura:
    tp, _ = TipoPintura.objects.get_or_create(
        codigo=codigo,
        defaults={"nome": f"Tipo {codigo}", "complexidade": 1},
    )
    return tp


def make_cat_mao_obra(codigo: str = "pintor") -> CategoriaMaoObra:
    cat, _ = CategoriaMaoObra.objects.get_or_create(
        codigo=codigo,
        defaults={"nome": f"Cat MO {codigo}", "ordem": 99},
    )
    return cat


def make_material(
    codigo: str = "tinta-solida-test", unidade_base: str = "L"
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


def make_ficha(
    servico: ServicoCanonico,
    tipo_pintura: TipoPintura | None = None,
    versao: int = 1,
    is_active: bool = True,
    user: GlobalUser | None = None,
) -> FichaTecnicaServico:
    """Cria uma FichaTecnicaServico com 1 mão de obra e 1 insumo."""
    cat_mo = make_cat_mao_obra()
    material = make_material()

    ficha = FichaTecnicaServico.objects.create(
        servico=servico,
        tipo_pintura=tipo_pintura,
        versao=versao,
        is_active=is_active,
        criada_por=user,
        motivo_nova_versao="Ficha de teste inicial",
    )
    FichaTecnicaMaoObra.objects.create(
        ficha=ficha,
        categoria=cat_mo,
        horas="2.00",
        afetada_por_tamanho=True,
    )
    FichaTecnicaInsumo.objects.create(
        ficha=ficha,
        material_canonico=material,
        quantidade="0.30",
        unidade="L",
        afetado_por_tamanho=True,
    )
    return ficha


# ─── Tests: FichaTecnicaService.resolver() ────────────────────────────────────


class TestFichaTecnicaResolver(TenantTestCase):
    """Testa FichaTecnicaService.resolver() com diferentes combinações de tipo_pintura."""

    def setUp(self) -> None:
        super().setUp()
        self.user = make_user()
        self.categoria = make_categoria_servico("pintura-resolver")
        self.servico = make_servico("pintura-choque-test", self.categoria)
        self.tipo_solida = make_tipo_pintura("SOLIDA")
        self.tipo_metalica = make_tipo_pintura("METALICA")

    def test_resolve_ficha_especifica_quando_tipo_pintura_bate(self) -> None:
        """Deve retornar a ficha específica quando tipo_pintura.codigo coincide."""
        # Cria ficha genérica (fallback)
        make_ficha(self.servico, tipo_pintura=None, versao=1, user=self.user)
        # Cria ficha específica para SOLIDA
        ficha_esp = make_ficha(
            self.servico, tipo_pintura=self.tipo_solida, versao=1, user=self.user
        )

        resultado = FichaTecnicaService.resolver(
            servico_id=str(self.servico.pk),
            tipo_pintura_codigo="SOLIDA",
        )

        self.assertEqual(resultado.ficha_id, str(ficha_esp.pk))
        self.assertEqual(resultado.versao, 1)
        self.assertEqual(len(resultado.maos_obra), 1)
        self.assertEqual(len(resultado.insumos), 1)

    def test_resolve_ficha_generica_quando_tipo_pintura_nao_bate(self) -> None:
        """Quando tipo_pintura não tem ficha específica, deve cair na genérica."""
        ficha_generica = make_ficha(
            self.servico, tipo_pintura=None, versao=1, user=self.user
        )

        resultado = FichaTecnicaService.resolver(
            servico_id=str(self.servico.pk),
            tipo_pintura_codigo="METALICA",  # sem ficha específica
        )

        self.assertEqual(resultado.ficha_id, str(ficha_generica.pk))
        self.assertIsNotNone(resultado.maos_obra)
        self.assertIsNotNone(resultado.insumos)

    def test_resolve_ficha_generica_quando_tipo_pintura_codigo_none(self) -> None:
        """Quando tipo_pintura_codigo=None, deve retornar a ficha genérica."""
        ficha_generica = make_ficha(
            self.servico, tipo_pintura=None, versao=1, user=self.user
        )

        resultado = FichaTecnicaService.resolver(
            servico_id=str(self.servico.pk),
            tipo_pintura_codigo=None,
        )

        self.assertEqual(resultado.ficha_id, str(ficha_generica.pk))

    def test_resolve_especifica_prioridade_sobre_generica(self) -> None:
        """Ficha específica deve ter prioridade sobre genérica mesmo quando ambas existem."""
        make_ficha(self.servico, tipo_pintura=None, versao=1, user=self.user)
        ficha_esp = make_ficha(
            self.servico, tipo_pintura=self.tipo_solida, versao=1, user=self.user
        )

        resultado = FichaTecnicaService.resolver(
            servico_id=str(self.servico.pk),
            tipo_pintura_codigo="SOLIDA",
        )

        self.assertEqual(resultado.ficha_id, str(ficha_esp.pk))

    def test_raises_ficha_nao_encontrada_sem_ficha_ativa(self) -> None:
        """Deve levantar FichaNaoEncontrada quando não há nenhuma ficha ativa."""
        # Ficha existe mas está inativa
        make_ficha(
            self.servico, tipo_pintura=None, versao=1, is_active=False, user=self.user
        )

        with self.assertRaises(FichaNaoEncontrada):
            FichaTecnicaService.resolver(
                servico_id=str(self.servico.pk),
                tipo_pintura_codigo=None,
            )

    def test_raises_ficha_nao_encontrada_sem_ficha_alguma(self) -> None:
        """Deve levantar FichaNaoEncontrada quando serviço não tem ficha cadastrada."""
        servico_sem_ficha = make_servico("servico-sem-ficha", self.categoria)

        with self.assertRaises(FichaNaoEncontrada):
            FichaTecnicaService.resolver(
                servico_id=str(servico_sem_ficha.pk),
                tipo_pintura_codigo=None,
            )

    def test_ficha_resolvida_contem_campos_corretos(self) -> None:
        """FichaResolvida deve conter ficha_id, versao, maos_obra e insumos estruturados."""
        make_ficha(self.servico, tipo_pintura=None, versao=1, user=self.user)

        resultado = FichaTecnicaService.resolver(str(self.servico.pk))

        self.assertIsInstance(resultado.ficha_id, str)
        self.assertIsInstance(resultado.versao, int)
        self.assertIsInstance(resultado.maos_obra, list)
        self.assertIsInstance(resultado.insumos, list)

        # Verifica estrutura dos itens
        if resultado.maos_obra:
            mo = resultado.maos_obra[0]
            self.assertIn("categoria_codigo", mo)
            self.assertIn("categoria_nome", mo)
            self.assertIn("horas", mo)
            self.assertIn("afetada_por_tamanho", mo)

        if resultado.insumos:
            ins = resultado.insumos[0]
            self.assertIn("material_codigo", ins)
            self.assertIn("material_nome", ins)
            self.assertIn("quantidade", ins)
            self.assertIn("unidade_base", ins)
            self.assertIn("afetado_por_tamanho", ins)

    def test_ficha_inativa_nao_e_retornada(self) -> None:
        """Ficha inativa não deve ser considerada no resolver, mesmo sendo genérica."""
        # v1 inativa, v2 ativa
        make_ficha(
            self.servico, tipo_pintura=None, versao=1, is_active=False, user=self.user
        )
        ficha_v2 = make_ficha(
            self.servico, tipo_pintura=None, versao=2, is_active=True, user=self.user
        )

        resultado = FichaTecnicaService.resolver(str(self.servico.pk))

        self.assertEqual(resultado.ficha_id, str(ficha_v2.pk))
        self.assertEqual(resultado.versao, 2)
