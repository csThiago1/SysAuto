"""
Paddock Solutions — Service Orders: Versioning Service Methods
Mixin com os metodos de versionamento do ServiceOrderService.
"""
import logging
from decimal import Decimal
from typing import Any

from django.db import transaction
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)


class _ServiceOrderVersioningMixin:
    """Mixin com metodos de versionamento do ServiceOrderService."""

    @classmethod
    @transaction.atomic
    def create_new_version_from_import(
        cls,
        *,
        service_order: "ServiceOrder",
        parsed_budget: Any,
        import_attempt: Any,
    ) -> "ServiceOrderVersion":
        """
        Chamado pelos importadores (Cilia, XML) ao receber nova versao de orcamento.
        Cria ServiceOrderVersion + pausa OS em 'budget'.
        """
        from apps.service_orders.models import ServiceOrderVersion
        from apps.service_orders.events import OSEventLogger

        active = service_order.versions.order_by("-version_number").first()
        next_num = (active.version_number if active else 0) + 1

        version = ServiceOrderVersion.objects.create(
            service_order=service_order,
            version_number=next_num,
            source=parsed_budget.source,
            external_version=getattr(parsed_budget, "external_version", ""),
            external_numero_vistoria=getattr(parsed_budget, "external_numero_vistoria", ""),
            external_integration_id=getattr(parsed_budget, "external_integration_id", ""),
            status=getattr(parsed_budget, "external_status", None) or "analisado",
            content_hash=getattr(parsed_budget, "raw_hash", ""),
            raw_payload_s3_key=getattr(import_attempt, "raw_payload_s3_key", ""),
            import_attempt=import_attempt,
            hourly_rates=getattr(parsed_budget, "hourly_rates", {}),
            global_discount_pct=getattr(parsed_budget, "global_discount_pct", Decimal("0")),
        )

        try:
            from apps.cilia.services import ImportService
            ImportService.persist_items(parsed_budget=parsed_budget, version=version)
        except (ImportError, AttributeError):
            logger.warning(
                "ImportService.persist_items indisponivel -- versao criada sem itens (OS #%s v%d)",
                service_order.pk, next_num,
            )

        OSEventLogger.log_event(
            service_order, "VERSION_CREATED",
            actor="Sistema",
            payload={
                "version_number": next_num,
                "source": parsed_budget.source,
                "external_version": getattr(parsed_budget, "external_version", ""),
            },
            swallow_errors=True,
        )
        OSEventLogger.log_event(
            service_order, "IMPORT_RECEIVED",
            actor="Sistema",
            payload={"source": parsed_budget.source, "attempt_id": getattr(import_attempt, "pk", None)},
            swallow_errors=True,
        )

        terminal = {"reception", "delivered", "cancelled"}
        if service_order.status != "budget" and service_order.status not in terminal:
            cls.change_status(
                service_order=service_order,
                new_status="budget",
                changed_by="Sistema",
                notes=f"Nova versao importada: {version.external_version or version.version_number}",
                is_auto=True,
            )

        return version

    @classmethod
    @transaction.atomic
    def approve_version(
        cls,
        *,
        version: "ServiceOrderVersion",
        approved_by: str,
    ) -> "ServiceOrderVersion":
        """
        Aprova uma versao de OS.
        - Marca como 'autorizado' (segurado) ou 'approved' (particular).
        - Supersede outras versoes pendentes.
        - Se OS esta em 'budget' com previous_status, retorna ao previous_status.
        """
        from django.utils import timezone
        from apps.service_orders.events import OSEventLogger

        os = version.service_order
        version.status = "autorizado" if os.customer_type == "insurer" else "approved"
        version.approved_at = timezone.now()
        version.save(update_fields=["status", "approved_at"])

        os.versions.exclude(pk=version.pk).exclude(
            status__in=["approved", "rejected", "autorizado", "negado"]
        ).update(status="superseded")

        OSEventLogger.log_event(
            os, "VERSION_APPROVED",
            actor=approved_by,
            payload={"version_number": version.version_number, "source": version.source},
            swallow_errors=True,
        )

        if os.status == "budget" and os.previous_status:
            cls.change_status(
                service_order=os,
                new_status=os.previous_status,
                changed_by="Sistema",
                notes="Auto: versao aprovada, retomando estado anterior",
                is_auto=True,
            )

        return version

    @classmethod
    def recalculate_version_totals(cls, version: "ServiceOrderVersion") -> None:
        """
        Recalcula os totais de uma ServiceOrderVersion a partir dos itens e operacoes.
        """
        from decimal import Decimal as D

        items = version.items.all()

        labor = D("0")
        parts = D("0")
        subtotal = D("0")
        discount = D("0")
        total_seguradora = D("0")
        total_complemento = D("0")
        total_franquia = D("0")

        for item in items:
            item_net = item.net_price
            item_gross = item.unit_price * item.quantity
            item_discount = item_gross - item_net
            discount += item_discount

            if item.item_type == "PART":
                parts += item_net
            else:
                labor += item_net
            subtotal += item_net

            if item.payer_block == "SEGURADORA":
                total_seguradora += item_net
            elif item.payer_block == "COMPLEMENTO_PARTICULAR":
                total_complemento += item_net
            elif item.payer_block == "FRANQUIA":
                total_franquia += item_net

        version.labor_total = labor
        version.parts_total = parts
        version.subtotal = subtotal + labor
        version.discount_total = discount
        version.net_total = version.subtotal - discount
        version.total_seguradora = total_seguradora
        version.total_complemento_particular = total_complemento
        version.total_franquia = total_franquia
        version.save(update_fields=[
            "labor_total", "parts_total", "subtotal", "discount_total", "net_total",
            "total_seguradora", "total_complemento_particular", "total_franquia",
        ])

    @classmethod
    def compute_version_diff(
        cls,
        *,
        current_version: "ServiceOrderVersion",
        new_version: "ServiceOrderVersion",
        service_order: "ServiceOrder",
    ) -> dict:
        """Computa diff entre duas versoes, marcando itens executados."""
        current_items = {
            i.external_code or i.description: i
            for i in current_version.items.all()
        }
        new_items = {
            i.external_code or i.description: i
            for i in new_version.items.all()
        }

        executed_descriptions = set()
        executed_parts = service_order.parts.filter(
            source_type="import",
            status_peca__in=["bloqueada", "recebida", "comprada"],
        ).values_list("description", flat=True)
        executed_descriptions.update(executed_parts)

        all_keys = set(current_items) | set(new_items)
        diff_items = []

        for key in sorted(all_keys):
            old = current_items.get(key)
            new = new_items.get(key)
            is_executed = key in executed_descriptions

            if old and not new:
                diff_items.append({
                    "description": old.description,
                    "item_type": old.item_type,
                    "old_value": old.net_price,
                    "new_value": None,
                    "change_type": "removed",
                    "is_executed": is_executed,
                })
            elif new and not old:
                diff_items.append({
                    "description": new.description,
                    "item_type": new.item_type,
                    "old_value": None,
                    "new_value": new.net_price,
                    "change_type": "added",
                    "is_executed": False,
                })
            elif old and new:
                changed = old.net_price != new.net_price or old.quantity != new.quantity
                diff_items.append({
                    "description": new.description,
                    "item_type": new.item_type,
                    "old_value": old.net_price,
                    "new_value": new.net_price,
                    "change_type": "changed" if changed else "unchanged",
                    "is_executed": is_executed,
                })

        old_total = current_version.net_total or Decimal("0")
        new_total = new_version.net_total or Decimal("0")
        totals_diff = {
            "old_total": str(old_total),
            "new_total": str(new_total),
            "difference": str(new_total - old_total),
        }

        return {"diff_items": diff_items, "totals_diff": totals_diff}

    @classmethod
    @transaction.atomic
    def apply_version_override(
        cls,
        *,
        service_order: "ServiceOrder",
        new_version: "ServiceOrderVersion",
        applied_by: str = "Sistema",
    ) -> "ServiceOrderVersion":
        """Aplica override da nova versao, preservando itens executados e complemento."""
        from apps.service_orders.events import OSEventLogger
        from apps.service_orders.models import ServiceOrderPart, ServiceOrderLabor

        service_order.versions.exclude(pk=new_version.pk).exclude(
            status__in=["approved", "rejected", "autorizado", "negado", "superseded"],
        ).update(status="superseded")

        cls.recalculate_version_totals(new_version)

        service_order.parts.filter(
            source_type="import",
            status_peca="manual",
        ).delete()
        service_order.labor_items.filter(
            source_type="import",
        ).exclude(
            billing_status="billed",
        ).delete()

        for item in new_version.items.all():
            if item.item_type == "PART":
                # Peca fornecida pela seguradora -> unit_price=0 (nao cobramos/compramos)
                # Peca fornecida pela oficina -> unit_price do orcamento
                is_insurer_supplied = item.supplier == "SEGURADORA"
                ServiceOrderPart.objects.create(
                    service_order=service_order,
                    description=item.description,
                    part_number=item.external_code,
                    quantity=item.quantity,
                    unit_price=Decimal("0") if is_insurer_supplied else item.unit_price,
                    discount=Decimal("0") if is_insurer_supplied else (item.unit_price * item.quantity - item.net_price),
                    payer="insurer",
                    source_type="import",
                    origem="seguradora" if is_insurer_supplied else "compra",
                    tipo_qualidade=cls._map_part_type(item.part_type),
                    status_peca="aguardando_seguradora" if is_insurer_supplied else "manual",
                )
            elif item.item_type in ("SERVICE", "EXTERNAL_SERVICE"):
                # part_type guarda o tipo de servico (Remocao e Instalacao, Pintura, Reparacao, Servico)
                svc_type = item.part_type or "Servico"
                ServiceOrderLabor.objects.create(
                    service_order=service_order,
                    description=f"[{svc_type}] {item.description}",
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    discount=item.unit_price * item.quantity - item.net_price,
                    payer="insurer",
                    source_type="import",
                )

        OSEventLogger.log_event(
            service_order, "VERSION_APPROVED",
            actor=applied_by,
            payload={
                "version_number": new_version.version_number,
                "action": "override",
            },
            swallow_errors=True,
        )

        service_order.recalculate_totals()
        return new_version

    @staticmethod
    def _map_part_type(cilia_type: str) -> str:
        mapping = {
            "GENUINA": "genuina",
            "ORIGINAL": "genuina",
            "OUTRAS_FONTES": "reposicao",
            "VERDE": "usada",
        }
        return mapping.get(cilia_type, "")

    @classmethod
    @transaction.atomic
    def create_from_budget(
        cls, *, version: Any, created_by_user: Any = None,
    ) -> "ServiceOrder":
        """Cria ServiceOrder particular a partir de uma BudgetVersion aprovada.

        Copia: cliente (FK + nome), dados do veiculo e itens (pecas/servicos).

        Args:
            version: BudgetVersion. budget.customer deve estar acessivel via FK.
            created_by_user: GlobalUser que aprovou -- usado para o log de criacao.

        Returns:
            ServiceOrder recem-criada vinculada ao Budget.
        """
        from apps.service_orders.models import (
            ServiceOrder,
            ServiceOrderActivityLog,
            ServiceOrderLabor,
            ServiceOrderPart,
        )
        from apps.service_orders.events import OSEventLogger

        budget = version.budget
        customer = budget.customer

        # Separa vehicle_description em make/model (primeiras 2 palavras)
        desc_parts = (budget.vehicle_description or "").split()
        make = desc_parts[0] if desc_parts else ""
        model_name = desc_parts[1] if len(desc_parts) > 1 else ""

        os_instance = ServiceOrder.objects.create(
            number=cls.get_next_number(),
            customer=customer,
            customer_uuid=customer.pk if customer else None,
            customer_name=getattr(customer, "full_name", "") or "",
            plate=budget.vehicle_plate,
            make=make,
            make_logo=budget.vehicle_make_logo or "",
            model=model_name,
            vehicle_version=budget.vehicle_version or "",
            chassis=budget.vehicle_chassis or "",
            color=budget.vehicle_color or "",
            fuel_type=budget.vehicle_fuel_type or "",
            year=budget.vehicle_year,
            customer_type="private",
            status="reception",
        )

        # -- Copia itens do orcamento aprovado para a OS --
        from apps.items.models import ItemOperation

        parts_to_create: list[ServiceOrderPart] = []
        labor_to_create: list[ServiceOrderLabor] = []

        for item in version.items.all():
            gross = item.quantity * item.unit_price
            discount = max(gross - item.net_price, 0) if item.net_price < gross else 0

            if item.item_type == "PART":
                parts_to_create.append(
                    ServiceOrderPart(
                        service_order=os_instance,
                        description=item.description,
                        part_number=item.external_code or "",
                        quantity=item.quantity,
                        unit_price=item.unit_price,
                        discount=discount,
                    )
                )
            else:
                # SERVICE, EXTERNAL_SERVICE, FEE -> labor_items
                labor_to_create.append(
                    ServiceOrderLabor(
                        service_order=os_instance,
                        description=item.description,
                        quantity=item.quantity,
                        unit_price=item.unit_price,
                        discount=discount,
                    )
                )

            # Cada ItemOperation (mao de obra) do item vira um ServiceOrderLabor
            for op in ItemOperation.objects.filter(item_budget=item).select_related(
                "operation_type", "labor_category",
            ):
                op_label = str(op.operation_type) if op.operation_type else "Mao de obra"
                cat_label = str(op.labor_category) if op.labor_category else ""
                desc = f"{op_label} -- {item.description}"
                if cat_label:
                    desc = f"{op_label} ({cat_label}) -- {item.description}"
                labor_to_create.append(
                    ServiceOrderLabor(
                        service_order=os_instance,
                        description=desc,
                        quantity=op.hours or 1,
                        unit_price=op.hourly_rate or 0,
                        discount=0,
                    )
                )

        if parts_to_create:
            ServiceOrderPart.objects.bulk_create(parts_to_create)
        if labor_to_create:
            ServiceOrderLabor.objects.bulk_create(labor_to_create)

        # Recalcula totais uma unica vez (bulk_create nao dispara save())
        os_instance.recalculate_totals()

        # Log de criacao no historico (visivel na aba Historico da OS)
        if created_by_user:
            ServiceOrderActivityLog.objects.create(
                service_order=os_instance,
                user=created_by_user,
                activity_type="created",
                description=(
                    f"OS criada a partir do orcamento {version.budget.number} "
                    f"v{version.version_number}"
                ),
                metadata={
                    "budget_number": version.budget.number,
                    "version_number": version.version_number,
                    "parts_count": len(parts_to_create),
                    "labor_count": len(labor_to_create),
                },
            )

        OSEventLogger.log_event(
            os_instance,
            "BUDGET_LINKED",
            actor="Sistema",
            payload={
                "budget_number": budget.number,
                "version_number": version.version_number,
            },
            swallow_errors=True,
        )
        return os_instance
