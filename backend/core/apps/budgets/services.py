# apps/budgets/services.py
"""Camada de serviço do módulo de Orçamentos.

Contém BudgetService com operações de criação, envio ao cliente,
aprovação, rejeição e revisão. Toda mutação de estado passa por aqui —
nunca alterar status diretamente nos models.
"""
from __future__ import annotations

import hashlib
import json
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.items.services import NumberAllocator
from apps.persons.models import Person

from .models import Budget, BudgetVersion, BudgetVersionItem
from .pdf_stub import render_budget_pdf_stub


BUDGET_VALIDITY_DAYS = 30


class BudgetService:
    """Regras de negócio do orçamento particular.

    Todos os métodos são @transaction.atomic para garantir consistência.
    """

    @classmethod
    @transaction.atomic
    def create(
        cls,
        *,
        customer: Person,
        vehicle_plate: str,
        vehicle_description: str,
        created_by: str,
    ) -> Budget:
        """Cria Budget novo + BudgetVersion v1 em status draft.

        Args:
            customer: Person do tipo CLIENT.
            vehicle_plate: placa normalizada para uppercase automaticamente.
            vehicle_description: texto livre descrevendo o veículo.
            created_by: username/nome de quem criou (auditoria).

        Returns:
            Budget recém-criado com active_version v1 em draft.
        """
        budget = Budget.objects.create(
            number=NumberAllocator.allocate("BUDGET"),
            customer=customer,
            vehicle_plate=vehicle_plate.upper(),
            vehicle_description=vehicle_description,
        )
        BudgetVersion.objects.create(
            budget=budget,
            version_number=1,
            status="draft",
            created_by=created_by,
        )
        return budget

    @classmethod
    @transaction.atomic
    def send_to_customer(
        cls,
        *,
        version: BudgetVersion,
        sent_by: str,
    ) -> BudgetVersion:
        """Congela versão, calcula totais, gera PDF stub, marca 'sent' + validade 30d.

        Só aceita versões em status 'draft'. Após send, a versão torna-se
        imutável (is_frozen() == True).

        Args:
            version: BudgetVersion em status 'draft'.
            sent_by: username/nome de quem enviou (auditoria).

        Returns:
            BudgetVersion atualizada com status='sent'.

        Raises:
            ValidationError: se version.status != 'draft'.
        """
        if version.status != "draft":
            raise ValidationError(
                {"status": f"Só versões em 'draft' podem ser enviadas (atual: {version.status})"}
            )

        cls._recalculate_totals(version)

        now = timezone.now()
        version.status = "sent"
        version.sent_at = now
        version.valid_until = now + timedelta(days=BUDGET_VALIDITY_DAYS)
        version.pdf_s3_key = render_budget_pdf_stub(
            version.budget.number, version.version_number,
        )
        version.content_hash = cls._compute_hash(version)
        version.save()

        return version

    # ---- Helpers privados ----

    @classmethod
    def _recalculate_totals(cls, version: BudgetVersion) -> None:
        """Soma items + operations pra popular totais cache.

        Usa prefetch_related("operations") para evitar N+1 nas operações.
        Salva apenas os campos de total via update_fields para eficiência.
        """
        labor = Decimal("0")
        parts = Decimal("0")
        subtotal = Decimal("0")
        discount = Decimal("0")

        items = version.items.all().prefetch_related("operations")
        for item in items:
            gross = item.unit_price * item.quantity
            item_discount = gross - item.net_price
            discount += item_discount
            if item.item_type == "PART":
                parts += item.net_price
            subtotal += item.net_price
            for op in item.operations.all():
                labor += op.labor_cost

        version.labor_total = labor
        version.parts_total = parts
        version.subtotal = subtotal + labor
        version.discount_total = discount
        version.net_total = version.subtotal - version.discount_total
        version.save(update_fields=[
            "labor_total", "parts_total", "subtotal", "discount_total", "net_total",
        ])

    @classmethod
    def _compute_hash(cls, version: BudgetVersion) -> str:
        """SHA256 dos items da versão. Snapshot imutável pós-send.

        Ordena por sort_order + pk para hash determinístico.
        """
        payload = []
        for item in version.items.all().order_by("sort_order", "pk"):
            payload.append({
                "description": item.description,
                "qty": str(item.quantity),
                "unit_price": str(item.unit_price),
                "net_price": str(item.net_price),
                "item_type": item.item_type,
            })
        serialized = json.dumps(payload, sort_keys=True)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
