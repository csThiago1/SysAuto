from __future__ import annotations

import logging
import uuid
from io import BytesIO

from django.template.loader import render_to_string


logger = logging.getLogger(__name__)


class PDFService:
    """Geração de PDFs via WeasyPrint.

    Fallback para HTML bytes se WeasyPrint não disponível (permite rodar testes
    em ambientes sem libs nativas GTK/Pango). Em produção, WeasyPrint sempre
    disponível via imagem Docker com dependências instaladas.
    """

    @classmethod
    def render_budget(cls, version) -> bytes:
        """Renderiza PDF de orçamento para uma BudgetVersion. Retorna bytes do PDF.

        Args:
            version: BudgetVersion com itens e budget relacionados.

        Returns:
            bytes do PDF (WeasyPrint) ou bytes do HTML (fallback quando libs ausentes).
        """
        html = render_to_string("pdf_engine/budget.html", {
            "version": version,
            "budget": version.budget,
            "customer": version.budget.customer,
            "items": version.items.all().prefetch_related(
                "operations__operation_type", "operations__labor_category",
            ),
            "totals": {
                "subtotal": version.subtotal,
                "discount": version.discount_total,
                "labor": version.labor_total,
                "parts": version.parts_total,
                "net": version.net_total,
            },
        })
        try:
            from weasyprint import HTML
            buf = BytesIO()
            HTML(string=html).write_pdf(buf)
            return buf.getvalue()
        except Exception as exc:
            logger.warning("WeasyPrint indisponível, retornando HTML bytes: %s", exc)
            return html.encode("utf-8")

    @classmethod
    def budget_pdf_key(cls, budget_number: str, version_number: int) -> str:
        """Gera S3 key para o PDF do orçamento.

        Stub até Ciclo 5 quando S3Service.put_pdf persiste os bytes de verdade.

        Args:
            budget_number: número do orçamento (ex: OR-2025-0001).
            version_number: número da versão (ex: 1).

        Returns:
            Chave S3 no formato budgets/<number>/v<n>-<uuid>.pdf
        """
        return f"budgets/{budget_number}/v{version_number}-{uuid.uuid4().hex[:8]}.pdf"
