"""DEPRECATED: substituído por apps.pdf_engine.services.PDFService no Ciclo 03.
   Mantido apenas para retrocompat de testes antigos.
   Remover no Ciclo 5 quando S3Service.put_pdf estiver integrado.
"""
from __future__ import annotations

import uuid


def render_budget_pdf_stub(budget_number: str, version_number: int) -> str:
    """Retorna S3 key simulado. No Ciclo 5, substituído por WeasyPrint + upload real."""
    return f"stub://budgets/{budget_number}/v{version_number}-{uuid.uuid4().hex[:8]}.pdf"
