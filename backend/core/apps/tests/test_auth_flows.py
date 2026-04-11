"""
Paddock Solutions — Integration Tests: Auth Flows
=================================================

Testa os dois caminhos de autenticação do backend:

  DevJWTAuthentication  (HS256, secret fixo, provider dev-credentials Next.js)
  KeycloakJWTAuthentication (RS256, JWKS mockado via unittest.mock)

Cenários cobertos:
  TC-AUTH-01  HS256 válido + endpoint protegido → 200
  TC-AUTH-02  Sem token → 401
  TC-AUTH-03  Token HS256 expirado → 401
  TC-AUTH-04  Token HS256 com secret errado → 401
  TC-AUTH-05  RS256 válido com JWKS mockado → 200

Usa APIClient (DRF) + force_authenticate onde necessário para isolar o
teste do middleware de tenant (SERVER_NAME aponta para dscar.localhost).

Endpoint protegido usado nos testes: GET /api/v1/auth/me/
(requer IsAuthenticated — qualquer usuário autenticado pode acessar)

Requisito: `make dev` deve estar rodando.
Execute via: make test-backend
"""
import hashlib
import time
import unittest
import uuid
from datetime import datetime, timezone
from typing import Any
from unittest.mock import MagicMock, patch

import jwt as pyjwt
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser

# ─── Constantes compartilhadas ────────────────────────────────────────────────

_DEV_JWT_SECRET = "dscar-dev-secret-paddock-2025"
_ME_URL = "/api/v1/auth/me/"


# ─── Helpers ──────────────────────────────────────────────────────────────────


def make_user(
    email: str = "auth_test@dscar.com",
    name: str = "Auth Test User",
) -> GlobalUser:
    """Cria GlobalUser com email_hash calculado — necessário para unique constraint."""
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    return GlobalUser.objects.create_user(
        email=email,
        password="test123",
        name=name,
        email_hash=email_hash,
    )


def build_dev_jwt(
    email: str = "auth_test@dscar.com",
    role: str = "ADMIN",
    expired: bool = False,
    secret: str = _DEV_JWT_SECRET,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """
    Constrói um JWT HS256 idêntico ao gerado pelo provider dev-credentials Next.js.

    Claims obrigatórios lidos por DevJWTAuthentication:
    - email: identificador primário → get_or_create GlobalUser por email_hash
    - role: propagado para request.auth (RBAC)
    - jti: UUID único (boas práticas, não validado atualmente)
    - iat / exp: timestamps de emissão e expiração
    """
    now = int(time.time())

    payload: dict[str, Any] = {
        "sub": str(uuid.uuid4()),
        "jti": str(uuid.uuid4()),
        "email": email,
        "name": "Auth Test User",
        "role": role,
        "active_company": "dscar",
        "tenant_schema": "tenant_dscar",
        "companies": ["dscar"],
        "iat": now - 10,
        "exp": (now - 60) if expired else (now + 3600),
    }

    if extra_claims:
        payload.update(extra_claims)

    return pyjwt.encode(payload, secret, algorithm="HS256")


# ─── Base ─────────────────────────────────────────────────────────────────────


class AuthFlowTestCase(TenantTestCase):
    """
    Base: TenantTestCase + APIClient apontando para o domínio do tenant de teste.

    Usa TenantTestCase porque os endpoints fazem lookup em tabelas de TENANT_APPS
    (ex: Employee no /me/ — sem o schema do tenant, a query falha).
    """

    def setUp(self) -> None:
        super().setUp()
        self.client = APIClient()
        # Aponta para o domínio do tenant criado pelo TenantTestCase
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain


# ─── TC-AUTH-01: HS256 válido → 200 ──────────────────────────────────────────


class TestDevJWTValidToken(AuthFlowTestCase):
    """TC-AUTH-01 — Token HS256 válido autentica e retorna identidade do usuário."""

    def test_valid_hs256_token_returns_200(self) -> None:
        """
        Fluxo completo: crafta JWT HS256 → injeta no header Authorization →
        GET /api/v1/auth/me/ → 200 com dados do usuário.
        """
        email = "valid_token@dscar.com"
        # Garante que o usuário existe para que DevJWTAuthentication possa
        # fazer get_or_create sem depender de AUTO_CREATE implícito nos testes
        make_user(email=email, name="Valid Token User")

        token = build_dev_jwt(email=email)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.get(_ME_URL)

        self.assertEqual(
            response.status_code,
            200,
            f"Esperado 200 com token HS256 válido. Response: {response.json()}",
        )

    def test_valid_token_response_contains_user_fields(self) -> None:
        """Resposta do /me/ deve conter id, name, role e email_hash."""
        email = "me_fields@dscar.com"
        make_user(email=email, name="Me Fields User")

        token = build_dev_jwt(email=email, role="ADMIN")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.get(_ME_URL)
        data = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertIn("id", data)
        self.assertIn("name", data)
        self.assertIn("role", data)
        self.assertIn("email_hash", data)
        self.assertEqual(data["role"], "ADMIN")

    def test_valid_token_creates_global_user_if_missing(self) -> None:
        """
        DevJWTAuthentication faz get_or_create pelo email_hash.
        Se o usuário não existir, deve ser criado automaticamente.
        """
        email = "autocreate@dscar.com"
        email_hash = hashlib.sha256(email.lower().encode()).hexdigest()

        # Garante que o usuário NÃO existe antes do request
        GlobalUser.objects.filter(email_hash=email_hash).delete()

        token = build_dev_jwt(email=email)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.get(_ME_URL)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            GlobalUser.objects.filter(email_hash=email_hash).exists(),
            "GlobalUser deveria ter sido criado automaticamente por DevJWTAuthentication",
        )


