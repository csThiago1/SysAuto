"""Stub de geração de PDF. Substituído por WeasyPrint real no Ciclo 5.

Retorna uma chave S3 simulada; não gera arquivo real.
"""
from __future__ import annotations

import uuid


def render_budget_pdf_stub(budget_number: str, version_number: int) -> str:
    """Retorna S3 key simulado. No Ciclo 5, substituído por WeasyPrint + upload real."""
    return f"stub://budgets/{budget_number}/v{version_number}-{uuid.uuid4().hex[:8]}.pdf"
