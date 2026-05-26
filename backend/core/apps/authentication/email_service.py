"""
Paddock Solutions — Email Service

Sends transactional emails via Resend API (https://resend.com).
Falls back to Django console email backend in dev (when RESEND_API_KEY is empty).
"""
import logging

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


def _get_from_address() -> str:
    """Get sender address from settings."""
    return getattr(settings, "EMAIL_FROM", "noreply@paddock.solutions")


def _send_email(to: str, subject: str, html: str) -> bool:
    """Send email via Resend API.

    Args:
        to: Recipient email address.
        subject: Email subject.
        html: HTML body content.

    Returns:
        True if sent successfully, False otherwise.
    """
    api_key = getattr(settings, "RESEND_API_KEY", "")
    if not api_key:
        logger.info("RESEND_API_KEY not configured -- logging email to console.")
        logger.info("TO: %s | SUBJECT: %s", to, subject)
        logger.info("BODY: %s", html[:200])
        return True

    try:
        response = httpx.post(
            RESEND_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": _get_from_address(),
                "to": [to],
                "subject": subject,
                "html": html,
            },
            timeout=10.0,
        )
        if response.status_code in (200, 201):
            logger.info("Email enviado para %s via Resend.", to)
            return True
        logger.warning("Resend API retornou status %s: %s", response.status_code, response.text[:200])
        return False
    except Exception:
        logger.exception("Falha ao enviar email via Resend para %s", to)
        return False


def send_reset_password_email(to: str, reset_url: str) -> bool:
    """Send password reset email.

    Args:
        to: Recipient email address.
        reset_url: Full URL to the password reset page (with token).

    Returns:
        True if sent successfully.
    """
    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Redefinir senha</h2>
        <p>Recebemos uma solicitacao para redefinir sua senha no Paddock Solutions.</p>
        <p>Clique no botao abaixo para criar uma nova senha:</p>
        <p style="text-align: center; margin: 32px 0;">
            <a href="{reset_url}"
               style="background-color: #059669; color: white; padding: 12px 32px;
                      text-decoration: none; border-radius: 6px; font-weight: bold;">
                Redefinir Senha
            </a>
        </p>
        <p style="color: #666; font-size: 14px;">
            Este link expira em 1 hora. Se voce nao solicitou, ignore este email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
        <p style="color: #999; font-size: 12px;">Paddock Solutions &mdash; paddock.solutions</p>
    </div>
    """
    return _send_email(to, "Redefinir senha - Paddock Solutions", html)


def send_verification_email(to: str, verify_url: str) -> bool:
    """Send email verification link.

    Args:
        to: Recipient email address.
        verify_url: Full URL to the email verification page (with token).

    Returns:
        True if sent successfully.
    """
    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verificar email</h2>
        <p>Bem-vindo ao Paddock Solutions! Verifique seu email clicando no botao abaixo:</p>
        <p style="text-align: center; margin: 32px 0;">
            <a href="{verify_url}"
               style="background-color: #059669; color: white; padding: 12px 32px;
                      text-decoration: none; border-radius: 6px; font-weight: bold;">
                Verificar Email
            </a>
        </p>
        <p style="color: #666; font-size: 14px;">
            Este link expira em 24 horas.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
        <p style="color: #999; font-size: 12px;">Paddock Solutions &mdash; paddock.solutions</p>
    </div>
    """
    return _send_email(to, "Verificar email - Paddock Solutions", html)
