"""
Paddock Solutions — Pricing Profile Tests: Views

Testa RBAC e endpoints do app pricing_profile.
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
from apps.pricing_profile.models import (
    CategoriaTamanho,
    EnquadramentoVeiculo,
    SegmentoVeicular,
    TipoPintura,
)

logger = logging.getLogger(__name__)

_DEV_JWT_SECRET = "dscar-dev-secret-paddock-2025"

URL_SEGMENTOS = "/api/v1/pricing/segmentos/"
URL_ENQUADRAMENTOS = "/api/v1/pricing/enquadramentos/"
URL_RESOLVER = "/api/v1/pricing/enquadramentos/resolver/"


def build_dev_jwt(
    role: str = "ADMIN",
    email: str | None = None,
) -> str:
    """Constrói JWT HS256 idêntico ao gerado pelo provider dev-credentials."""
    if email is None:
        email = f"{role.lower()}@pricing-test.com"
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
        defaults={
            "email": email,
            "name": name,
        },
    )
    return user


def make_segmento(
    codigo: str = "medio",
    nome: str = "Médio",
    ordem: int = 2,
    fator: str = "1.00",
) -> SegmentoVeicular:
    return SegmentoVeicular.objects.create(
        codigo=codigo,
        nome=nome,
        ordem=ordem,
        fator_responsabilidade=fator,
    )


def make_tamanho(
    codigo: str = "medio",
    nome: str = "Médio",
    ordem: int = 2,
) -> CategoriaTamanho:
    return CategoriaTamanho.objects.create(
        codigo=codigo,
        nome=nome,
        ordem=ordem,
        multiplicador_insumos="1.00",
        multiplicador_horas="1.00",
    )


class PricingViewsTestCase(TenantTestCase):
    """Base para testes de views do pricing_profile.

    Configura:
    - APIClient apontando para o domínio do tenant de teste
    - Dados mínimos (segmento, tamanho) para os testes de resolver
    """

    def setUp(self) -> None:
        super().setUp()
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain

        # Dados base compartilhados
        self.segmento = make_segmento(codigo="medio", nome="Médio")
        self.tamanho = make_tamanho(codigo="medio", nome="Médio")

    def _auth(self, role: str) -> None:
        """Configura autenticação JWT para o role informado."""
        email = f"{role.lower()}-pricing@test.com"
        make_global_user(email=email, name=f"Test {role}")
        token = build_dev_jwt(role=role, email=email)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")


class TestSegmentoVeicularRBAC(PricingViewsTestCase):
    """Testa RBAC no SegmentoVeicularViewSet."""

    def test_consultant_pode_listar_segmentos(self) -> None:
        """CONSULTANT pode fazer GET em /segmentos/ → 200."""
        self._auth("CONSULTANT")
        response = self.client.get(URL_SEGMENTOS)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_consultant_nao_pode_criar_segmento(self) -> None:
        """CONSULTANT não pode fazer POST em /segmentos/ → 403."""
        self._auth("CONSULTANT")
        payload = {
            "codigo": "novo-seg",
            "nome": "Novo Segmento",
            "ordem": 10,
            "fator_responsabilidade": "1.50",
        }
        response = self.client.post(URL_SEGMENTOS, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_pode_criar_segmento(self) -> None:
        """ADMIN pode fazer POST em /segmentos/ → 201."""
        self._auth("ADMIN")
        payload = {
            "codigo": "admin-criado",
            "nome": "Segmento Admin",
            "ordem": 20,
            "fator_responsabilidade": "2.00",
        }
        response = self.client.post(URL_SEGMENTOS, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_sem_autenticacao_retorna_401(self) -> None:
        """Sem token retorna 401."""
        anon_client = APIClient()
        anon_client.defaults["SERVER_NAME"] = self.domain.domain
        response = anon_client.get(URL_SEGMENTOS)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_manager_nao_pode_criar_segmento(self) -> None:
        """MANAGER não pode criar segmento (requer ADMIN+) → 403."""
        self._auth("MANAGER")
        payload = {
            "codigo": "manager-seg",
            "nome": "Segmento Manager",
            "ordem": 30,
            "fator_responsabilidade": "1.80",
        }
        response = self.client.post(URL_SEGMENTOS, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_segmentos_retorna_resultados_paginados(self) -> None:
        """Lista de segmentos retorna estrutura paginada com 'results'."""
        self._auth("CONSULTANT")
        response = self.client.get(URL_SEGMENTOS)
        data = response.json()
        self.assertIn("results", data)


class TestEnquadramentoResolverEndpoint(PricingViewsTestCase):
    """Testa o endpoint POST /enquadramentos/resolver/."""

    def setUp(self) -> None:
        super().setUp()
        # Cria enquadramento para que o resolver encontre match exato
        EnquadramentoVeiculo.objects.create(
            marca="Honda",
            modelo="Civic",
            ano_inicio=2018,
            ano_fim=2023,
            segmento=self.segmento,
            tamanho=self.tamanho,
            prioridade=10,
        )

    def test_consultant_pode_chamar_resolver(self) -> None:
        """CONSULTANT pode chamar POST /resolver/ → 200."""
        self._auth("CONSULTANT")
        payload = {"marca": "Honda", "modelo": "Civic", "ano": 2020}
        response = self.client.post(URL_RESOLVER, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_resolver_resposta_contem_segmento_codigo(self) -> None:
        """Resposta do resolver deve conter campo 'segmento_codigo'."""
        self._auth("CONSULTANT")
        payload = {"marca": "Honda", "modelo": "Civic", "ano": 2020}
        response = self.client.post(URL_RESOLVER, payload, format="json")
        data = response.json()
        self.assertIn("segmento_codigo", data)

    def test_resolver_resposta_contem_origem(self) -> None:
        """Resposta do resolver deve conter campo 'origem'."""
        self._auth("CONSULTANT")
        payload = {"marca": "Honda", "modelo": "Civic", "ano": 2020}
        response = self.client.post(URL_RESOLVER, payload, format="json")
        data = response.json()
        self.assertIn("origem", data)

    def test_resolver_match_exato_retorna_origem_exato(self) -> None:
        """Veículo com enquadramento exato → origem = 'exato' na resposta."""
        self._auth("CONSULTANT")
        payload = {"marca": "Honda", "modelo": "Civic", "ano": 2020}
        response = self.client.post(URL_RESOLVER, payload, format="json")
        data = response.json()
        self.assertEqual(data["origem"], "exato")

    def test_resolver_sem_enquadramento_retorna_fallback(self) -> None:
        """Veículo sem enquadramento → origem = 'fallback' na resposta."""
        self._auth("CONSULTANT")
        payload = {"marca": "MarcaX", "modelo": "ModeloX", "ano": 2020}
        response = self.client.post(URL_RESOLVER, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["origem"], "fallback")

    def test_resolver_ano_invalido_retorna_400(self) -> None:
        """ano = 9999 (acima do max_value=2100) deve retornar 400."""
        self._auth("CONSULTANT")
        payload = {"marca": "Honda", "modelo": "Civic", "ano": 9999}
        response = self.client.post(URL_RESOLVER, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_resolver_sem_campo_obrigatorio_retorna_400(self) -> None:
        """Payload sem campo 'marca' deve retornar 400."""
        self._auth("CONSULTANT")
        payload = {"modelo": "Civic", "ano": 2020}
        response = self.client.post(URL_RESOLVER, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_resolver_sem_autenticacao_retorna_401(self) -> None:
        """Sem token, POST /resolver/ retorna 401."""
        anon_client = APIClient()
        anon_client.defaults["SERVER_NAME"] = self.domain.domain
        payload = {"marca": "Honda", "modelo": "Civic", "ano": 2020}
        response = anon_client.post(URL_RESOLVER, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
