"""Funções que buscam e formatam dados de OS para templates PDF."""
from __future__ import annotations

import base64
import logging
import re
from collections import OrderedDict
from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from dateutil.relativedelta import relativedelta
from django.utils import timezone

from apps.documents.constants import (
    DEFAULT_WARRANTY_COVERAGE,
    DEFAULT_WARRANTY_EXCLUSIONS,
    WARRANTY_MONTHS_BY_CATEGORY,
)
from apps.pdf_engine.logo import get_logo_base64, get_logo_black_base64

logger = logging.getLogger(__name__)


def _fmt_cnpj(cnpj: str) -> str:
    c = cnpj.replace(".", "").replace("/", "").replace("-", "")
    if len(c) == 14:
        return f"{c[:2]}.{c[2:5]}.{c[5:8]}/{c[8:12]}-{c[12:]}"
    return cnpj


def _fmt_cpf(cpf: str) -> str:
    c = cpf.replace(".", "").replace("-", "")
    if len(c) == 11:
        return f"{c[:3]}.{c[3:6]}.{c[6:9]}-{c[9:]}"
    return cpf


def _format_date_br(d: date | str | None) -> str:
    if d is None:
        return "—"
    if isinstance(d, str):
        try:
            d = date.fromisoformat(d)
        except ValueError:
            return d
    return d.strftime("%d/%m/%Y")


def _format_time_br(dt: Any) -> str:
    """Extrai HH:MM de um datetime. Retorna '' se não tiver hora ou for meia-noite."""
    if dt is None:
        return ""
    if isinstance(dt, str):
        return ""
    if hasattr(dt, "hour"):
        # Ignora meia-noite (provavelmente campo sem hora preenchida)
        if dt.hour == 0 and dt.minute == 0:
            return ""
        return dt.strftime("%H:%M")
    return ""


def _location_date_str() -> str:
    now = timezone.localtime()
    meses = [
        "", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
    ]
    return f"Manaus (AM), {now.day} de {meses[now.month]} de {now.year}."


def _get_employee_signature_base64(user: Any) -> str:
    """Retorna a assinatura do Employee (base64 PNG) vinculado ao GlobalUser, ou ''."""
    if not user:
        return ""
    try:
        from apps.hr.models import Employee
        employee = Employee.objects.filter(user=user, status="ACTIVE").first()
        if employee and employee.signature_image:
            with employee.signature_image.open("rb") as f:
                return base64.b64encode(f.read()).decode("utf-8")
    except Exception:
        logger.debug("Não foi possível carregar assinatura do employee para user %s", user)
    return ""