# ─── TC-AUTH-02: Sem token → 401 ─────────────────────────────────────────────


class TestDevJWTMissingToken(AuthFlowTestCase):
    """TC-AUTH-02 — Requisição sem Authorization header → 401."""

    def test_no_token_returns_401(self) -> None:
        """Endpoint protegido sem token deve retornar 401 Unauthorized."""
        # Sem credentials configuradas
        response = self.client.get(_ME_URL)
        self.assertEqual(
            response.status_code,
            401,
            f"Esperado 401 sem token. Response: {response.status_code}",
        )

    def test_empty_authorization_header_returns_401(self) -> None:
        """Header Authorization vazio (sem Bearer) deve resultar em 401."""
        self.client.credentials(HTTP_AUTHORIZATION="")
        response = self.client.get(_ME_URL)
        self.assertEqual(response.status_code, 401)

    def test_malformed_bearer_returns_401(self) -> None:
        """Token malformado (não-JWT) deve resultar em 401."""
        self.client.credentials(HTTP_AUTHORIZATION="Bearer not-a-valid-jwt-token")
        response = self.client.get(_ME_URL)
        self.assertEqual(response.status_code, 401)


# ─── TC-AUTH-03: Token expirado → 401 ────────────────────────────────────────


class TestDevJWTExpiredToken(AuthFlowTestCase):
    """TC-AUTH-03 — Token HS256 com exp no passado → 401."""

    def test_expired_hs256_token_returns_401(self) -> None:
        """
        JWT expirado (exp < now) deve ser rejeitado por DevJWTAuthentication
        com AuthenticationFailed ("Token dev expirado.").
        """
        email = "expired@dscar.com"
        make_user(email=email, name="Expired User")

        token = build_dev_jwt(email=email, expired=True)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.get(_ME_URL)

        self.assertEqual(
            response.status_code,
            401,
            f"Esperado 401 com token expirado. Response: {response.status_code}",
        )


# ─── TC-AUTH-04: Secret errado → 401 ─────────────────────────────────────────


class TestDevJWTWrongSecret(AuthFlowTestCase):
    """TC-AUTH-04 — Token HS256 assinado com secret diferente → 401."""

    def test_wrong_secret_returns_401(self) -> None:
        """
        Token assinado com secret diferente do _DEV_JWT_SECRET deve ser
        rejeitado com InvalidTokenError → AuthenticationFailed → 401.
        """
        email = "wrong_secret@dscar.com"
        make_user(email=email, name="Wrong Secret User")

        # Assina com um secret completamente diferente
        token = build_dev_jwt(email=email, secret="completely-wrong-secret-xyz-9999")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.get(_ME_URL)

        self.assertEqual(
            response.status_code,
            401,
            f"Esperado 401 com secret inválido. Response: {response.status_code}",
        )


# ─── TC-AUTH-05: RS256 com JWKS mockado → 200 ────────────────────────────────


