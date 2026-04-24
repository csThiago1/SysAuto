"""
Testes T2: Settings FOCUS_NFE_* e guard DEBUG/produção.
"""

import pytest


def test_focus_nfe_settings_exist():
    """Settings FOCUS_NFE_* devem estar definidos (com default vazio em test)."""
    from django.conf import settings

    assert hasattr(settings, "FOCUS_NFE_TOKEN")
    assert hasattr(settings, "FOCUS_NFE_AMBIENTE")
    assert hasattr(settings, "FOCUS_NFE_BASE_URL")
    assert hasattr(settings, "FOCUS_NFE_TIMEOUT_SECONDS")
    assert hasattr(settings, "FOCUS_NFE_WEBHOOK_SECRET")
    assert hasattr(settings, "CNPJ_EMISSOR")


def test_focus_nfe_base_url_homologacao():
    """FOCUS_NFE_BASE_URL deve apontar para homologação quando FOCUS_NFE_AMBIENTE=homologacao."""
    from django.conf import settings

    assert settings.FOCUS_NFE_AMBIENTE == "homologacao"
    assert settings.FOCUS_NFE_BASE_URL == "https://homologacao.focusnfe.com.br"


def test_focus_nfe_timeout_is_integer():
    """FOCUS_NFE_TIMEOUT_SECONDS deve ser um inteiro."""
    from django.conf import settings

    assert isinstance(settings.FOCUS_NFE_TIMEOUT_SECONDS, int)
    assert settings.FOCUS_NFE_TIMEOUT_SECONDS > 0
