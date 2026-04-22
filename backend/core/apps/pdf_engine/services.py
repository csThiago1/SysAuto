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
    def orcamento_pdf_key(cls, numero: str, versao: int) -> str:
        """Gera S3 key para o PDF do orçamento.

        Args:
            numero: número do orçamento (ex: ORC-2025-000001).
            versao: número da versão (ex: 1).

        Returns:
            Chave S3 no formato orcamentos/<numero>/v<n>-<uuid>.pdf
        """
        return f"orcamentos/{numero}/v{versao}-{uuid.uuid4().hex[:8]}.pdf"