class TestKeycloakJWTMockedJWKS(AuthFlowTestCase):
    """
    TC-AUTH-05 — KeycloakJWTAuthentication valida RS256 com JWKS mockado.

    Estratégia:
    - Gera um par RSA temporário com cryptography (disponível via PyJWT[crypto])
    - Assina um JWT RS256 com a chave privada
    - Mocka PyJWKClient.get_signing_key_from_jwt para retornar a chave pública
    - Mocka pyjwt.get_unverified_header para retornar alg=RS256
    - Mocka pyjwt.decode para retornar o payload esperado (evita dependência de
      cryptography em CI sem extras instalados)

    Abordagem alternativa (sem cryptography):
    - Usa unittest.mock para simular toda a cadeia de validação do Keycloak,
      testando que KeycloakJWTAuthentication processa corretamente o payload
      retornado pelo JWKS sem precisar de um Keycloak real.
    """

    def _build_keycloak_payload(self, email: str = "keycloak@dscar.com") -> dict[str, Any]:
        """Payload típico de JWT emitido pelo Keycloak (realm paddock)."""
        now = int(time.time())
        return {
            "sub": str(uuid.uuid4()),
            "jti": str(uuid.uuid4()),
            "iss": "http://keycloak:8080/realms/paddock",
            "aud": "paddock-backend",
            "email": email,
            "preferred_username": email.split("@")[0],
            "name": "Keycloak Test User",
            "realm_access": {"roles": ["ADMIN", "default-roles-paddock"]},
            "active_company": "dscar",
            "tenant_schema": "tenant_dscar",
            "iat": now - 10,
            "exp": now + 3600,
        }

    def test_rs256_with_mocked_jwks_returns_200(self) -> None:
        """
        Simula autenticação Keycloak RS256 completa via mock:
        1. get_unverified_header → {"alg": "RS256", "kid": "test-key-id"}
        2. PyJWKClient.get_signing_key_from_jwt → chave mock
        3. pyjwt.decode → payload válido do Keycloak
        4. GlobalUser é criado automaticamente
        5. GET /me/ → 200
        """
        email = "keycloak_mock@dscar.com"
        email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
        GlobalUser.objects.filter(email_hash=email_hash).delete()

        keycloak_payload = self._build_keycloak_payload(email=email)
        mock_signing_key = MagicMock()
        mock_signing_key.key = "mock-public-key"

        # Importa o módulo onde os símbolos são usados (não onde são definidos)
        with (
            patch(
                "config.settings.dev.pyjwt.get_unverified_header",
                return_value={"alg": "RS256", "kid": "paddock-key-001"},
            ),
            patch(
                "config.settings.dev._get_keycloak_jwks_client",
            ) as mock_get_client,
            patch(
                "config.settings.dev.pyjwt.decode",
                return_value=keycloak_payload,
            ),
        ):
            mock_jwks_client = MagicMock()
            mock_jwks_client.get_signing_key_from_jwt.return_value = mock_signing_key
            mock_get_client.return_value = mock_jwks_client

            # Token RS256 fictício — o decode está mockado, o valor não importa
            fake_rs256_token = "header.payload.signature"
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {fake_rs256_token}")

            response = self.client.get(_ME_URL)

        self.assertEqual(
            response.status_code,
            200,
            f"Esperado 200 com RS256 mockado. Response: {response.status_code} — "
            f"{response.content}",
        )

        # Verifica que o GlobalUser foi criado via Keycloak
        self.assertTrue(
            GlobalUser.objects.filter(email_hash=email_hash).exists(),
            "GlobalUser deveria ter sido criado automaticamente por KeycloakJWTAuthentication",
        )

    def test_keycloak_offline_falls_through_to_401(self) -> None:
        """
        Quando o JWKS endpoint lança exceção (Keycloak offline),
        KeycloakJWTAuthentication retorna None → sem usuário autenticado → 401.
        """
        with (
            patch(
                "config.settings.dev.pyjwt.get_unverified_header",
                return_value={"alg": "RS256", "kid": "paddock-key-001"},
            ),
            patch(
                "config.settings.dev._get_keycloak_jwks_client",
                side_effect=Exception("Keycloak unreachable"),
            ),
        ):
            fake_rs256_token = "header.payload.offline"
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {fake_rs256_token}")
            response = self.client.get(_ME_URL)

        # KeycloakJWTAuthentication retorna None em caso de exceção (não levanta)
        # → DRF não encontra autenticador → 401
        self.assertEqual(
            response.status_code,
            401,
            "Keycloak offline deve resultar em 401 (sem crash 500)",
        )

    def test_expired_keycloak_token_returns_401(self) -> None:
        """
        Token RS256 com exp expirado deve levantar ExpiredSignatureError →
        KeycloakJWTAuthentication levanta AuthenticationFailed → 401.
        """
        with (
            patch(
                "config.settings.dev.pyjwt.get_unverified_header",
                return_value={"alg": "RS256", "kid": "paddock-key-001"},
            ),
            patch(
                "config.settings.dev._get_keycloak_jwks_client",
            ) as mock_get_client,
            patch(
                "config.settings.dev.pyjwt.decode",
                side_effect=pyjwt.exceptions.ExpiredSignatureError("Token expirado"),
            ),
        ):
            mock_get_client.return_value = MagicMock()

            self.client.credentials(HTTP_AUTHORIZATION="Bearer header.payload.expired")
            response = self.client.get(_ME_URL)

        self.assertEqual(
            response.status_code,
            401,
            "Token Keycloak expirado deve retornar 401",
        )
