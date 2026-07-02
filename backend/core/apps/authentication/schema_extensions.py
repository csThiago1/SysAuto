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


def response_fields_are_required(result, generator, request, public):
    """Postprocessing hook: marca TODAS as properties como required nos responses.

    DRF sempre serializa todos os campos declarados num serializer de leitura —
    campo "ausente" não existe; o que pode acontecer é vir null (e aí o schema
    já marca nullable). Mas o drf-spectacular monta `required` a partir de
    `field.required`, que é False pra qualquer campo com default no model —
    semântica de REQUEST vazando pro RESPONSE. Sem este hook, o codegen TS
    gera `subtotal?: string` pra campos que sempre vêm na resposta.

    Com COMPONENT_SPLIT_REQUEST=True os componentes de request têm sufixo
    "Request" (inclui "PatchedXxxRequest") e ficam intactos — lá a
    opcionalidade é correta e desejada.
    Registrado em SPECTACULAR_SETTINGS["POSTPROCESSING_HOOKS"].
    """
    schemas = result.get("components", {}).get("schemas", {})
    for name, schema in schemas.items():
        if name.endswith("Request"):
            continue
        props = schema.get("properties")
        if not props:
            continue
        schema["required"] = sorted(props.keys())
    return result
