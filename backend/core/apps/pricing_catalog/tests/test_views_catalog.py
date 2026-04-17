"""
Paddock Solutions — Pricing Catalog Tests: Views
Motor de Orçamentos (MO) — Sprint 02: Catálogo Técnico

Testa RBAC e endpoints do app pricing_catalog seguindo o padrão
de pricing_profile/tests/test_views.py.
"""
import hashlib
import logging
import time
import uuid

import jwt as pyjwt
from django_tenants.test.cases import TenantTestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.pricing_catalog.models import (
    AliasServico,
    CategoriaServico,
    MaterialCanonico,
    PecaCanonica,
    ServicoCanonico,
)

logger = logging.getLogger(__name__)

_DEV_JWT_SECRET = "dscar-dev-secret-paddock-2025"

URL_CATEGORIAS_SERVICO = "/api/v1/pricing/catalog/categorias-servico/"
URL_SERVICOS = "/api/v1/pricing/catalog/servicos/"
URL_MATERIAIS = "/api/v1/pricing/catalog/materiais/"
URL_PECAS = "/api/v1/pricing/catalog/pecas/"
URL_FORNECEDORES = "/api/v1/pricing/catalog/fornecedores/"
URL_ALIASES_SERVICO = "/api/v1/pricing/catalog/aliases/servico/"
URL_ALIASES_REVISAO = "/api/v1/pricing/catalog/aliases/servico/revisao/"


def build_dev_jwt(
    role: str = "ADMIN",
    email: str | None = None,
) -> str:
    """Constrói JWT HS256 idêntico ao gerado pelo provider dev-credentials."""
    if email is None:
        email = f"{role.lower()}-catalog@pricing-test.com"
    now = int(time.time())
    payload = {
        "sub": str(uuid.uuid4()),
        "jti": str(uuid.uuid4()),
        "email": email,
        "name": f"Test {role}",
        "role": role,
        "active_company": "dscar",
        "tenant_schema": "tenant_dscar",
        "companies": ["dscar"],
        "iat": now - 10,
        "exp": now + 3600,
    }
    return pyjwt.encode(payload, _DEV_JWT_SECRET, algorithm="HS256")


def make_global_user(email: str, name: str = "Test User") -> GlobalUser:
    """Cria GlobalUser com email_hash calculado."""
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    user, _ = GlobalUser.objects.get_or_create(
        email_hash=email_hash,
        defaults={"email": email, "name": name},
    )
    return user


def make_categoria_servico(
    codigo: str = "funilaria",
    nome: str = "Funilaria",
    ordem: int = 1,
) -> CategoriaServico:
    """Cria CategoriaServico diretamente no ORM."""
    return CategoriaServico.objects.create(codigo=codigo, nome=nome, ordem=ordem)


def make_servico_canonico(
    categoria: CategoriaServico,
    codigo: str = "pintura-porta",
    nome: str = "Pintura de Porta",
) -> ServicoCanonico:
    """Cria ServicoCanonico diretamente no ORM."""
    return ServicoCanonico.objects.create(
        codigo=codigo,
        nome=nome,
        categoria=categoria,
        unidade="un",
    )


# ─── Base TestCase ─────────────────────────────────────────────────────────────


class CatalogViewsTestCase(TenantTestCase):
    """Base para testes de views do pricing_catalog.

    Configura:
    - APIClient apontando para o domínio do tenant de teste
    - Dados mínimos (CategoriaServico) para os testes
    """

    def setUp(self) -> None:
        super().setUp()
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain

        # Dados base
        self.categoria = make_categoria_servico()

    def _auth(self, role: str) -> None:
        """Configura autenticação JWT para o role informado."""
        email = f"{role.lower()}-catalog@test.com"
        make_global_user(email=email, name=f"Test {role}")
        token = build_dev_jwt(role=role, email=email)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")


# ─── CategoriaServico RBAC ────────────────────────────────────────────────────


