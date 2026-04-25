"""
Paddock Solutions — Fiscal — Management Command
Ciclo 06B: register_focus_webhook

Registra (ou atualiza) o endpoint de webhook na Focus NF-e v2.

Uso:
    python manage.py register_focus_webhook
    python manage.py register_focus_webhook --base-url https://meusite.ngrok.io

O comando constrói a URL do webhook como:
    {BASE_URL}/api/v1/fiscal/webhooks/focus/{FOCUS_NFE_WEBHOOK_SECRET}/

Em caso de erro: imprime mensagem descritiva e sai com código 1.
"""

import logging
import sys

import httpx

from django.conf import settings
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)

FOCUS_WEBHOOKS_PATH = "/v2/hooks"


class Command(BaseCommand):
    """Registra webhook na Focus NF-e para receber notificações de status."""

    help = "Registra (ou atualiza) o webhook do Focus NF-e v2."

    def add_arguments(self, parser):  # type: ignore[override]
        parser.add_argument(
            "--base-url",
            type=str,
            default=None,
            help=(
                "URL base pública do servidor (ex: https://meusite.ngrok.io). "
                "Se não informado, usa DJANGO_ALLOWED_HOSTS[0]."
            ),
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Exibe a URL que seria registrada sem fazer a requisição.",
        )

    def handle(self, *args: object, **options: object) -> None:  # type: ignore[override]
        token: str = settings.FOCUS_NFE_TOKEN
        focus_base_url: str = settings.FOCUS_NFE_BASE_URL
        webhook_secret: str = settings.FOCUS_NFE_WEBHOOK_SECRET

        if not token:
            self.stderr.write(self.style.ERROR("FOCUS_NFE_TOKEN não configurado."))
            sys.exit(1)

        if not webhook_secret:
            self.stderr.write(self.style.ERROR("FOCUS_NFE_WEBHOOK_SECRET não configurado."))
            sys.exit(1)

        # Determinar base URL pública
        base_url: str | None = options.get("base_url")  # type: ignore[assignment]
        if not base_url:
            allowed = settings.ALLOWED_HOSTS
            if not allowed or allowed == ["*"]:
                self.stderr.write(
                    self.style.ERROR(
                        "Não foi possível determinar a URL pública. "
                        "Use --base-url https://seudominio.com"
                    )
                )
                sys.exit(1)
            host = allowed[0].lstrip(".")
            base_url = f"https://{host}"

        webhook_url = f"{base_url}/api/v1/fiscal/webhooks/focus/{webhook_secret}/"

        self.stdout.write(f"Registrando webhook em: {webhook_url}")
        self.stdout.write(f"Focus base URL: {focus_base_url}")

        if options.get("dry_run"):
            self.stdout.write(self.style.SUCCESS("[dry-run] Nenhuma requisição realizada."))
            return

        payload = {
            "cnpj": settings.CNPJ_EMISSOR,
            "url": webhook_url,
        }

        try:
            response = httpx.post(
                f"{focus_base_url}{FOCUS_WEBHOOKS_PATH}",
                auth=(token, ""),
                json=payload,
                timeout=30,
            )
        except httpx.RequestError as exc:
            self.stderr.write(self.style.ERROR(f"Erro de rede ao registrar webhook: {exc}"))
            sys.exit(1)

        if response.status_code in (200, 201):
            self.stdout.write(
                self.style.SUCCESS(
                    f"Webhook registrado com sucesso! Status: {response.status_code}"
                )
            )
            try:
                self.stdout.write(str(response.json()))
            except Exception:
                pass
        else:
            self.stderr.write(
                self.style.ERROR(
                    f"Falha ao registrar webhook. Status: {response.status_code}\n"
                    f"Resposta: {response.text[:500]}"
                )
            )
            sys.exit(1)
