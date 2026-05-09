"""
Paddock Solutions — OS Billing Service
Faturamento de OS: preview de breakdown + execução atômica (títulos + NF).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date
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


# ── BillingResult ─────────────────────────────────────────────────────────────


@dataclass
class BillingResult:
    """Resultado intermediário do faturamento, acumulado pelos sub-métodos."""

    receivables: list[Any] = field(default_factory=list)
    fiscal_documents: list[Any] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def total_billed(self) -> Decimal:
        """Soma dos valores dos títulos criados."""
        return sum(
            (_d(r.amount) for r in self.receivables if hasattr(r, "amount")),
            ZERO,
        )

    def to_dict(self) -> dict[str, Any]:
        """Serializa resultado final para a view."""
        return {
            "receivables": self.receivables,
            "fiscal_documents": self.fiscal_documents,
            "summary": {
                "total_billed": str(self.total_billed),
                "receivables_count": len(self.receivables),
                "fiscal_documents_count": len(self.fiscal_documents),
                "fiscal_errors": self.errors,
            },
        }


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
        cls._validate_billable(order)

        today = timezone.now().date()
        result = BillingResult()

        cls._create_receivables_and_emit_fiscal(order, items, user, today, result)
        cls._mark_order_billed(order, result)
        cls._post_accounting_entries(order, result)
        cls._log_activity(order, user, result)

        return result.to_dict()

    @classmethod
    def _validate_billable(cls, order: Any) -> None:
        """Valida se a OS pode ser faturada.

        Raises:
            ValueError: se a OS já foi faturada ou está em status inválido.
        """
        if order.invoice_issued:
            raise ValueError(f"OS {order.number} já foi faturada.")

        status = getattr(order, "status", "")
        if status not in cls.BILLABLE_STATUSES:
            raise ValueError(
                f"OS {order.number} com status '{status}' não pode ser faturada. "
                f"Status permitidos: {', '.join(sorted(cls.BILLABLE_STATUSES))}"
            )

    @classmethod
    def _create_receivables_and_emit_fiscal(
        cls,
        order: Any,
        items: list[dict[str, Any]],
        user: Any,
        today: date,
        result: BillingResult,
    ) -> None:
        """Cria títulos AR e emite documentos fiscais para cada item.

        Para cada item com valor > 0:
        1. Cria o título a receber (receivable)
        2. Resolve o destinatário (Person) para emissão fiscal
        3. Emite NFS-e (serviços) ou NF-e (peças) — franquia pula emissão

        Erros de emissão fiscal são capturados e acumulados em result.errors
        (graceful degradation), mas o receivable já criado é mantido.
        """
        from apps.accounts_receivable.services import ReceivableDocumentService
        from apps.fiscal.services.fiscal_service import FiscalService

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
            # NFS-e = serviços, NF-e = peças, franquia = só título (sem NF)
            is_services = category == "services"
            is_parts = category == "parts"
            origin = "NFSE" if is_services else ("NFE" if is_parts else "MANUAL")
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
            result.receivables.append(receivable)

            # Resolve Person destinatário para o FiscalService
            # _get_person_for_os checa destinatario_id (atributo runtime)
            if recipient_type == "insurer" and order.insurer:
                # Busca Person com role INSURER que tenha CNPJ da seguradora
                insurer_person = cls._resolve_insurer_person(order.insurer)
                if insurer_person:
                    order.destinatario_id = insurer_person.pk
                    order.destinatario = insurer_person
                else:
                    result.errors.append(
                        f"Seguradora '{recv_customer_name}' não tem cadastro "
                        f"completo (Person com CNPJ e endereço). "
                        f"Cadastre-a em Cadastros → Pessoas."
                    )
                    continue  # Pula emissão fiscal mas mantém o receivable
            elif order.customer_id:
                order.destinatario_id = order.customer_id
                order.destinatario = order.customer

            # Emite NF: NFS-e para serviços, NF-e para peças
            # Franquia (deductible) = só título AR, sem emissão fiscal
            if not is_services and not is_parts:
                continue  # pula emissão fiscal para franquia

            try:
                config = FiscalService.get_config()
                if is_services:
                    fiscal_doc = FiscalService.emit_nfse(
                        order, config,
                        triggered_by="BILLING",
                        parts_as_service=False,
                    )
                else:
                    fiscal_doc = FiscalService.emit_nfe(
                        order, config=config,
                    )
                result.fiscal_documents.append(fiscal_doc)

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
                result.errors.append(error_msg)

    @classmethod
    def _mark_order_billed(cls, order: Any, result: BillingResult) -> None:
        """Marca OS como faturada se houve emissão fiscal ou nenhum erro.

        Se todas as emissões falharam, NÃO marca como faturada para permitir retry.
        Se nenhum item gerou emissão fiscal (ex: todos com valor zero), marca.
        """
        if result.fiscal_documents:
            order.invoice_issued = True
            order.save(update_fields=["invoice_issued"])
        elif not result.errors:
            # Nenhum item gerou emissão fiscal (ex: todos com valor zero)
            order.invoice_issued = True
            order.save(update_fields=["invoice_issued"])

    @classmethod
    def _post_accounting_entries(cls, order: Any, result: BillingResult) -> None:
        """Gera lançamento contábil de receita + CMV.

        Erros são capturados e acumulados em result.errors (graceful degradation).
        """
        try:
            from apps.accounting.services.journal_entry_service import JournalEntryService

            JournalEntryService.create_from_service_order(order)
        except Exception as exc:
            error_msg = (
                f"Erro ao gerar lançamento contábil para OS {order.number}: {exc}"
            )
            logger.error(error_msg)
            result.errors.append(error_msg)

    @classmethod
    def _log_activity(
        cls,
        order: Any,
        user: Any,
        result: BillingResult,
    ) -> None:
        """Registra log de atividade do faturamento e loga no logger."""
        from apps.service_orders.models import ServiceOrderActivityLog

        total_billed = sum(_d(r.amount) for r in result.receivables)
        activity_description = (
            f"OS faturada — {len(result.receivables)} título(s), "
            f"R$ {total_billed:,.2f}"
        )
        if result.errors:
            activity_description += f" | {len(result.errors)} erro(s) fiscal"

        ServiceOrderActivityLog.objects.create(
            service_order=order,
            user=user,
            activity_type="invoice_issued",
            description=activity_description,
            metadata={
                "receivables_count": len(result.receivables),
                "fiscal_docs_count": len(result.fiscal_documents),
                "total_billed": str(total_billed),
                "fiscal_errors": result.errors,
            },
        )

        logger.info(
            "OS %s faturada: %d título(s), %d NF(s), %d erro(s) fiscal.",
            order.number,
            len(result.receivables),
            len(result.fiscal_documents),
            len(result.errors),
        )

    # ── Complement billing ────────────────────────────────────────────────────

    @classmethod
    def _resolve_customer_person(cls, order: Any) -> Any | None:
        """Busca Person correspondente ao cliente da OS.

        Returns:
            Person com documents+addresses prefetched, ou None.
        """
        from apps.persons.models import Person

        customer_uuid = getattr(order, "customer_uuid", None)
        if not customer_uuid:
            return None

        return (
            Person.objects.prefetch_related("documents", "addresses")
            .filter(pk=customer_uuid)
            .first()
        )

    @classmethod
    @transaction.atomic
    def bill_complement(cls, order: Any, billed_by: str = "Sistema") -> dict[str, Any]:
        """Fatura itens pendentes do complemento particular.

        Cria receivables + emite NF-e (peças) e NFS-e (serviços) separados,
        tudo em nome do cliente. Pode ser chamado a qualquer momento,
        independente do status da OS.
        """
        pending_parts, pending_labor = cls._get_pending_complement_items(order)
        parts_total, labor_total = cls._calc_complement_totals(
            pending_parts, pending_labor,
        )

        if parts_total + labor_total <= ZERO:
            return {"billed": False, "message": "Nenhum item pendente para faturar."}

        items = cls._build_complement_billing_items(
            order, parts_total, labor_total,
        )
        cls._create_complement_receivables(order, items)

        # Capture counts before update (querysets become empty after update)
        parts_count = pending_parts.count()
        labor_count = pending_labor.count()

        cls._mark_complement_items_billed(pending_parts, pending_labor)
        cls._log_complement_activity(
            order, parts_total + labor_total, billed_by,
        )

        return {
            "billed": True,
            "parts_total": str(parts_total),
            "labor_total": str(labor_total),
            "items_count": parts_count + labor_count,
        }

    @staticmethod
    def _get_pending_complement_items(order: Any) -> tuple[Any, Any]:
        """Retorna querysets de peças e mão-de-obra pendentes do complemento."""
        pending_parts = order.parts.filter(
            source_type="complement", billing_status="pending",
        )
        pending_labor = order.labor_items.filter(
            source_type="complement", billing_status="pending",
        )
        return pending_parts, pending_labor

    @staticmethod
    def _calc_complement_totals(
        pending_parts: Any,
        pending_labor: Any,
    ) -> tuple[Decimal, Decimal]:
        """Calcula totais de peças e mão-de-obra pendentes."""
        parts_total = sum(
            p.quantity * p.unit_price - p.discount for p in pending_parts
        )
        labor_total = sum(
            l.quantity * l.unit_price - l.discount for l in pending_labor
        )
        return parts_total, labor_total

    @staticmethod
    def _build_complement_billing_items(
        order: Any,
        parts_total: Decimal,
        labor_total: Decimal,
    ) -> list[dict[str, Any]]:
        """Monta lista de itens de faturamento do complemento."""
        customer_name = order.customer_name or ""
        items: list[dict[str, Any]] = []

        if labor_total > ZERO:
            items.append({
                "recipient_type": "customer",
                "category": "services",
                "label": f"Complemento Serviços → {customer_name}",
                "amount": str(labor_total),
                "default_payment_method": "pix",
                "default_payment_term_days": 0,
            })
        if parts_total > ZERO:
            items.append({
                "recipient_type": "customer",
                "category": "parts",
                "label": f"Complemento Peças → {customer_name}",
                "amount": str(parts_total),
                "default_payment_method": "pix",
                "default_payment_term_days": 0,
            })

        return items

    @classmethod
    def _create_complement_receivables(
        cls,
        order: Any,
        items: list[dict[str, Any]],
    ) -> None:
        """Cria títulos a receber para os itens do complemento.

        Erros são capturados e logados (graceful degradation).
        """
        try:
            person = cls._resolve_customer_person(order)
            from apps.accounts_receivable.services import ReceivableDocumentService
            for item in items:
                ReceivableDocumentService.create_from_billing(
                    order=order, person=person, billing_item=item,
                )
        except (ImportError, AttributeError, Exception) as e:
            logger.warning("Receivable creation skipped for complement: %s", e)

    @staticmethod
    def _mark_complement_items_billed(
        pending_parts: Any,
        pending_labor: Any,
    ) -> None:
        """Marca itens de peças e mão-de-obra como faturados."""
        now = timezone.now()
        pending_parts.update(billing_status="billed", billed_at=now)
        pending_labor.update(billing_status="billed", billed_at=now)

    @staticmethod
    def _log_complement_activity(
        order: Any,
        total: Decimal,
        billed_by: str,
    ) -> None:
        """Registra log de atividade do faturamento de complemento."""
        from apps.service_orders.models import ServiceOrderActivityLog

        ServiceOrderActivityLog.objects.create(
            service_order=order,
            activity_type="billing",
            description=f"Complemento particular faturado: R$ {total:.2f}",
            created_by=billed_by,
        )
