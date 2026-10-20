"""
Paddock Solutions — Accounting: cliente LLM mínimo.

Fala com qualquer endpoint compatível com a API OpenAI (`/chat/completions`).
Hoje aponta para a chave OpenCode; para migrar pro Ollama na VM, basta mudar
LLM_BASE_URL. Não é uma camada de provider — é uma função com uma URL.
"""

import logging

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

_TIMEOUT_SECONDS = 5.0


def is_configured() -> bool:
    """True se há endpoint e modelo configurados para chamar a LLM."""
    return bool(getattr(settings, "LLM_BASE_URL", "") and getattr(settings, "LLM_MODEL", ""))


def complete(prompt: str) -> str:
    """
    Envia um prompt e devolve o texto da resposta.

    Args:
        prompt: Mensagem de usuário única (sem histórico).

    Returns:
        Conteúdo textual da resposta, já sem espaços nas pontas. String vazia
        em qualquer falha — timeout, erro HTTP, resposta fora do formato.
        Nunca levanta exceção: o chamador trata ausência de sugestão, não erro.
    """
    if not is_configured():
        return ""

    base_url = str(settings.LLM_BASE_URL).rstrip("/")
    headers = {"Content-Type": "application/json"}
    api_key = getattr(settings, "LLM_API_KEY", "")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        response = httpx.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json={
                "model": settings.LLM_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0,
            },
            timeout=_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        return str(content).strip()
    except (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError) as exc:
        # Falha de LLM nunca vira erro de request — o formulário só fica sem sugestão.
        logger.warning("LLM indisponível ao classificar despesa: %s", type(exc).__name__)
        return ""
