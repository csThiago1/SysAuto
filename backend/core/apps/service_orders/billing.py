"""
Paddock Solutions — OS Billing Service
Faturamento de OS: preview de breakdown + execução atômica (títulos + NF).
"""
from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

# ── Constantes ────────────────────────────────────────────────────────────────

PAYMENT_METHODS = [
    ("pix", "Pix"),
    ("cash", "Dinheiro"),
    ("debit", "Débito"),
    ("credit", "Crédito à Vista"),
    ("credit_installment", "Crédito a Prazo"),
    ("boleto", "Boleto"),
    ("transfer", "Transferência Bancária"),
]

PAYMENT_TERMS = [0, 7, 10, 15, 21, 30, 45, 60]

ZERO = Decimal("0.00")


def _d(val: Any) -> Decimal:
    """Converte para Decimal seguro."""
    if val is None:
        return ZERO
    return Decimal(str(val))


class BillingService:
    """Faturamento de OS: preview + execução."""

    @staticmethod
    def _resolve_insurer_person(insurer: Any) -> Any | None:
        """Busca Person com role INSURER e CNPJ da seguradora.

        Returns:
            Person com documents+addresses prefetched, ou None.
        """
        from apps.persons.models import Person, PersonDocument
        from apps.persons.utils import sha256_hex

        cnpj = getattr(insurer, "cnpj", "") or ""
        if not cnpj:
            return None

        # Busca Person que tenha documento CNPJ com mesmo valor
        doc = PersonDocument.objects.filter(
            doc_type="CNPJ",
            value_hash=sha256_hex(cnpj),
        ).select_related("person").first()

        if doc:
            return (
                Person.objects.prefetch_related("documents", "addresses")
                .get(pk=doc.person_id)
            )

        # Fallback: Person com role INSURER e nome similar
        person = (
            Person.objects.filter(
                roles__role="INSURER",
                full_name__icontains=insurer.name[:20] if insurer.name else "",
            )
            .prefetch_related("documents", "addresses")
            .first()
        )
        return person

    @classmethod
    def preview(cls, order: Any) -> dict[str, Any]:
        """Calcula breakdown de faturamento sem criar nada."""
        parts = _d(order.parts_total)
        services = _d(order.services_total)
        discount = _d(order.discount_total)
        grand_total = parts + services - discount
        deductible = _d(order.deductible_amount)
        deductible = min(deductible, grand_total)

        customer_name = order.customer_name or ""
        insurer_name = ""
        if order.customer_type == "insurer" and order.insurer:
            insurer_name = (
                getattr(order.insurer, "display_name", None)
                or getattr(order.insurer, "full_name", "")
                or "Seguradora"
            )

        items: list[dict[str, Any]] = []

        if order.customer_type == "insurer":
            franquia_servicos = min(deductible, services)
            franquia_pecas = deductible - franquia_servicos
            servicos_seg = services - franquia_servicos
            pecas_seg = parts - franquia_pecas

            if deductible > ZERO:
                items.append({
                    "recipient_type": "customer",
                    "category": "deductible",
                    "label": f"Franquia → {customer_name}",
                    "amount": str(deductible),
                    "default_payment_method": "pix",
                    "default_payment_term_days": 0,
                    "note": None,
                })

            if servicos_seg > ZERO:
                items.append({
                    "recipient_type": "insurer",
                    "category": "services",
                    "label": f"Serviços → {insurer_name}",
                    "amount": str(servicos_seg),
                    "default_payment_method": "boleto",
                    "default_payment_term_days": 30,
                    "note": None,
                })
            elif services > ZERO:
                items.append({
                    "recipient_type": "insurer",
                    "category": "services",
                    "label": f"Serviços → {insurer_name}",
                    "amount": "0.00",
                    "default_payment_method": "boleto",
                    "default_payment_term_days": 30,
                    "note": "Franquia absorveu serviços",
                })

            if pecas_seg > ZERO:
                items.append({
                    "recipient_type": "insurer",
                    "category": "parts",
                    "label": f"Peças → {insurer_name}",
                    "amount": str(pecas_seg),
                    "default_payment_method": "boleto",
                    "default_payment_term_days": 30,
                    "note": None,
                })
            elif parts > ZERO:
                items.append({
                    "recipient_type": "insurer",
                    "category": "parts",
                    "label": f"Peças → {insurer_name}",
                    "amount": "0.00",
                    "default_payment_method": "boleto",
                    "default_payment_term_days": 30,
                    "note": "Franquia absorveu peças",
                })
        else:
            # Particular: separar serviços (NFS-e) e peças (NF-e)
            if services > ZERO:
                items.append({
                    "recipient_type": "customer",
                    "category": "services",
                    "label": f"Serviços → {customer_name}",
                    "amount": str(services),
                    "default_payment_method": "pix",
                    "default_payment_term_days": 0,
                    "note": None,
                })
            if parts > ZERO:
                items.append({
                    "recipient_type": "customer",
                    "category": "parts",
                    "label": f"Peças → {customer_name}",
                    "amount": str(parts - discount),
                    "default_payment_method": "pix",
                    "default_payment_term_days": 0,
                    "note": None,
                })

        return {
            "parts_total": str(parts),
            "services_total": str(services),
            "discount_total": str(discount),
            "grand_total": str(grand_total),
            "deductible_amount": str(deductible),
            "customer_type": order.customer_type or "private",
            "customer_name": customer_name,
            "insurer_name": insurer_name,
            "items": items,
            "can_bill": not order.invoice_issued,
        }

    # ── Billing execution ────────────────────────────────────────────────────

    BILLABLE_STATUSES: set[str] = {
        "authorized", "repair", "mechanic", "bodywork", "painting",
        "assembly", "polishing", "washing", "final_survey", "ready",
        "delivered",
    }

    @classmethod
    @transaction.atomic
    def bill(
        cls,
        order: Any,
        items: list[dict[str, Any]],
        user: Any,
    ) -> dict[str, Any]:
        """Executa faturamento atômico: cria títulos AR + emite NF.

        Args:
            order: ServiceOrder instance.
            items: Lista de itens do preview (com overrides de payment_method/term_days).
            user: GlobalUser que está executando o faturamento.

        Returns:
            Dict com receivables, fiscal_documents e summary.

        Raises:
            ValueError: se a OS já foi faturada ou está em status inválido.
        """
        # Lazy imports — evita import circular
        from apps.accounts_receivable.services import ReceivableDocumentService
        from apps.fiscal.services.fiscal_service import FiscalService
        from apps.service_orders.models import ServiceOrderActivityLog

        # ── Validações ────────────────────────────────────────────────
        if order.invoice_issued:
            raise ValueError(f"OS {order.number} já foi faturada.")

        status = getattr(order, "status", "")
        if status not in cls.BILLABLE_STATUSES:
            raise ValueError(
                f"OS {order.number} com status '{status}' não pode ser faturada. "
                f"Status permitidos: {', '.join(sorted(cls.BILLABLE_STATUSES))}"
            )

        today = timezone.now().date()
        receivables: list[Any] = []
        fiscal_documents: list[Any] = []
        errors: list[str] = []

        # ── Criação de títulos + emissão fiscal ───────────────────────
        for item in items:
            amount = _d(item.get("amount", 0))
            if amount <= ZERO:
                continue

            recipient_type = item.get("recipient_type", "customer")
            category = item.get("category", "full")
            term_days = int(item.get("payment_term_days", item.get("default_payment_term_days", 0)))
            due_date = today + timezone.timedelta(days=term_days)

            # Determina customer_id e customer_name para o título
            if recipient_type == "insurer" and order.insurer:
                recv_customer_id = str(order.insurer.pk)
                recv_customer_name = (
                    getattr(order.insurer, "display_name", None)
                    or getattr(order.insurer, "full_name", "")
                    or "Seguradora"
                )
            else:
                recv_customer_id = str(order.customer_uuid) if order.customer_uuid else ""
                recv_customer_name = order.customer_name or ""

            # Determina origin e description
            has_services = category in ("services", "full", "deductible")
            origin = "NFSE" if has_services else "NFE"
            description = (
                f"OS {order.number} — {item.get('label', category)}"
            )

            # Cria título a receber
            receivable = ReceivableDocumentService.create_receivable(
                customer_id=recv_customer_id,
                customer_name=recv_customer_name,
                description=description,
                amount=amount,
                due_date=due_date,
                competence_date=today,
                origin=origin,
                service_order_id=str(order.pk),
                user=user,
            )
            receivables.append(receivable)

            # Resolve Person destinatário para o FiscalService
            # _get_person_for_os checa destinatario_id (atributo runtime)
            if recipient_type == "insurer" and order.insurer:
                # Busca Person com role INSURER que tenha CNPJ da seguradora
                insurer_person = cls._resolve_insurer_person(order.insurer)
                if insurer_person:
                    order.destinatario_id = insurer_person.pk
                    order.destinatario = insurer_person
                else:
                    errors.append(
                        f"Seguradora '{recv_customer_name}' não tem cadastro "
                        f"completo (Person com CNPJ e endereço). "
                        f"Cadastre-a em Cadastros → Pessoas."
                    )
                    continue  # Pula emissão fiscal mas mantém o receivable
            elif order.customer_id:
                order.destinatario_id = order.customer_id
                order.destinatario = order.customer

            # Emite NF (NFS-e para serviços, NF-e para peças)
            try:
                config = FiscalService.get_config()
                if has_services:
                    fiscal_doc = FiscalService.emit_nfse(
                        order, config,
                        triggered_by="BILLING",
                        parts_as_service=(category == "full"),
                    )
                else:
                    fiscal_doc = FiscalService.emit_nfe(
                        order, config=config,
                    )
                fiscal_documents.append(fiscal_doc)

                # Vincula título ao documento fiscal
                if hasattr(receivable, "fiscal_document"):
                    receivable.fiscal_document = fiscal_doc
                    receivable.save(update_fields=["fiscal_document"])

            except Exception as exc:
                error_msg = (
                    f"Erro ao emitir NF para item '{item.get('label', '')}' "
                    f"da OS {order.number}: {exc}"
                )
                logger.error(error_msg)
                errors.append(error_msg)

        # ── Marca OS como faturada ────────────────────────────────────
        order.invoice_issued = True
        order.save(update_fields=["invoice_issued"])

        # ── Log de atividade ──────────────────────────────────────────
        total_billed = sum(_d(r.amount) for r in receivables)
        ServiceOrderActivityLog.objects.create(
            service_order=order,
            user=user,
            activity_type="invoice_issued",
            description=(
                f"OS faturada — {len(receivables)} título(s), "
                f"R$ {total_billed:,.2f}"
            ),
            metadata={
                "receivables_count": len(receivables),
                "fiscal_docs_count": len(fiscal_documents),
                "total_billed": str(total_billed),
            },
        )

        logger.info(
            "OS %s faturada: %d título(s), %d NF(s), %d erro(s) fiscal.",
            order.number,
            len(receivables),
            len(fiscal_documents),
            len(errors),
        )

        # ── Resultado ─────────────────────────────────────────────────
        total_billed = sum(_d(r.amount) for r in receivables if hasattr(r, "amount"))

        return {
            "receivables": receivables,
            "fiscal_documents": fiscal_documents,
            "summary": {
                "total_billed": str(total_billed),
                "receivables_count": len(receivables),
                "fiscal_documents_count": len(fiscal_documents),
                "fiscal_errors": errors,
            },
        }
