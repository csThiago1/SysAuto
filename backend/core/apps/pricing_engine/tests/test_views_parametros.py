"""
Paddock Solutions — Pricing Engine — Tests: Views de Parâmetros
Motor de Orçamentos (MO) — Sprint 03: Adapters de Custo

Testa RBAC e funcionalidade dos endpoints de parâmetros e debug.
"""
import hashlib
import time
import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import patch

import jwt as pyjwt
from django_tenants.test.cases import TenantTestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.pricing_catalog.models import CategoriaMaoObra
from apps.pricing_engine.models import (
    CustoHoraFallback,
    ParametroCustoHora,
    ParametroRateio,
)
from apps.pricing_engine.services import CustoHora
from apps.pricing_profile.models import Empresa

_DEV_JWT_SECRET = "dscar-dev-secret-paddock-2025"

URL_PARAMETROS_RATEIO = "/api/v1/pricing/engine/parametros/rateio/"
URL_PARAMETROS_CUSTO_HORA = "/api/v1/pricing/engine/parametros/custo-hora/"
URL_CUSTO_HORA_FALLBACK = "/api/v1/pricing/engine/parametros/custo-hora-fallback/"
URL_DEBUG_CUSTO_HORA = "/api/v1/pricing/engine/debug/custo-hora/"
URL_DEBUG_RATEIO = "/api/v1/pricing/engine/debug/rateio/"


def build_dev_jwt(role: str = "ADMIN", email: str | None = None) -> str:
    """Constrói JWT HS256 idêntico ao gerado pelo provider dev-credentials."""
    if email is None:
        email = f"{role.lower()}-engine@pricing-test.com"
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


def make_empresa(cnpj: str = "66666666000166") -> Empresa:
    """Cria uma Empresa de teste."""
    return Empresa.objects.create(
        cnpj=cnpj,
        nome_fantasia=f"Empresa Views {cnpj}",
        razao_social=f"Empresa Views Ltda — {cnpj}",
    )


def make_categoria_mao_obra(
    codigo: str = "funileiro",
    nome: str = "Funileiro",
) -> CategoriaMaoObra:
    """Cria CategoriaMaoObra de teste."""
    return CategoriaMaoObra.objects.get_or_create(
        codigo=codigo,
        defaults={"nome": nome},
    )[0]


class EngineViewsTestCase(TenantTestCase):
    """Base para testes de views do pricing_engine."""

    def setUp(self) -> None:
        super().setUp()
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        self.empresa = make_empresa()

    def _auth(self, role: str) -> None:
        """Configura autenticação JWT para o role informado."""
        email = f"{role.lower()}-engine@test.com"
        make_global_user(email=email, name=f"Test {role}")
        token = build_dev_jwt(role=role, email=email)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")


# ─── ParametroRateio RBAC ────────────────────────────────────────────────────