class OSDataLoader:
    """Busca dados de OS e formata para templates PDF."""

    @staticmethod
    def _load_order(order_id: UUID) -> Any:
        from apps.service_orders.models import ServiceOrder
        return (
            ServiceOrder.objects
            .select_related("insurer", "consultant", "customer")
            .prefetch_related(
                "parts", "labor_items", "labor_items__service_catalog",
                "customer__documents", "customer__contacts", "customer__addresses",
            )
            .get(pk=order_id, is_active=True)
        )

    @staticmethod
    def load_company_info() -> dict[str, Any]:
        from apps.fiscal.models import FiscalConfigModel
        config = FiscalConfigModel.objects.filter(is_active=True).first()
        if not config:
            return {
                "razao_social": "DS Car Centro Automotivo",
                "cnpj_formatted": "",
                "ie": "",
                "endereco_linha": "",
                "telefone": "",
                "email": "",
            }
        endereco = config.endereco or {}
        endereco_parts = [
            endereco.get("logradouro", ""),
            endereco.get("numero", ""),
            endereco.get("bairro", ""),
            endereco.get("municipio", ""),
            endereco.get("uf", ""),
        ]
        endereco_linha = ", ".join(p for p in endereco_parts if p)
        cep = endereco.get("cep", "")
        if cep:
            endereco_linha += f" — CEP {cep}"
        return {
            "razao_social": config.razao_social or config.nome_fantasia or "DS Car Centro Automotivo",
            "cnpj_formatted": _fmt_cnpj(config.cnpj) if config.cnpj else "",
            "ie": config.inscricao_estadual or "",
            "endereco_linha": endereco_linha,
            "telefone": endereco.get("telefone", ""),
            "email": endereco.get("email", ""),
        }

    @staticmethod
    def _customer_dict(order: Any) -> dict[str, Any]:
        """Extrai dados do cliente da OS via Person (documents, contacts, addresses)."""
        person = order.customer
        result: dict[str, Any] = {
            "name": order.customer_name or "",
            "cpf": "",
            "cnpj": "",
            "rg": "",
            "phone": "",
            "email": "",
            "address": "",
        }

        if not person:
            return result

        result["name"] = person.full_name or order.customer_name or ""

        # Documentos (CPF, CNPJ, RG)
        for doc in person.documents.all():
            if doc.doc_type == "CPF" and not result["cpf"]:
                result["cpf"] = _fmt_cpf(doc.value or "")
            elif doc.doc_type == "CNPJ" and not result["cnpj"]:
                result["cnpj"] = _fmt_cnpj(doc.value or "")
            elif doc.doc_type == "RG" and not result["rg"]:
                result["rg"] = doc.value or ""

        # Contatos (telefone, email)
        for contact in person.contacts.all():
            if contact.contact_type in ("CELULAR", "TELEFONE") and not result["phone"]:
                result["phone"] = contact.value or ""
            elif contact.contact_type == "EMAIL" and not result["email"]:
                result["email"] = contact.value or ""

        # Endereço principal
        addr = person.addresses.filter(is_primary=True).first()
        if not addr:
            addr = person.addresses.first()
        if addr:
            parts = [
                addr.street,
                addr.number,
                addr.neighborhood,
                addr.city,
                addr.state,
            ]
            addr_str = ", ".join(p for p in parts if p)
            if addr.zip_code:
                addr_str += f" — CEP {addr.zip_code}"
            result["address"] = addr_str

        return result

    @staticmethod
    def _vehicle_dict(order: Any) -> dict[str, Any]:
        return {
            "make": order.make or "",
            "model": order.model or "",
            "year": order.year or "",
            "color": order.color or "",
            "plate": order.plate or "",
            "chassis": order.chassis or "",
            "mileage_in": order.mileage_in,
        }

    # Ordem canônica das categorias no PDF + labels em português.
    # Funilaria é subdividida em R&I, Reparação e Chapeação para clareza.
    CATEGORY_ORDER: list[tuple[str, str]] = [
        ("ri", "Remoção e Instalação"),
        ("funilaria", "Reparação"),
        ("pintura", "Pintura"),
        ("mecanica", "Mecânica"),
        ("eletrica", "Elétrica"),
        ("alinhamento", "Alinhamento / Balanceamento"),
        ("estetica", "Estética / Polimento"),
        ("lavagem", "Lavagem / Higienização"),
        ("revisao", "Revisão"),
        ("outros", "Outros Serviços"),
    ]
    _CATEGORY_LABEL_MAP: dict[str, str] = dict(CATEGORY_ORDER)

    # Palavras-chave para inferir categoria quando não há vínculo com catálogo.
    # Ordem importa: a primeira match vence (R&I antes de funilaria genérica).
    _CATEGORY_KEYWORDS: list[tuple[str, list[str]]] = [
        ("ri", [
            "remoção e instalação", "remoção e inst", "remocao e instalacao",
            "r&i", "r & i", "r/i",
            "montagem", "desmontagem", "desmontar", "montar",
        ]),
        ("funilaria", [
            "funilaria", "chapeação", "chapeacao", "desempeno", "desamasso",
            "solda", "reparação", "reparacao", "reparo", "recuperação", "recuperacao",
        ]),
        ("pintura", ["pintura", "repintura", "verniz", "primer", "base", "tricoat"]),
        ("mecanica", ["mecânica", "mecanica", "motor", "freio", "suspensão", "suspensao", "câmbio", "cambio"]),
        ("eletrica", ["elétrica", "eletrica", "fiação", "fiacao", "módulo", "modulo", "sensor"]),
        ("alinhamento", ["alinhamento", "balanceamento", "geometria", "cambagem"]),
        ("estetica", ["polimento", "cristalização", "cristalizacao", "estética", "estetica", "vitrificação", "vitrificacao"]),
        ("lavagem", ["lavagem", "higienização", "higienizacao", "limpeza"]),
        ("revisao", ["revisão", "revisao"]),
    ]

    # Regex para prefixo [OperationType] e sufixo ***MODIFICADOR***
    _BRACKET_RE = re.compile(r"^\[([^\]]+)\]\s*")
    _STAR_SUFFIX_RE = re.compile(r"\s*\*{2,}[^*]+\*{2,}")
    _TRAILING_PRIMER_RE = re.compile(r"\s+PRIMER\s*$", re.IGNORECASE)

    # Mapa de conteúdo do [bracket] → categoria
    _BRACKET_CATEGORY: dict[str, str] = {
        "remoção e instalação": "ri",
        "pintura": "pintura",
        "reparação": "funilaria",
        "serviço": "outros",
    }

    @classmethod
    def _infer_category(cls, description: str) -> str:
        """Infere a categoria pelo texto da descrição.

        Verifica primeiro o prefixo [OperationType] (formato Cilia/legado),
        depois fallback para keyword matching no texto livre.
        """
        desc = description.strip()

        # 1. Prefixo entre colchetes: [Pintura], [Remoção e Instalação], etc.
        bracket = cls._BRACKET_RE.match(desc)
        if bracket:
            content = bracket.group(1).lower().strip()
            for key, cat in cls._BRACKET_CATEGORY.items():
                if key in content:
                    return cat
            return "outros"

        # 2. Fallback: keyword no texto
        desc_lower = desc.lower()
        for cat_key, keywords in cls._CATEGORY_KEYWORDS:
            if any(kw in desc_lower for kw in keywords):
                return cat_key
        return "outros"

    @classmethod
    def _resolve_category(cls, labor: Any) -> str:
        """Resolve a categoria do item: catálogo > inferência por descrição.

        Para itens do catálogo com categoria 'funilaria', tenta refinar
        em subcategoria (ri, funilaria) via descrição.
        """
        catalog = getattr(labor, "service_catalog", None)
        if catalog and getattr(catalog, "category", None):
            cat = catalog.category
            if cat == "funilaria":
                return cls._infer_category(labor.description)
            return cat
        return cls._infer_category(labor.description)

    @classmethod
    def _clean_description(cls, description: str) -> str:
        """Remove prefixo [OperationType] das descrições para documentos externos."""
        desc = description.strip()
        bracket = cls._BRACKET_RE.match(desc)
        if bracket:
            op = bracket.group(1).strip()
            panel = desc[bracket.end():].strip()
            # Limpa sufixos ***...*** e PRIMER do painel
            panel = cls._STAR_SUFFIX_RE.sub("", panel).strip()
            panel = cls._TRAILING_PRIMER_RE.sub("", panel).strip()
            return f"{op} — {panel}" if panel else op
        return desc

    @classmethod
    def _services_list(cls, order: Any) -> list[dict[str, Any]]:
        items = []
        for labor in order.labor_items.filter(is_active=True):
            catalog = getattr(labor, "service_catalog", None)
            category = "default"
            if catalog and getattr(catalog, "category", None):
                category = catalog.category
            items.append({
                "description": cls._clean_description(labor.description),
                "quantity": str(labor.quantity),
                "unit_price": str(labor.unit_price),
                "total": str(labor.total),
                "category": category,
            })
        return items

    # Labels curtos para colunas da matriz
    _CATEGORY_SHORT: dict[str, str] = {
        "ri": "R&I",
        "funilaria": "Reparação",
        "pintura": "Pintura",
        "mecanica": "Mecânica",
        "eletrica": "Elétrica",
        "alinhamento": "Alinh.",
        "estetica": "Estética",
        "lavagem": "Lavagem",
        "revisao": "Revisão",
        "outros": "Outros",
    }

    # Prefixos de operação para extrair o nome do painel da descrição
    _OPERATION_PREFIXES: list[str] = [
        "remoção e instalação de ", "remoção e instalação ",
        "remoção e inst. de ", "remoção e inst. ",
        "remocao e instalacao de ", "remocao e instalacao ",
        "r&i de ", "r&i ", "r/i de ", "r/i ",
        "montagem de ", "montagem ", "desmontagem de ", "desmontagem ",
        "funilaria de ", "funilaria ",
        "chapeação de ", "chapeação ", "chapeacao de ", "chapeacao ",
        "desempeno de ", "desempeno ",
        "reparação de ", "reparação ", "reparacao de ", "reparacao ",
        "reparo de ", "reparo ",
        "pintura de ", "pintura ", "repintura de ", "repintura ",
        "polimento de ", "polimento ",
        "mecânica de ", "mecânica ", "mecanica de ", "mecanica ",
        "elétrica de ", "elétrica ", "eletrica de ", "eletrica ",
        "lavagem de ", "lavagem ",
    ]

    @classmethod
    def _extract_panel_name(cls, description: str) -> str:
        """Remove prefixo de operação e sufixos para obter o nome do painel.

        Lida com formatos:
          - "[Remoção e Instalação] PARALAMA DIANT DIR"
          - "[Pintura] PARACHOQUE TRAS DIR PRIMER"
          - "[Remoção e Instalação] FAROL DIREITO ***POLIMENTO***"
          - "Funilaria porta dianteira esquerda"
        """
        desc = description.strip()

        # 1. Strip [OperationType] prefix
        bracket = cls._BRACKET_RE.match(desc)
        if bracket:
            desc = desc[bracket.end():].strip()
        else:
            # Fallback: strip plain text prefixes
            desc_lower = desc.lower()
            for prefix in cls._OPERATION_PREFIXES:
                if desc_lower.startswith(prefix):
                    remainder = desc[len(prefix):].strip()
                    if remainder:
                        desc = remainder
                    break

        # 2. Strip ***MODIFICADOR*** sufixos (ex: ***POLIMENTO***)
        desc = cls._STAR_SUFFIX_RE.sub("", desc).strip()

        # 3. Strip PRIMER sufixo
        desc = cls._TRAILING_PRIMER_RE.sub("", desc).strip()

        return desc or description.strip()

    @staticmethod
    def _normalize_key(text: str) -> str:
        """Chave de agrupamento: uppercase + strip para casar peça com serviço."""
        return text.strip().upper()

    @classmethod
    def _build_service_matrix(cls, order: Any) -> dict[str, Any]:
        """Monta a matriz peça × serviço para o PDF.

        Linhas = painéis/peças únicas (union de parts + labor descriptions).
        Colunas = tipos de operação (R&I, Funilaria, Pintura, etc.).
        Primeira coluna fixa = 'Troca' (se há peça para substituir).

        Usa chave normalizada (UPPERCASE) para casar peças e serviços
        independente de capitalização.
        """
        # Mapa key→display: guarda o primeiro nome visto para cada chave
        display_names: dict[str, str] = {}

        def _register(raw: str) -> str:
            key = cls._normalize_key(raw)
            if key not in display_names:
                display_names[key] = raw.strip()
            return key

        # 1. Coletar peças agrupadas por painel (normalizado)
        parts_by_key: OrderedDict[str, dict[str, Any]] = OrderedDict()
        for part in order.parts.filter(is_active=True).order_by("created_at"):
            key = _register(part.description)
            if key not in parts_by_key:
                parts_by_key[key] = {"qty": 0, "code": ""}
            parts_by_key[key]["qty"] += int(part.quantity)
            if part.part_number and not parts_by_key[key]["code"]:
                parts_by_key[key]["code"] = part.part_number

        # 2. Coletar serviços por painel (normalizado) + categoria
        services_by_key: OrderedDict[str, set[str]] = OrderedDict()
        for labor in order.labor_items.filter(is_active=True).order_by("created_at"):
            category = cls._resolve_category(labor)
            panel_raw = cls._extract_panel_name(labor.description)
            key = _register(panel_raw)
            if key not in services_by_key:
                services_by_key[key] = set()
            services_by_key[key].add(category)

        # 3. Union de todas as chaves (peças primeiro, depois serviços-only)
        all_keys: list[str] = []
        seen: set[str] = set()
        for k in parts_by_key:
            if k not in seen:
                all_keys.append(k)
                seen.add(k)
        for k in services_by_key:
            if k not in seen:
                all_keys.append(k)
                seen.add(k)

        if not all_keys:
            return {}

        # 4. Determinar colunas de serviço presentes (na ordem canônica)
        all_cats: set[str] = set()
        for cats in services_by_key.values():
            all_cats.update(cats)

        columns: list[dict[str, str]] = []
        for cat_key, _ in cls.CATEGORY_ORDER:
            if cat_key in all_cats:
                columns.append({
                    "key": cat_key,
                    "label": cls._CATEGORY_SHORT.get(cat_key, cat_key),
                })

        has_parts = bool(parts_by_key)

        # 5. Montar linhas
        rows: list[dict[str, Any]] = []
        for key in all_keys:
            part_info = parts_by_key.get(key)
            panel_cats = services_by_key.get(key, set())
            rows.append({
                "panel": display_names.get(key, key),
                "has_part": part_info is not None,
                "part_qty": part_info["qty"] if part_info else 0,
                "part_code": part_info["code"] if part_info else "",
                "cells": [cat["key"] in panel_cats for cat in columns],
            })

        return {
            "has_parts_column": has_parts,
            "columns": columns,
            "rows": rows,
            "total_parts": len(parts_by_key),
            "total_services": sum(len(cats) for cats in services_by_key.values()),
        }

    @staticmethod
    def _parts_list(order: Any) -> list[dict[str, Any]]:
        items = []
        for part in order.parts.filter(is_active=True):
            items.append({
                "description": part.description,
                "part_number": part.part_number or "",
                "quantity": str(part.quantity),
                "unit_price": str(part.unit_price),
                "total": str(part.total),
            })
        return items

    @staticmethod
    def _totals_dict(order: Any) -> dict[str, str]:
        parts = Decimal(str(order.parts_total or 0))
        services = Decimal(str(order.services_total or 0))
        discount = Decimal(str(order.discount_total or 0))
        grand_total = parts + services - discount
        return {
            "parts": str(parts),
            "services": str(services),
            "discount": str(discount),
            "grand_total": str(grand_total),
        }

    @classmethod
    def load_os_report(cls, order_id: UUID) -> dict[str, Any]:
        """OS Report: documento de trabalho interno (sem dados do cliente, sem valores)."""
        order = cls._load_order(order_id)
        company = cls.load_company_info()

        # Tipo de atendimento
        customer_type_map = {"insurer": "Seguradora", "private": "Particular"}
        customer_type_display = customer_type_map.get(order.customer_type or "", "Particular")

        matrix = cls._build_service_matrix(order)

        data: dict[str, Any] = {
            "company": company,
            "logo_base64": get_logo_base64(),
            "logo_black_base64": get_logo_black_base64(),
            "order": {
                "number": order.number,
                "customer_type_display": customer_type_display,
                "entry_date": _format_date_br(order.entry_date),
                "entry_time": _format_time_br(order.entry_date),
                "estimated_delivery_date": _format_date_br(order.estimated_delivery_date),
                "estimated_delivery_time": _format_time_br(
                    order.estimated_delivery or order.estimated_delivery_date
                ),
                "consultor": (
                    order.consultant.full_name
                    if order.consultant and hasattr(order.consultant, "full_name")
                    else ""
                ),
            },
            "vehicle": cls._vehicle_dict(order),
            "matrix": matrix,
            "services": cls._services_list(order),
            "parts": cls._parts_list(order),
            "observations": "",
            "location_date": _location_date_str(),
            "consultant_signature_base64": _get_employee_signature_base64(order.consultant),
            "consultant_name": (
                order.consultant.full_name
                if order.consultant and hasattr(order.consultant, "full_name")
                else ""
            ),
        }
        if order.customer_type == "insurer" and order.insurer:
            data["insurer"] = {
                "name": getattr(order.insurer, "display_name", None) or order.insurer.name or "",
                "casualty_number": order.casualty_number or "",
                "insured_type": order.get_insured_type_display() if order.insured_type else "",
            }
        return data

    @classmethod
    def load_warranty(cls, order_id: UUID) -> dict[str, Any]:
        order = cls._load_order(order_id)
        company = cls.load_company_info()
        delivery_date = order.delivered_at or order.client_delivery_date or timezone.now()
        if isinstance(delivery_date, str):
            delivery_date = date.fromisoformat(delivery_date)
        if hasattr(delivery_date, "date"):
            delivery_date = delivery_date.date()
        services = cls._services_list(order)
        for svc in services:
            category = svc.get("category", "default")
            months = WARRANTY_MONTHS_BY_CATEGORY.get(category, WARRANTY_MONTHS_BY_CATEGORY["default"])
            svc["warranty_months"] = months
            if months > 0:
                svc["warranty_until"] = _format_date_br(delivery_date + relativedelta(months=months))
            else:
                svc["warranty_until"] = "Sem garantia"
        return {
            "company": company,
            "logo_base64": get_logo_base64(),
            "logo_black_base64": get_logo_black_base64(),
            "order": {"number": order.number},
            "customer": cls._customer_dict(order),
            "vehicle": cls._vehicle_dict(order),
            "services": services,
            "totals": cls._totals_dict(order),
            "warranty_coverage": list(DEFAULT_WARRANTY_COVERAGE),
            "warranty_exclusions": list(DEFAULT_WARRANTY_EXCLUSIONS),
            "observations": "",
            "location_date": _location_date_str(),
        }

    @classmethod
    def load_settlement(cls, order_id: UUID) -> dict[str, Any]:
        order = cls._load_order(order_id)
        company = cls.load_company_info()
        from apps.accounts_receivable.models import ReceivableDocument
        receivables = list(
            ReceivableDocument.objects.filter(
                service_order_id=str(order.pk),
                is_active=True,
            ).order_by("-created_at")
        )
        total_paid = sum(Decimal(str(r.amount)) for r in receivables)
        payment_method = ""
        payment_date = ""
        if receivables:
            first = receivables[0]
            payment_method = getattr(first, "payment_method", "") or ""
            payment_date = _format_date_br(getattr(first, "paid_at", None) or first.created_at)
        return {
            "company": company,
            "logo_base64": get_logo_base64(),
            "logo_black_base64": get_logo_black_base64(),
            "order": {"number": order.number},
            "customer": cls._customer_dict(order),
            "vehicle": cls._vehicle_dict(order),
            "services": cls._services_list(order),
            "totals": cls._totals_dict(order),
            "payment": {
                "method": payment_method,
                "method_display": payment_method,
                "amount": str(total_paid),
                "amount_words": "",
                "date": payment_date,
                "status": "paid",
            },
            "observations": "",
            "location_date": _location_date_str(),
        }

    @classmethod
    def load_receipt(cls, order_id: UUID, receivable_id: UUID) -> dict[str, Any]:
        order = cls._load_order(order_id)
        company = cls.load_company_info()
        from apps.accounts_receivable.models import ReceivableDocument
        receivable = ReceivableDocument.objects.get(pk=receivable_id, is_active=True)
        return {
            "company": company,
            "logo_base64": get_logo_base64(),
            "logo_black_base64": get_logo_black_base64(),
            "order": {"number": order.number},
            "customer": cls._customer_dict(order),
            "receipt": {
                "description": receivable.description or "Serviços automotivos",
                "receivable_description": receivable.description or "",
            },
            "payment": {
                "method": getattr(receivable, "payment_method", "") or "",
                "method_display": getattr(receivable, "payment_method", "") or "",
                "amount": str(receivable.amount),
                "amount_words": "",
                "date": _format_date_br(getattr(receivable, "paid_at", None) or receivable.created_at),
            },
            "location_date": _location_date_str(),
        }