class TestCategoriaServicoRBAC(CatalogViewsTestCase):
    """Testa RBAC no CategoriaServicoViewSet."""

    def test_consultant_pode_listar_categorias_servico(self) -> None:
        """CONSULTANT pode fazer GET em /categorias-servico/ → 200."""
        self._auth("CONSULTANT")
        response = self.client.get(URL_CATEGORIAS_SERVICO)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_consultant_nao_pode_criar_categoria_servico(self) -> None:
        """CONSULTANT não pode POST em /categorias-servico/ (requer ADMIN+) → 403."""
        self._auth("CONSULTANT")
        payload = {"codigo": "nova-cat", "nome": "Nova Categoria", "ordem": 99}
        response = self.client.post(URL_CATEGORIAS_SERVICO, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_nao_pode_criar_categoria_servico(self) -> None:
        """MANAGER não pode POST em /categorias-servico/ (requer ADMIN+) → 403."""
        self._auth("MANAGER")
        payload = {"codigo": "manager-cat", "nome": "Manager Cat", "ordem": 50}
        response = self.client.post(URL_CATEGORIAS_SERVICO, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_pode_criar_categoria_servico(self) -> None:
        """ADMIN pode POST em /categorias-servico/ → 201."""
        self._auth("ADMIN")
        payload = {"codigo": "admin-criado", "nome": "Admin Criado", "ordem": 10}
        response = self.client.post(URL_CATEGORIAS_SERVICO, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_sem_autenticacao_retorna_401(self) -> None:
        """Sem token retorna 401."""
        anon_client = APIClient()
        anon_client.defaults["SERVER_NAME"] = self.domain.domain
        response = anon_client.get(URL_CATEGORIAS_SERVICO)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_lista_categorias_retorna_resultados_paginados(self) -> None:
        """Lista de categorias retorna estrutura paginada com 'results'."""
        self._auth("CONSULTANT")
        response = self.client.get(URL_CATEGORIAS_SERVICO)
        data = response.json()
        self.assertIn("results", data)


# ─── ServicoCanonico RBAC ─────────────────────────────────────────────────────


class TestServicoCanonicoRBAC(CatalogViewsTestCase):
    """Testa RBAC no ServicoCanonicoViewSet."""

    def test_consultant_pode_listar_servicos(self) -> None:
        """CONSULTANT pode fazer GET em /servicos/ → 200."""
        self._auth("CONSULTANT")
        response = self.client.get(URL_SERVICOS)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_consultant_nao_pode_criar_servico(self) -> None:
        """CONSULTANT não pode POST em /servicos/ (requer MANAGER+) → 403."""
        self._auth("CONSULTANT")
        payload = {
            "codigo": "novo-servico",
            "nome": "Novo Serviço",
            "categoria": str(self.categoria.pk),
            "unidade": "un",
        }
        response = self.client.post(URL_SERVICOS, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_pode_criar_servico(self) -> None:
        """MANAGER pode POST em /servicos/ → 201."""
        self._auth("MANAGER")
        payload = {
            "codigo": "manager-servico",
            "nome": "Serviço do Manager",
            "categoria": str(self.categoria.pk),
            "unidade": "un",
            "descricao": "",
            "aplica_multiplicador_tamanho": False,
        }
        response = self.client.post(URL_SERVICOS, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_admin_pode_criar_servico(self) -> None:
        """ADMIN pode POST em /servicos/ → 201."""
        self._auth("ADMIN")
        payload = {
            "codigo": "admin-servico",
            "nome": "Serviço do Admin",
            "categoria": str(self.categoria.pk),
            "unidade": "un",
            "descricao": "",
            "aplica_multiplicador_tamanho": True,
        }
        response = self.client.post(URL_SERVICOS, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_sem_autenticacao_retorna_401_servicos(self) -> None:
        """Sem token retorna 401 em /servicos/."""
        anon_client = APIClient()
        anon_client.defaults["SERVER_NAME"] = self.domain.domain
        response = anon_client.get(URL_SERVICOS)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_lista_servicos_retorna_resultados_paginados(self) -> None:
        """Lista de serviços retorna estrutura paginada com 'results'."""
        self._auth("CONSULTANT")
        response = self.client.get(URL_SERVICOS)
        data = response.json()
        self.assertIn("results", data)


# ─── MaterialCanonico RBAC ────────────────────────────────────────────────────


class TestMaterialCanonicoRBAC(CatalogViewsTestCase):
    """Testa RBAC no MaterialCanonicoViewSet."""

    def test_consultant_pode_listar_materiais(self) -> None:
        """CONSULTANT pode fazer GET em /materiais/ → 200."""
        self._auth("CONSULTANT")
        response = self.client.get(URL_MATERIAIS)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_consultant_nao_pode_criar_material(self) -> None:
        """CONSULTANT não pode POST em /materiais/ (requer MANAGER+) → 403."""
        self._auth("CONSULTANT")
        payload = {
            "codigo": "novo-material",
            "nome": "Novo Material",
            "unidade_base": "L",
            "tipo": "consumivel",
        }
        response = self.client.post(URL_MATERIAIS, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_pode_criar_material(self) -> None:
        """MANAGER pode POST em /materiais/ → 201."""
        self._auth("MANAGER")
        payload = {
            "codigo": "material-manager",
            "nome": "Material Manager",
            "unidade_base": "kg",
            "tipo": "consumivel",
        }
        response = self.client.post(URL_MATERIAIS, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


# ─── PecaCanonica RBAC ────────────────────────────────────────────────────────


class TestPecaCanonicoRBAC(CatalogViewsTestCase):
    """Testa RBAC no PecaCanonicoViewSet."""

    def test_consultant_pode_listar_pecas(self) -> None:
        """CONSULTANT pode fazer GET em /pecas/ → 200."""
        self._auth("CONSULTANT")
        response = self.client.get(URL_PECAS)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_consultant_nao_pode_criar_peca(self) -> None:
        """CONSULTANT não pode POST em /pecas/ (requer MANAGER+) → 403."""
        self._auth("CONSULTANT")
        payload = {
            "codigo": "nova-peca",
            "nome": "Nova Peça",
            "tipo_peca": "paralela",
        }
        response = self.client.post(URL_PECAS, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_pode_criar_peca(self) -> None:
        """MANAGER pode POST em /pecas/ → 201."""
        self._auth("MANAGER")
        payload = {
            "codigo": "peca-manager",
            "nome": "Peça Manager",
            "tipo_peca": "original",
        }
        response = self.client.post(URL_PECAS, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


# ─── Fornecedor RBAC ──────────────────────────────────────────────────────────


class TestFornecedorRBAC(CatalogViewsTestCase):
    """Testa que Fornecedor requer MANAGER+ para leitura e escrita."""

    def test_consultant_nao_pode_listar_fornecedores(self) -> None:
        """CONSULTANT não pode GET em /fornecedores/ (requer MANAGER+) → 403."""
        self._auth("CONSULTANT")
        response = self.client.get(URL_FORNECEDORES)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_pode_listar_fornecedores(self) -> None:
        """MANAGER pode GET em /fornecedores/ → 200."""
        self._auth("MANAGER")
        response = self.client.get(URL_FORNECEDORES)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ─── AliasServico RBAC ────────────────────────────────────────────────────────


class TestAliasServicoRBAC(CatalogViewsTestCase):
    """Testa RBAC no AliasServicoViewSet e endpoint de revisão."""

    def setUp(self) -> None:
        super().setUp()
        self.servico = make_servico_canonico(self.categoria)

    def test_consultant_pode_listar_aliases(self) -> None:
        """CONSULTANT pode fazer GET em /aliases/servico/ → 200."""
        self._auth("CONSULTANT")
        response = self.client.get(URL_ALIASES_SERVICO)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_consultant_nao_pode_criar_alias(self) -> None:
        """CONSULTANT não pode POST em /aliases/servico/ (requer MANAGER+) → 403."""
        self._auth("CONSULTANT")
        from apps.pricing_catalog.utils.text import normalizar_texto

        payload = {
            "canonico": str(self.servico.pk),
            "texto": "PINTURA PORTA",
            "texto_normalizado": normalizar_texto("PINTURA PORTA"),
            "origem": "manual",
        }
        response = self.client.post(URL_ALIASES_SERVICO, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_consultant_pode_ver_revisao(self) -> None:
        """CONSULTANT pode fazer GET em /aliases/servico/revisao/ → 200."""
        self._auth("CONSULTANT")
        response = self.client.get(URL_ALIASES_REVISAO)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_revisao_retorna_apenas_auto_media(self) -> None:
        """Endpoint de revisão deve retornar apenas aliases com origem='auto_media'."""
        from apps.pricing_catalog.utils.text import normalizar_texto

        # Cria alias auto_media sem confirmação
        AliasServico.objects.create(
            canonico=self.servico,
            texto="PINTURA CHOQUE",
            texto_normalizado=normalizar_texto("PINTURA CHOQUE"),
            origem="auto_media",
            confirmado_em=None,
        )
        # Cria alias manual (não deve aparecer)
        AliasServico.objects.create(
            canonico=self.servico,
            texto="PINTURA MANUAL",
            texto_normalizado=normalizar_texto("PINTURA MANUAL"),
            origem="manual",
        )

        self._auth("CONSULTANT")
        response = self.client.get(URL_ALIASES_REVISAO)
        data = response.json()

        # Todos os retornados devem ter origem auto_media
        for item in data:
            self.assertEqual(item["origem"], "auto_media")
