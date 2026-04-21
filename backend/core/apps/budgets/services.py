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

    @classmethod
    @transaction.atomic
    def approve(
        cls,
        *,
        version: BudgetVersion,
        approved_by: str,
        evidence_s3_key: str = "",
    ) -> "ServiceOrder":
        """Aprova versão enviada e cria ServiceOrder particular.

        Args:
            version: BudgetVersion com status='sent'.
            approved_by: nome/username de quem aprovou (auditoria).
            evidence_s3_key: chave S3 da evidência de aprovação (WhatsApp print, assinatura, etc).

        Returns:
            ServiceOrder recém-criada vinculada ao Budget.

        Raises:
            ValidationError: se status != 'sent' ou se versão expirada.
        """
        from apps.service_orders.services import ServiceOrderService

        if version.status != "sent":
            raise ValidationError(
                {"status": f"Só 'sent' pode ser aprovada (atual: {version.status})"}
            )
        if version.valid_until and version.valid_until < timezone.now():
            raise ValidationError({"validity": "Orçamento expirado — crie um novo"})

        version.status = "approved"
        version.approved_at = timezone.now()
        version.approved_by = approved_by
        version.approval_evidence_s3_key = evidence_s3_key
        version.save()

        # Supersede versões irmãs não-terminais
        version.budget.versions.exclude(pk=version.pk).exclude(
            status__in=["approved", "rejected", "expired", "superseded"],
        ).update(status="superseded")

        # Cria OS particular
        os = ServiceOrderService.create_from_budget(version=version)

        version.budget.service_order = os
        version.budget.save(update_fields=["service_order"])
        return os

    @classmethod
    @transaction.atomic
    def reject(cls, *, version: BudgetVersion) -> BudgetVersion:
        """Marca versão como rejeitada (cliente disse não).

        Args:
            version: BudgetVersion com status='sent'.

        Returns:
            BudgetVersion atualizada com status='rejected'.

        Raises:
            ValidationError: se status != 'sent'.
        """
        if version.status != "sent":
            raise ValidationError(
                {"status": f"Só 'sent' pode ser rejeitada (atual: {version.status})"}
            )
        version.status = "rejected"
        version.save(update_fields=["status"])
        return version

    @classmethod
    @transaction.atomic
    def request_revision(cls, *, version: BudgetVersion) -> BudgetVersion:
        """Cliente pediu ajuste. Marca vN='revision', cria v+1 draft com items copiados.

        Args:
            version: BudgetVersion com status='sent'.

        Returns:
            Nova BudgetVersion em status='draft' com items copiados da versão anterior.

        Raises:
            ValidationError: se status != 'sent'.
        """
        if version.status != "sent":
            raise ValidationError(
                {"status": f"Só 'sent' pode entrar em revisão (atual: {version.status})"}
            )

        version.status = "revision"
        version.save(update_fields=["status"])

        new_version = BudgetVersion.objects.create(
            budget=version.budget,
            version_number=version.version_number + 1,
            status="draft",
            created_by=version.created_by,
        )
        cls._copy_items_between_versions(source=version, target=new_version)
        return new_version

    @classmethod
    def _copy_items_between_versions(
        cls, *, source: BudgetVersion, target: BudgetVersion,
    ) -> None:
        """Copia items de uma BudgetVersion pra outra, preservando operations.

        Usado em request_revision para popular a nova versão draft com os
        mesmos items da versão anterior, prontos para edição.
        """
        from apps.items.models import ItemOperation

        shared_fields = [
            "bucket", "payer_block", "impact_area", "item_type",
            "description", "external_code", "part_type", "supplier",
            "quantity", "unit_price", "unit_cost", "discount_pct", "net_price",
            "flag_abaixo_padrao", "flag_acima_padrao", "flag_inclusao_manual",
            "flag_codigo_diferente", "flag_servico_manual", "flag_peca_da_conta",
            "sort_order",
        ]
        for item in source.items.all().prefetch_related("operations"):
            new_item = BudgetVersionItem.objects.create(
                version=target,
                **{f: getattr(item, f) for f in shared_fields},
            )
            for op in item.operations.all():
                ItemOperation.objects.create(
                    item_budget=new_item,
                    operation_type=op.operation_type,
                    labor_category=op.labor_category,
                    hours=op.hours,
                    hourly_rate=op.hourly_rate,
                    labor_cost=op.labor_cost,
                )

    @classmethod
    @transaction.atomic
    def clone(cls, *, source_budget: Budget, created_by: str) -> Budget:
        """Clona budget arquivado (rejected/expired) pra reutilizar dados.

        Preserva `cloned_from` FK pra rastreabilidade. Copia itens da última
        versão não-draft do source (tipicamente a que foi enviada ao cliente).
        """
        new_budget = Budget.objects.create(
            number=NumberAllocator.allocate("BUDGET"),
            customer=source_budget.customer,
            vehicle_plate=source_budget.vehicle_plate,
            vehicle_description=source_budget.vehicle_description,
            cloned_from=source_budget,
        )
        new_v = BudgetVersion.objects.create(
            budget=new_budget, version_number=1,
            status="draft", created_by=created_by,
        )
        source_v = source_budget.versions.exclude(status="draft").order_by("-version_number").first()
        if source_v:
            cls._copy_items_between_versions(source=source_v, target=new_v)
        return new_budget

    @classmethod
    def expire_stale_versions(cls) -> int:
        """Marca versões 'sent' com valid_until < now como 'expired'.

        Retorna quantidade atualizada. Celery task `expire_stale_budgets`
        roda 1x por dia via beat schedule.
        """
        return BudgetVersion.objects.filter(
            status="sent", valid_until__lt=timezone.now(),
        ).update(status="expired")

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