class TestParametroRateioRBAC(EngineViewsTestCase):
    """Testa RBAC no ParametroRateioViewSet."""

    def test_consultant_nao_pode_listar_parametros_rateio(self) -> None:
        """CONSULTANT não pode GET em /parametros/rateio/ (requer MANAGER+) → 403."""
        self._auth("CONSULTANT")
        response = self.client.get(URL_PARAMETROS_RATEIO)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_pode_listar_parametros_rateio(self) -> None:
        """MANAGER pode GET em /parametros/rateio/ → 200."""
        self._auth("MANAGER")
        response = self.client.get(URL_PARAMETROS_RATEIO)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_manager_nao_pode_criar_parametro_rateio(self) -> None:
        """MANAGER não pode POST em /parametros/rateio/ (requer ADMIN+) → 403."""
        self._auth("MANAGER")
        payload = {
            "empresa": str(self.empresa.id),
            "vigente_desde": "2024-01-01",
            "vigente_ate": None,
            "horas_produtivas_mes": "168.00",
            "metodo": "por_hora",
            "observacoes": "",
        }
        response = self.client.post(URL_PARAMETROS_RATEIO, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_pode_criar_parametro_rateio(self) -> None:
        """ADMIN pode POST em /parametros/rateio/ → 201."""
        self._auth("ADMIN")
        payload = {
            "empresa": str(self.empresa.id),
            "vigente_desde": "2024-01-01",
            "vigente_ate": None,
            "horas_produtivas_mes": "168.00",
            "metodo": "por_hora",
            "observacoes": "Criado no teste",
        }
        response = self.client.post(URL_PARAMETROS_RATEIO, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["metodo"], "por_hora")

    def test_sem_autenticacao_retorna_401(self) -> None:
        """Sem token retorna 401."""
        anon_client = APIClient()
        anon_client.defaults["SERVER_NAME"] = self.domain.domain
        response = anon_client.get(URL_PARAMETROS_RATEIO)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_lista_retorna_resultados_paginados(self) -> None:
        """Lista de parâmetros retorna estrutura paginada com 'results'."""
        self._auth("MANAGER")
        response = self.client.get(URL_PARAMETROS_RATEIO)
        self.assertIn("results", response.json())


# ─── ParametroCustoHora RBAC ─────────────────────────────────────────────────


class TestParametroCustoHoraRBAC(EngineViewsTestCase):
    """Testa RBAC no ParametroCustoHoraViewSet."""

    def test_manager_pode_listar(self) -> None:
        """MANAGER pode GET → 200."""
        self._auth("MANAGER")
        response = self.client.get(URL_PARAMETROS_CUSTO_HORA)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_consultant_nao_pode_listar(self) -> None:
        """CONSULTANT não pode GET → 403."""
        self._auth("CONSULTANT")
        response = self.client.get(URL_PARAMETROS_CUSTO_HORA)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_nao_pode_criar(self) -> None:
        """MANAGER não pode POST → 403."""
        self._auth("MANAGER")
        payload = {
            "empresa": str(self.empresa.id),
            "vigente_desde": "2024-01-01",
            "vigente_ate": None,
            "provisao_13_ferias": "0.1389",
            "multa_fgts_rescisao": "0.0320",
            "beneficios_por_funcionario": "0.00",
            "horas_produtivas_mes": "168.00",
            "observacoes": "",
        }
        response = self.client.post(
            URL_PARAMETROS_CUSTO_HORA, payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_pode_criar(self) -> None:
        """ADMIN pode POST → 201."""
        self._auth("ADMIN")
        payload = {
            "empresa": str(self.empresa.id),
            "vigente_desde": "2024-01-01",
            "vigente_ate": None,
            "provisao_13_ferias": "0.1389",
            "multa_fgts_rescisao": "0.0320",
            "beneficios_por_funcionario": "0.00",
            "horas_produtivas_mes": "168.00",
            "observacoes": "Criado em teste",
        }
        response = self.client.post(
            URL_PARAMETROS_CUSTO_HORA, payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


# ─── CustoHoraFallback RBAC ───────────────────────────────────────────────────


class TestCustoHoraFallbackRBAC(EngineViewsTestCase):
    """Testa RBAC no CustoHoraFallbackViewSet."""

    def setUp(self) -> None:
        super().setUp()
        self.categoria = make_categoria_mao_obra()

    def test_manager_pode_listar(self) -> None:
        """MANAGER pode GET → 200."""
        self._auth("MANAGER")
        response = self.client.get(URL_CUSTO_HORA_FALLBACK)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_consultant_nao_pode_listar(self) -> None:
        """CONSULTANT não pode GET → 403."""
        self._auth("CONSULTANT")
        response = self.client.get(URL_CUSTO_HORA_FALLBACK)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_pode_criar_fallback(self) -> None:
        """ADMIN pode POST → 201 com categoria_nome no retorno."""
        self._auth("ADMIN")
        payload = {
            "empresa": str(self.empresa.id),
            "categoria": str(self.categoria.id),
            "vigente_desde": "2024-01-01",
            "vigente_ate": None,
            "valor_hora": "95.00",
            "motivo": "Aguardando RH",
        }
        response = self.client.post(
            URL_CUSTO_HORA_FALLBACK, payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["categoria_nome"], self.categoria.nome)

    def test_manager_nao_pode_criar_fallback(self) -> None:
        """MANAGER não pode POST → 403."""
        self._auth("MANAGER")
        payload = {
            "empresa": str(self.empresa.id),
            "categoria": str(self.categoria.id),
            "vigente_desde": "2024-01-01",
            "vigente_ate": None,
            "valor_hora": "95.00",
            "motivo": "",
        }
        response = self.client.post(
            URL_CUSTO_HORA_FALLBACK, payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ─── Debug Endpoints RBAC ────────────────────────────────────────────────────


class TestDebugCustoHoraRBAC(EngineViewsTestCase):
    """Testa o endpoint POST /debug/custo-hora/ — apenas ADMIN+."""

    def setUp(self) -> None:
        super().setUp()
        self.categoria = make_categoria_mao_obra()
        self.payload = {
            "categoria_codigo": self.categoria.codigo,
            "data": "2024-06-15",
            "empresa_id": str(self.empresa.id),
        }

    def test_manager_nao_pode_acessar_debug_custo_hora(self) -> None:
        """MANAGER não pode POST em /debug/custo-hora/ → 403."""
        self._auth("MANAGER")
        response = self.client.post(
            URL_DEBUG_CUSTO_HORA, self.payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch("apps.pricing_engine.views.CustoHoraService.obter")
    def test_admin_pode_acessar_debug_custo_hora(
        self, mock_obter: object
    ) -> None:
        """ADMIN pode POST em /debug/custo-hora/ → 200 com JSON de resultado."""
        mock_obter.return_value = CustoHora(  # type: ignore[attr-defined]
            valor=Decimal("95.00"),
            origem="fallback",
            decomposicao={"fallback_id": "abc", "motivo": "teste"},
            calculado_em=date(2024, 6, 15),
        )

        self._auth("ADMIN")
        response = self.client.post(
            URL_DEBUG_CUSTO_HORA, self.payload, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("valor", data)
        self.assertIn("origem", data)
        self.assertIn("decomposicao", data)
        self.assertIn("calculado_em", data)
        self.assertEqual(data["valor"], "95.00")
        self.assertEqual(data["origem"], "fallback")

    @patch("apps.pricing_engine.views.CustoHoraService.obter")
    def test_debug_retorna_404_quando_custo_nao_definido(
        self, mock_obter: object
    ) -> None:
        """Quando CustoNaoDefinido é levantado, retorna 404 com mensagem de erro."""
        from apps.pricing_engine.services import CustoNaoDefinido

        mock_obter.side_effect = CustoNaoDefinido("Sem dados para categoria")  # type: ignore[attr-defined]

        self._auth("ADMIN")
        response = self.client.post(
            URL_DEBUG_CUSTO_HORA, self.payload, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn("erro", response.json())

    def test_debug_custo_hora_sem_autenticacao_retorna_401(self) -> None:
        """Sem token retorna 401."""
        anon_client = APIClient()
        anon_client.defaults["SERVER_NAME"] = self.domain.domain
        response = anon_client.post(
            URL_DEBUG_CUSTO_HORA, self.payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class TestDebugRateioRBAC(EngineViewsTestCase):
    """Testa o endpoint POST /debug/rateio/ — apenas ADMIN+."""

    def setUp(self) -> None:
        super().setUp()
        self.payload = {
            "data": "2024-06-15",
            "empresa_id": str(self.empresa.id),
        }

    def test_manager_nao_pode_acessar_debug_rateio(self) -> None:
        """MANAGER não pode POST em /debug/rateio/ → 403."""
        self._auth("MANAGER")
        response = self.client.post(URL_DEBUG_RATEIO, self.payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch("apps.pricing_engine.views.DespesaRecorrenteService.decomposicao_vigente")
    @patch("apps.pricing_engine.views.DespesaRecorrenteService.total_vigente")
    @patch("apps.pricing_engine.views.RateioService.por_hora")
    def test_admin_pode_acessar_debug_rateio(
        self,
        mock_rateio: object,
        mock_total: object,
        mock_decomp: object,
    ) -> None:
        """ADMIN pode POST em /debug/rateio/ → 200 com JSON de resultado."""
        mock_rateio.return_value = Decimal("10.0000")  # type: ignore[attr-defined]
        mock_total.return_value = Decimal("1680.00")  # type: ignore[attr-defined]
        mock_decomp.return_value = []  # type: ignore[attr-defined]

        self._auth("ADMIN")
        response = self.client.post(URL_DEBUG_RATEIO, self.payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("rateio_hora", data)
        self.assertIn("total_despesas", data)
        self.assertIn("decomposicao_despesas", data)
        self.assertEqual(data["rateio_hora"], "10.0000")

    @patch("apps.pricing_engine.views.RateioService.por_hora")
    def test_debug_rateio_retorna_404_quando_parametro_nao_definido(
        self, mock_rateio: object
    ) -> None:
        """Quando ParametroRateioNaoDefinido é levantado, retorna 404."""
        from apps.pricing_engine.services import ParametroRateioNaoDefinido

        mock_rateio.side_effect = ParametroRateioNaoDefinido("Sem parâmetro")  # type: ignore[attr-defined]

        self._auth("ADMIN")
        response = self.client.post(URL_DEBUG_RATEIO, self.payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn("erro", response.json())
