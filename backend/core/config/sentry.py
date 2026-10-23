"""Inicialização do Sentry (chamada por settings/railway.py quando SENTRY_DSN existe)."""

from __future__ import annotations

from decouple import config


def init_sentry(dsn: str) -> None:
    import sentry_sdk
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.httpx import HttpxIntegration

    sentry_sdk.init(
        dsn=dsn,
        integrations=[DjangoIntegration(), CeleryIntegration()],
        # LGPD: as URLs do httpx levam placa, CNPJ, CEP e o token da API Placas
        # no path; a integração automática as mandaria em breadcrumbs e spans.
        disabled_integrations=[HttpxIntegration()],
        traces_sample_rate=config("SENTRY_TRACES_SAMPLE_RATE", default=0.1, cast=float),
        profiles_sample_rate=0.0,  # profiling tem custo extra — manter off
        send_default_pii=False,  # LGPD — não enviar email/IP/body do request
        environment=config("SENTRY_ENVIRONMENT", default="production"),
    )
