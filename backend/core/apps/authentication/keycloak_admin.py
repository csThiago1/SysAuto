"""
Paddock Solutions — Keycloak Admin API Client

Cria/atualiza usuários no Keycloak via Admin REST API.
Usado na admissão de colaboradores para provisionar credenciais de acesso.

Referência: https://www.keycloak.org/docs-api/24.0.0/rest-api/
"""
import logging
from typing import Any

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# Configuração — lida de settings ou variáveis de ambiente
_KEYCLOAK_BASE_URL = getattr(settings, "KEYCLOAK_BASE_URL", "http://keycloak:8080")
_KEYCLOAK_REALM = getattr(settings, "KEYCLOAK_REALM", "paddock")
_KEYCLOAK_ADMIN_USER = getattr(settings, "KEYCLOAK_ADMIN_USER", "admin")
_KEYCLOAK_ADMIN_PASSWORD = getattr(settings, "KEYCLOAK_ADMIN_PASSWORD", "admin")


class KeycloakAdminError(Exception):
    """Erro ao interagir com a Keycloak Admin API."""


def _get_admin_token() -> str:
    """Obtém token de admin via client_credentials do realm master."""
    url = f"{_KEYCLOAK_BASE_URL}/realms/master/protocol/openid-connect/token"
    try:
        resp = requests.post(
            url,
            data={
                "grant_type": "password",
                "client_id": "admin-cli",
                "username": _KEYCLOAK_ADMIN_USER,
                "password": _KEYCLOAK_ADMIN_PASSWORD,
            },
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()["access_token"]
    except requests.RequestException as exc:
        logger.warning("Keycloak Admin: falha ao obter token — %s", exc)
        raise KeycloakAdminError(f"Falha ao autenticar no Keycloak: {exc}") from exc


def create_keycloak_user(
    *,
    username: str,
    email: str,
    first_name: str,
    last_name: str,
    password: str,
    enabled: bool = True,
) -> str | None:
    """Cria usuário no Keycloak e retorna o ID gerado.

    Se o usuário já existir (por username ou email), retorna None sem erro.
    A senha é definida como temporária=False (não exige troca no primeiro login).

    Args:
        username: Login do colaborador (ex: joao.silva)
        email: Email do colaborador
        first_name: Primeiro nome
        last_name: Sobrenome
        password: Senha inicial (CPF)
        enabled: Se o usuário está ativo

    Returns:
        ID do usuário no Keycloak, ou None se já existia.

    Raises:
        KeycloakAdminError: Se houver erro na comunicação com o Keycloak.
    """
    try:
        token = _get_admin_token()
    except KeycloakAdminError:
        logger.warning("Keycloak Admin: indisponível — usuário não criado no Keycloak")
        return None

    base = f"{_KEYCLOAK_BASE_URL}/admin/realms/{_KEYCLOAK_REALM}"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    payload: dict[str, Any] = {
        "username": username,
        "email": email,
        "firstName": first_name,
        "lastName": last_name,
        "enabled": enabled,
        "emailVerified": True,
        "credentials": [
            {
                "type": "password",
                "value": password,
                "temporary": False,
            }
        ],
        "attributes": {
            "companies": ["dscar"],
            "active_company": ["dscar"],
            "tenant_schema": ["tenant_dscar"],
            "client_slug": ["grupo-dscar"],
        },
    }

    try:
        resp = requests.post(f"{base}/users", json=payload, headers=headers, timeout=10)

        if resp.status_code == 201:
            # Extrair ID do header Location
            location = resp.headers.get("Location", "")
            kc_id = location.rsplit("/", 1)[-1] if location else None
            logger.info("Keycloak: usuário '%s' criado com sucesso (id=%s)", username, kc_id)

            # Atribuir role CONSULTANT ao novo usuário
            if kc_id:
                _assign_realm_role(base, headers, kc_id, "CONSULTANT")

            return kc_id

        if resp.status_code == 409:
            # Usuário já existe
            logger.info("Keycloak: usuário '%s' já existe — ignorando", username)
            return None

        logger.warning(
            "Keycloak Admin: erro ao criar usuário '%s' — %s %s",
            username, resp.status_code, resp.text[:200],
        )
        return None

    except requests.RequestException as exc:
        logger.warning("Keycloak Admin: falha na requisição — %s", exc)
        return None


def _assign_realm_role(
    base_url: str, headers: dict[str, str], user_id: str, role_name: str
) -> None:
    """Atribui uma realm role a um usuário no Keycloak."""
    try:
        # Buscar role pelo nome
        resp = requests.get(f"{base_url}/roles/{role_name}", headers=headers, timeout=10)
        if resp.status_code != 200:
            logger.warning("Keycloak: role '%s' não encontrada", role_name)
            return

        role_data = resp.json()
        resp2 = requests.post(
            f"{base_url}/users/{user_id}/role-mappings/realm",
            json=[{"id": role_data["id"], "name": role_name}],
            headers=headers,
            timeout=10,
        )
        if resp2.status_code == 204:
            logger.info("Keycloak: role '%s' atribuída ao user %s", role_name, user_id)
        else:
            logger.warning("Keycloak: falha ao atribuir role — %s", resp2.status_code)
    except requests.RequestException as exc:
        logger.warning("Keycloak: falha ao atribuir role — %s", exc)


def disable_keycloak_user(keycloak_id: str) -> bool:
    """Desativa um usuário no Keycloak (para demissão).

    Args:
        keycloak_id: UUID do usuário no Keycloak.

    Returns:
        True se desativou com sucesso, False caso contrário.
    """
    try:
        token = _get_admin_token()
    except KeycloakAdminError:
        return False

    base = f"{_KEYCLOAK_BASE_URL}/admin/realms/{_KEYCLOAK_REALM}"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    try:
        resp = requests.put(
            f"{base}/users/{keycloak_id}",
            json={"enabled": False},
            headers=headers,
            timeout=10,
        )
        if resp.status_code == 204:
            logger.info("Keycloak: usuário %s desativado", keycloak_id)
            return True
        logger.warning("Keycloak: falha ao desativar %s — %s", keycloak_id, resp.status_code)
        return False
    except requests.RequestException as exc:
        logger.warning("Keycloak: falha na requisição — %s", exc)
        return False
