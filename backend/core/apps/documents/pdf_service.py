from __future__ import annotations

import logging
import uuid
from io import BytesIO
from typing import Any

from django.template.loader import render_to_string


logger = logging.getLogger(__name__)


_DOCUMENT_TEMPLATES = {
    "os_report": "pdf_engine/os_report.html",
    "warranty": "pdf_engine/warranty.html",
    "settlement": "pdf_engine/settlement.html",
    "receipt": "pdf_engine/receipt.html",
}


def _html_to_pdf(html: str) -> bytes:
    """Converte HTML em bytes de PDF via WeasyPrint, com fallback para HTML."""
    try:
        from weasyprint import HTML

        buf = BytesIO()
        HTML(string=html).write_pdf(buf)
        return buf.getvalue()
    except Exception as exc:
        logger.warning("WeasyPrint indisponível, retornando HTML bytes: %s", exc)
        return html.encode("utf-8")


class PDFService:
    """Geração de PDFs via WeasyPrint.

    Fallback para HTML bytes se WeasyPrint não disponível (permite rodar testes
    em ambientes sem libs nativas GTK/Pango). Em produção, WeasyPrint sempre
    disponível via imagem Docker com dependências instaladas.
    """

    @classmethod
    def render_html(cls, template_name: str, context: dict[str, Any]) -> bytes:
        """Renderiza qualquer template HTML como PDF genérico."""
        html = render_to_string(template_name, context)
        return _html_to_pdf(html)

    @classmethod
    def render_document(cls, document_type: str, context: dict[str, Any]) -> bytes:
        """Renderiza documento PDF por tipo (os_report, warranty, settlement, receipt)."""
        template_name = _DOCUMENT_TEMPLATES.get(document_type)
        if not template_name:
            raise ValueError(f"Tipo de documento desconhecido: {document_type}")
        return cls.render_html(template_name, context)

    @classmethod
    def render_budget(cls, version: Any) -> bytes:
        """Renderiza PDF de orçamento particular (budgets.BudgetVersion)."""
        return cls.render_html(
            "pdf_engine/budget.html",
            {
                "version": version,
                "budget": version.budget,
                "customer": version.budget.customer,
                "items": version.items.all(),
                "totals": {
                    "subtotal": version.subtotal,
                    "discount": version.discount_total,
                    "total": version.net_total,
                    "labor": version.labor_total,
                    "parts": version.parts_total,
                },
            },
        )

    @classmethod
    def orcamento_pdf_key(cls, numero: str, versao: int) -> str:
        """S3 key para PDF de orçamento (quotes): orcamentos/<numero>/v<n>-<uuid>.pdf"""
        return f"orcamentos/{numero}/v{versao}-{uuid.uuid4().hex[:8]}.pdf"

    @classmethod
    def budget_pdf_key(cls, budget_number: str, version_number: int) -> str:
        """S3 key para PDF de orçamento particular: budgets/<number>/v<n>-<uuid>.pdf"""
        return f"budgets/{budget_number}/v{version_number}-{uuid.uuid4().hex[:8]}.pdf"
