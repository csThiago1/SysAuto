"""Refresh tokens emitidos no mesmo segundo precisam ser diferentes (hash único no banco)."""

from types import SimpleNamespace

from apps.authentication.jwt_utils import generate_refresh_token


def test_refresh_tokens_do_mesmo_segundo_sao_diferentes() -> None:
    user = SimpleNamespace(pk=1)
    assert generate_refresh_token(user) != generate_refresh_token(user)
