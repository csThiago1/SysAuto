"""
Paddock Solutions — JWT generation and validation.

Supports HS256 (dev) or RS256 (prod) depending on settings.
Access tokens: 15-min TTL. Refresh tokens: 7-day TTL.
"""
import datetime
import logging

import jwt as pyjwt
from django.conf import settings

logger = logging.getLogger(__name__)


def _get_secret() -> str:
    """Get JWT signing secret -- RS256 private key if available, else HS256 dev secret."""
    return getattr(settings, "JWT_PRIVATE_KEY", None) or getattr(
        settings, "DEV_JWT_SECRET", "dscar-dev-secret-" + "paddock-2025"
    )


def _get_algorithm() -> str:
    """Return RS256 if private key is configured, else HS256."""
    return "RS256" if getattr(settings, "JWT_PRIVATE_KEY", None) else "HS256"


def _get_verify_key() -> str:
    """Get key for verification -- RS256 public key or HS256 shared secret."""
    return getattr(settings, "JWT_PUBLIC_KEY", None) or _get_secret()


def generate_access_token(
    user: "GlobalUser",  # noqa: F821
    permissions: list[str] | None = None,
) -> str:
    """Generate access token with 15-min TTL.

    Args:
        user: GlobalUser instance.
        permissions: Optional list of extra permission strings.

    Returns:
        Encoded JWT string.
    """
    now = datetime.datetime.now(tz=datetime.timezone.utc)
    payload: dict = {
        "sub": str(user.pk),
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "permissions": permissions or [],
        "active_company": "dscar",
        "tenant_schema": "tenant_dscar",
        "client_slug": "grupo-dscar",
        "iat": now,
        "exp": now + datetime.timedelta(minutes=15),
        "token_type": "access",
    }
    return pyjwt.encode(payload, _get_secret(), algorithm=_get_algorithm())


def generate_refresh_token(user: "GlobalUser") -> str:  # noqa: F821
    """Generate refresh token with 7-day TTL.

    Args:
        user: GlobalUser instance.

    Returns:
        Encoded JWT string.
    """
    now = datetime.datetime.now(tz=datetime.timezone.utc)
    payload: dict = {
        "sub": str(user.pk),
        "iat": now,
        "exp": now + datetime.timedelta(days=7),
        "token_type": "refresh",
    }
    return pyjwt.encode(payload, _get_secret(), algorithm=_get_algorithm())


def decode_token(token: str) -> dict:
    """Decode and validate JWT.

    Args:
        token: Raw JWT string.

    Returns:
        Decoded payload dict.

    Raises:
        jwt.ExpiredSignatureError: If token is expired.
        jwt.InvalidTokenError: If token is invalid.
    """
    return pyjwt.decode(
        token,
        _get_verify_key(),
        algorithms=[_get_algorithm()],
        options={"verify_aud": False},
    )
