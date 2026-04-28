from __future__ import annotations

import logging
import uuid
from io import BytesIO
from typing import Any

from django.template.loader import render_to_string


logger = logging.getLogger(__name__)


class PDFService:
    """Geração de PDFs via WeasyPrint.

    Fallback para HTML bytes se WeasyPrint não disponível (permite rodar testes
    em ambientes sem libs nativas GTK/Pango). Em produção, WeasyPrint sempre
    disponível via imagem Docker com dependências instaladas.
    """

    @classmethod
    def render_orcamento(cls, orcamento: Any) -> bytes:
        """Renderiza PDF de orçamento para um Orcamento (quotes.Orcamento).

        Args:
            orcamento: Orcamento com intervencoes, itens_adicionais e customer relacionados.

        Returns:
            bytes do PDF (WeasyPrint) ou bytes do HTML (fallback quando libs ausentes).
        """
        from apps.quotes.models import Orcamento
        intervencoes = orcamento.intervencoes.all().select_related(
            "peca", "acao", "area"
        )
        itens_adicionais = orcamento.itens_adicionais.all()
        html = render_to_string("pdf_engine/orcamento.html", {
            "orcamento": orcamento,
            "intervencoes": intervencoes,
            "itens_adicionais": itens_adicionais,
            "totals": {
                "subtotal": orcamento.subtotal,
                "discount": orcamento.discount_total,
                "total": orcamento.total,
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
    def render_html(cls, template_name: str, context: dict[str, Any]) -> bytes:
        """Renderiza qualquer template HTML como PDF genérico.

        Args:
            template_name: caminho do template Django (ex: "pdf_engine/orcamento.html").
            context: contexto de renderização.

        Returns:
            bytes do PDF (WeasyPrint) ou bytes do HTML (fallback).
        """
        html = render_to_string(template_name, context)
        try:
            from weasyprint import HTML
            buf = BytesIO()
            HTML(string=html).write_pdf(buf)
            return buf.getvalue()
        except Exception as exc:
            logger.warning("WeasyPrint indisponível, retornando HTML bytes: %s", exc)
            return html.encode("utf-8")

    @classmethod
    def render_document(cls, document_type: str, context: dict[str, Any]) -> bytes:
        """Renderiza documento PDF por tipo.

        Args:
            document_type: um de 'os_report', 'warranty', 'settlement', 'receipt'.
            context: dict completo de contexto.

        Returns:
            bytes do PDF (WeasyPrint) ou bytes do HTML (fallback).
        """
        template_map = {
            "os_report": "pdf_engine/os_report.html",
            "warranty": "pdf_engine/warranty.html",
            "settlement": "pdf_engine/settlement.html",
            "receipt": "pdf_engine/receipt.html",
        }
        template_name = template_map.get(document_type)
        if not template_name:
            raise ValueError(f"Tipo de documento desconhecido: {document_type}")
        return cls.render_html(template_name, context)

    @classmethod
    def orcamento_pdf_key(cls, numero: str, versao: int) -> str:
        """Gera S3 key para o PDF do orçamento.

        Args:
            numero: número do orçamento (ex: ORC-2025-000001).
            versao: número da versão (ex: 1).

        Returns:
            Chave S3 no formato orcamentos/<numero>/v<n>-<uuid>.pdf
        """
        return f"orcamentos/{numero}/v{versao}-{uuid.uuid4().hex[:8]}.pdf"

    @classmethod
    def render_budget(cls, version: Any) -> bytes:
        """Renderiza PDF de orçamento particular (budgets.BudgetVersion).

        Args:
            version: BudgetVersion com items acessíveis via FK.

        Returns:
            bytes do PDF (WeasyPrint) ou bytes do HTML (fallback quando libs ausentes).
        """
        items = version.items.all()
        html = render_to_string("pdf_engine/budget.html", {
            "version": version,
            "budget": version.budget,
            "customer": version.budget.customer,
            "items": items,
            "totals": {
                "subtotal": version.subtotal,
                "discount": version.discount_total,
                "total": version.net_total,
                "labor": version.labor_total,
                "parts": version.parts_total,
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
        """Gera S3 key para o PDF do orçamento particular.

        Args:
            budget_number: número do orçamento (ex: ORC-2026-000001).
            version_number: número da versão (ex: 1).

        Returns:
            Chave S3 no formato budgets/<number>/v<n>-<uuid>.pdf
        """
        return f"budgets/{budget_number}/v{version_number}-{uuid.uuid4().hex[:8]}.pdf"
