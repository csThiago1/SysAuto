"""
Paddock Solutions — Cilia API Client
"""
import httpx
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

def buscar_orcamento(casualty_number: str, budget_number: str, version_number: int | str = None) -> dict:
    """
    Busca o orçamento na API do Cilia.
    """
    CILIA_BASE_URL = getattr(settings, "CILIA_BASE_URL", "https://sistema.cilia.com.br")
    CILIA_AUTH_TOKEN = getattr(settings, "CILIA_AUTH_TOKEN", "")

    if not CILIA_AUTH_TOKEN:
        logger.warning("CILIA_AUTH_TOKEN não está configurado.")

    params = {
        "auth_token": CILIA_AUTH_TOKEN,
        "casualty_number": casualty_number,
        "budget_number": budget_number,
    }
    
    if version_number is not None:
        params["version_number"] = version_number

    endpoint = f"{CILIA_BASE_URL}/api/integration/insurer_budgets/by_casualty_number_and_budget_number"
    
    with httpx.Client(timeout=30) as client:
        response = client.get(endpoint, params=params)
        response.raise_for_status()
        return response.json()
