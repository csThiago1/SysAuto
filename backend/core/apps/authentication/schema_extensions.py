"""Extensões drf-spectacular pra registrar nossos authenticators customizados.

Sem estas extensões, o `manage.py spectacular` emite ~30 warnings do tipo
"could not resolve authenticator <class 'X'>". As classes JWT do projeto são
Bearer JWT padrão — só faltava dizer isso pro spectacular.

Registrado automaticamente pelo AppConfig.ready() (ver apps.py).
"""
from __future__ import annotations

from drf_spectacular.extensions import OpenApiAuthenticationExtension
from drf_spectacular.plumbing import build_bearer_security_scheme_object


class _BearerJWTScheme(OpenApiAuthenticationExtension):
    """Base pra authenticators Bearer JWT — subclasses só precisam de target_class."""

    name: str = ""

    def get_security_definition(self, auto_schema):
        return build_bearer_security_scheme_object(
            header_name="HTTP_AUTHORIZATION",
            token_prefix="Bearer",
            bearer_format="JWT",
        )


class NativeJWTScheme(_BearerJWTScheme):
    target_class = "apps.authentication.backends.NativeJWTAuthentication"
    name = "nativeJWT"


class KeycloakJWTScheme(_BearerJWTScheme):
    target_class = "apps.authentication.backends.KeycloakJWTAuthentication"
    name = "keycloakJWT"


class DevJWTScheme(_BearerJWTScheme):
    target_class = "config.settings.dev.DevJWTAuthentication"
    name = "devJWT"
