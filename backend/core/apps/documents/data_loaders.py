"""Funções que buscam e formatam dados de OS para templates PDF."""
from __future__ import annotations

import logging
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
from apps.pdf_engine.logo import get_logo_base64

logger = logging.getLogger(__name__)


def _fmt_cnpj(cnpj: str) -> str:
    c = cnpj.replace(".", "").replace("/", "").replace("-", "")
    if len(c) == 14:
        return f"{c[:2]}.{c[2:5]}.{c[5:8]}/{c[8:12]}-{c[12:]}"
    return cnpj


def _format_date_br(d: date | str | None) -> str:
    if d is None:
        return "—"
    if isinstance(d, str):
        try:
            d = date.fromisoformat(d)
        except ValueError:
            return d
    return d.strftime("%d/%m/%Y")


def _location_date_str() -> str:
    now = timezone.localtime()
    meses = [
        "", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
    ]
    return f"Manaus (AM), {now.day} de {meses[now.month]} de {now.year}."


class OSDataLoader:
    """Busca dados de OS e formata para templates PDF."""

    @staticmethod
    def _load_order(order_id: UUID) -> Any:
        from apps.service_orders.models import ServiceOrder
        return (
            ServiceOrder.objects
            .select_related("insurer", "consultant", "customer")
            .prefetch_related(
                "parts", "labor_items",
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
                result["cpf"] = doc.value or ""
            elif doc.doc_type == "CNPJ" and not result["cnpj"]:
                result["cnpj"] = doc.value or ""
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

    @staticmethod
    def _services_list(order: Any) -> list[dict[str, Any]]:
        items = []
        for labor in order.labor_items.filter(is_active=True):
            items.append({
                "description": labor.description,
                "quantity": str(labor.quantity),
                "unit_price": str(labor.unit_price),
                "total": str(labor.total),
                "category": getattr(labor, "category", "default") or "default",
            })
        return items

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
        order = cls._load_order(order_id)
        company = cls.load_company_info()
        data: dict[str, Any] = {
            "company": company,
            "logo_base64": get_logo_base64(),
            "order": {"number": order.number},
            "customer": cls._customer_dict(order),
            "vehicle": cls._vehicle_dict(order),
            "services": cls._services_list(order),
            "parts": cls._parts_list(order),
            "totals": cls._totals_dict(order),
            "observations": "",
            "location_date": _location_date_str(),
        }
        if order.customer_type == "insurer" and order.insurer:
            data["insurer"] = {
                "name": getattr(order.insurer, "display_name", None) or order.insurer.name or "",
                "casualty_number": order.casualty_number or "",
                "insured_type": order.get_insured_type_display() if order.insured_type else "",
                "deductible_amount": str(order.deductible_amount) if order.deductible_amount else "",
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
