"""
Paddock Solutions — Service Orders Service Layer
Toda lógica de negócio de OS fica aqui — nunca no serializer ou na view.
"""
import logging
from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.db import models, transaction
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)

# Mapeamento campo → (status_de_origem_válidos, status_destino)
# Quando um desses campos passa de None para um valor, o status muda automaticamente.
AUTO_TRANSITIONS: dict[str, tuple[list[str], str]] = {
    "authorization_date":   (["budget", "waiting_auth"], "authorized"),
    "scheduling_date":      (["reception"],              "initial_survey"),
    "final_survey_date":    (["washing"],                "final_survey"),
    "client_delivery_date": (["ready"],                  "delivered"),
    # Clientes particulares: ao definir data do orçamento, aguarda autorização
    "quotation_date":       (["budget", "initial_survey"], "waiting_auth"),
}


class ServiceOrderService:
    """Service layer para Ordens de Serviço."""

    @classmethod
    @transaction.atomic
    def get_next_number(cls) -> int:
        """Retorna próximo número de OS disponível (MAX + 1) no schema ativo usando lock de linha."""
        from apps.service_orders.models import ServiceOrder

        last = (
            ServiceOrder.objects
            .select_for_update()
            .aggregate(max_num=models.Max("number"))["max_num"]
        )
        return (last or 0) + 1

    @classmethod
    @transaction.atomic
    def create(cls, data: dict[str, Any], created_by_id: str) -> "ServiceOrder":
        """
        Cria nova OS com número automático.

        Args:
            data: Campos validados pelo serializer.
            created_by_id: UUID do usuário que está abrindo a OS.

        Returns:
            ServiceOrder recém-criada.
        """
        from apps.service_orders.models import ServiceOrder, ServiceOrderActivityLog

        payload = dict(data)
        payload["number"] = cls.get_next_number()
        payload["created_by_id"] = created_by_id
        # Atribuição automática de consultor para quem abriu
        if not payload.get("consultant_id"):
            payload["consultant_id"] = created_by_id
        # customer é UUID do UnifiedCustomer (schema public) — não mapeia para o FK inteiro de Person.
        # Persiste como customer_uuid (UUIDField) e remove da chave FK para não quebrar o INSERT.
        customer_uuid = payload.pop("customer", None)
        if customer_uuid is not None:
            payload["customer_uuid"] = customer_uuid

        # customer_id é FK inteira de Person (fluxo CreateOSForm) — já mapeada como customer_id no payload.
        # Auto-popula customer_name a partir do nome da Person quando não enviado pelo frontend.
        customer_id = payload.get("customer_id")
        if customer_id and not payload.get("customer_name"):
            from apps.persons.models import Person
            try:
                payload["customer_name"] = Person.objects.get(pk=customer_id).full_name
            except Person.DoesNotExist:
                pass

        order = ServiceOrder(**payload)
        order.save()
        
        ServiceOrderActivityLog.objects.create(
            service_order=order,
            user_id=created_by_id,
            activity_type="created",
            description="OS aberta",
        )
        
        logger.info("OS #%d criada por user_id=%s", order.number, created_by_id)
        return order

    @classmethod
    @transaction.atomic
    def update(
        cls,
        order_id: str,
        data: dict[str, Any],
        updated_by_id: str,
    ) -> "ServiceOrder":
        """
        Atualiza OS e processa transições automáticas de status.

        Regra: máximo 1 transição por update. Se múltiplos campos de data
        forem preenchidos de uma vez, apenas o primeiro gatilho é processado.

        Args:
            order_id: UUID da OS.
            data: Campos a atualizar (validados pelo serializer).
            updated_by_id: UUID do usuário que está atualizando.

        Returns:
            ServiceOrder atualizada.
        """
        from apps.service_orders.models import ServiceOrder, StatusTransitionLog, ServiceOrderActivityLog

        order = ServiceOrder.objects.select_for_update().get(id=order_id)

        # customer é UUID do UnifiedCustomer — não é FK de Person. Persiste como customer_uuid.
        data = dict(data)
        customer_uuid = data.pop("customer", None)
        if customer_uuid is not None:
            data["customer_uuid"] = customer_uuid

        # Detectar campos de data recém-preenchidos que disparam transição
        triggered_transitions: list[tuple[str, str]] = []

        FIELD_LABELS: dict[str, str] = {
            # Veículo
            "plate": "Placa", "make": "Marca", "model": "Modelo", "year": "Ano",
            "color": "Cor", "chassis": "Chassi", "fuel_type": "Combustível",
            "fipe_value": "Valor FIPE", "mileage_in": "KM entrada", "mileage_out": "KM saída",
            "vehicle_version": "Versão do veículo", "vehicle_location": "Localização do veículo",
            # Cliente
            "customer_name": "Nome do cliente", "customer_uuid": "Cliente vinculado",
            "customer_type": "Tipo de cliente",
            # Datas / prazo
            "entry_date": "Data de entrada",
            "service_authorization_date": "Autorização do serviço",
            "scheduling_date": "Agendamento",
            "authorization_date": "Data de autorização",
            "quotation_date": "Data do orçamento",
            "repair_days": "Dias de reparo",
            "estimated_delivery_date": "Previsão de entrega",
            "delivery_date": "Data de entrega",
            "final_survey_date": "Vistoria final",
            "client_delivery_date": "Entrega ao cliente",
            # Seguradora
            "insurer": "Seguradora", "insured_type": "Tipo de segurado",
            "deductible_amount": "Franquia", "casualty_number": "Número do sinistro",
            "broker_name": "Corretor", "expert": "Perito",
            "expert_date": "Visita do perito", "survey_date": "Data da vistoria",
            "os_type": "Tipo de OS",
            # Geral
            "consultant_id": "Consultor", "notes": "Observações",
            "invoice_issued": "NF emitida", "nfe_key": "Chave NF-e", "nfse_number": "NFS-e",
        }

        # Grupos de campos → activity_type separado no log
        FIELD_GROUPS: list[tuple[str, frozenset[str]]] = [
            ("customer_updated", frozenset({
                "customer_name", "customer_uuid", "customer_type",
            })),
            ("vehicle_updated", frozenset({
                "plate", "make", "model", "year", "color", "chassis",
                "fuel_type", "fipe_value", "mileage_in", "mileage_out",
                "vehicle_version", "vehicle_location",
            })),
            ("schedule_updated", frozenset({
                "entry_date", "service_authorization_date", "scheduling_date",
                "authorization_date", "quotation_date", "repair_days",
                "estimated_delivery_date", "delivery_date", "final_survey_date",
                "client_delivery_date",
            })),
            ("insurer_updated", frozenset({
                "insurer", "insured_type", "deductible_amount", "casualty_number",
                "broker_name", "expert", "expert_date", "survey_date", "os_type",
            })),
            ("updated", frozenset({
                "consultant_id", "notes", "invoice_issued", "nfe_key", "nfse_number",
            })),
        ]

        for field, (valid_from, target) in AUTO_TRANSITIONS.items():
            old_value = getattr(order, field)
            new_value = data.get(field)
            if old_value is None and new_value is not None:
                if order.status in valid_from:
                    triggered_transitions.append((field, target))

        # Aplicar todos os campos e rastrear diferenças por grupo
        changes_by_group: dict[str, list[dict[str, Any]]] = {g: [] for g, _ in FIELD_GROUPS}
        other_changes: list[dict[str, Any]] = []

        for key, value in data.items():
            old_value = getattr(order, key)
            if old_value != value:
                label = FIELD_LABELS.get(key, key)
                change = {
                    "field": key,
                    "field_label": label,
                    "old_value": str(old_value) if old_value is not None else None,
                    "new_value": str(value) if value is not None else None,
                }
                assigned = False
                for group_type, group_fields in FIELD_GROUPS:
                    if key in group_fields:
                        changes_by_group[group_type].append(change)
                        assigned = True
                        break
                if not assigned:
                    other_changes.append(change)
            setattr(order, key, value)

        # Criar um log por grupo que teve alterações
        if any(changes_by_group.values()) or other_changes:
            from apps.authentication.models import GlobalUser
            user = GlobalUser.objects.filter(id=updated_by_id).first()
            user_name = user.get_full_name() or user.email if user else "Usuário"

            GROUP_LABELS: dict[str, str] = {
                "customer_updated": "atualizou dados do cliente",
                "vehicle_updated": "atualizou dados do veículo",
                "schedule_updated": "atualizou datas e prazos",
                "insurer_updated": "atualizou dados da seguradora",
                "updated": "atualizou informações da OS",
            }

            for group_type, group_fields in FIELD_GROUPS:
                group_changes = changes_by_group[group_type]
                if not group_changes:
                    continue
                desc = f"{user_name} {GROUP_LABELS.get(group_type, 'atualizou')}."
                ServiceOrderActivityLog.objects.create(
                    service_order=order,
                    user_id=updated_by_id,
                    activity_type=group_type,
                    description=desc,
                    metadata={"field_changes": group_changes},
                )

            if other_changes:
                desc = f"{user_name} {GROUP_LABELS['updated']}."
                ServiceOrderActivityLog.objects.create(
                    service_order=order,
                    user_id=updated_by_id,
                    activity_type="updated",
                    description=desc,
                    metadata={"field_changes": other_changes},
                )

        # Aplicar transição (máximo 1 por update)
        if triggered_transitions:
            field_trigger, new_status = triggered_transitions[0]
            old_status = order.status
            order.status = new_status
            logger.info(
                "OS #%d: auto-transition %s→%s via campo '%s'",
                order.number,
                old_status,
                new_status,
                field_trigger,
            )
            StatusTransitionLog.objects.create(
                service_order=order,
                from_status=old_status,
                to_status=new_status,
                triggered_by_field=field_trigger,
                changed_by_id=updated_by_id,
            )

        # Calcular previsão de entrega automaticamente
        if order.entry_date and order.repair_days:
            entry = order.entry_date
            entry_date = entry.date() if hasattr(entry, "date") else entry
            order.estimated_delivery_date = entry_date + timedelta(days=order.repair_days)

        order.save()

        # ── Propagar dados do veículo para outras OSes com a mesma placa ────
        vehicle_fields = {
            "make", "make_logo", "model", "year", "color", "chassis",
            "fuel_type", "vehicle_version",
        }
        vehicle_changed = vehicle_fields & set(data.keys())
        if vehicle_changed and order.plate:
            update_payload = {f: getattr(order, f) for f in vehicle_fields}
            ServiceOrder.objects.filter(
                plate=order.plate, is_active=True,
            ).exclude(pk=order.pk).update(**update_payload)

        return order

    @classmethod
    @transaction.atomic
    def transition(
        cls,
        order_id: str,
        new_status: str,
        changed_by_id: str,
    ) -> "ServiceOrder":
        """
        Executa transição manual de status da OS.

        Args:
            order_id: UUID da OS.
            new_status: Status de destino.
            changed_by_id: UUID do usuário que está executando a transição.

        Raises:
            ValidationError: Se a transição não for permitida pelas regras do Kanban.

        Returns:
            ServiceOrder com status atualizado.
        """
        from apps.service_orders.models import ServiceOrder, StatusTransitionLog, VALID_TRANSITIONS

        order = ServiceOrder.objects.select_for_update().get(id=order_id)

        if new_status not in VALID_TRANSITIONS.get(order.status, []):
            raise ValidationError(
                {
                    "status": (
                        f"Transição inválida: {order.status} → {new_status}. "
                        f"Permitidas: {VALID_TRANSITIONS.get(order.status, [])}"
                    )
                }
            )

        old_status = order.status
        order.status = new_status

        from django.utils import timezone
        now = timezone.now()

        # Auto-preenchimento de datas chaves ao avançar no Kanban
        if new_status == "initial_survey" and not order.entry_date:
            order.entry_date = now
        elif new_status == "authorized" and not order.authorization_date:
            order.authorization_date = now
        elif new_status == "final_survey" and not order.final_survey_date:
            order.final_survey_date = now
        elif new_status == "delivered":
            if not order.client_delivery_date:
                order.client_delivery_date = now
            if not order.delivered_at:
                order.delivered_at = now

        order.save(update_fields=[
            "status", "entry_date", "authorization_date",
            "final_survey_date", "client_delivery_date",
            "delivered_at", "updated_at"
        ])

        StatusTransitionLog.objects.create(
            service_order=order,
            from_status=old_status,
            to_status=new_status,
            triggered_by_field="",
            changed_by_id=changed_by_id,
        )

        from apps.authentication.models import GlobalUser
        from apps.service_orders.models import ServiceOrderActivityLog
        user = GlobalUser.objects.filter(id=changed_by_id).first()
        user_name = user.get_full_name() or user.email if user else "Usuário"
        from apps.service_orders.models import ServiceOrderStatus as SOS
        old_label = dict(SOS.choices).get(old_status, old_status)
        new_label = dict(SOS.choices).get(new_status, new_status)
        ServiceOrderActivityLog.objects.create(
            service_order=order,
            user_id=changed_by_id,
            activity_type="status_changed",
            description=f"{user_name} moveu a OS de '{old_label}' para '{new_label}'",
            metadata={"from_status": old_status, "to_status": new_status},
        )

        logger.info(
            "OS #%d: transição manual %s→%s por user_id=%s",
            order.number,
            old_status,
            new_status,
            changed_by_id,
        )
        return order

    # ── Novos métodos de versionamento ────────────────────────────────────────

    @classmethod
    @transaction.atomic
    def change_status(
        cls,
        *,
        service_order: "ServiceOrder",
        new_status: str,
        changed_by: str = "Sistema",
        notes: str = "",
        is_auto: bool = False,
    ) -> "ServiceOrder":
        """
        Muda status com validação de transição (nova API — paralela ao transition()).
        Salva previous_status ao entrar em 'budget'. Loga ServiceOrderEvent.

        Raises:
            ValidationError: Transição inválida.
        """
        from apps.service_orders.models import VALID_TRANSITIONS
        from apps.service_orders.events import OSEventLogger

        current = service_order.status
        allowed = VALID_TRANSITIONS.get(current, [])
        if new_status not in allowed:
            raise ValidationError({
                "status": (
                    f"Transição inválida: {current} → {new_status}. "
                    f"Permitidas: {allowed}"
                )
            })

        if new_status == "budget":
            service_order.previous_status = current

        service_order.status = new_status
        service_order.save(update_fields=["status", "previous_status", "updated_at"])

        event_type = "AUTO_TRANSITION" if is_auto else "STATUS_CHANGE"
        OSEventLogger.log_event(
            service_order,
            event_type,
            actor=changed_by,
            from_state=current,
            to_state=new_status,
            payload={"notes": notes},
            swallow_errors=True,
        )
        return service_order

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
        Chamado pelos importadores (Cilia, XML) ao receber nova versão de orçamento.
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
                "ImportService.persist_items indisponível — versão criada sem itens (OS #%s v%d)",
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
                notes=f"Nova versão importada: {version.external_version or version.version_number}",
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
        Aprova uma versão de OS.
        - Marca como 'autorizado' (segurado) ou 'approved' (particular).
        - Supersede outras versões pendentes.
        - Se OS está em 'budget' com previous_status, retorna ao previous_status.
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
                notes="Auto: versão aprovada, retomando estado anterior",
                is_auto=True,
            )

        return version

    @classmethod
    def recalculate_version_totals(cls, version: "ServiceOrderVersion") -> None:
        """
        Recalcula os totais de uma ServiceOrderVersion a partir dos itens e operações.
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
        """Computa diff entre duas versões, marcando itens executados."""
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
        """Aplica override da nova versão, preservando itens executados e complemento."""
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
                ServiceOrderPart.objects.create(
                    service_order=service_order,
                    description=item.description,
                    part_number=item.external_code,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    discount=item.unit_price * item.quantity - item.net_price,
                    payer="insurer",
                    source_type="import",
                    origem="seguradora",
                    tipo_qualidade=cls._map_part_type(item.part_type),
                )
            elif item.item_type in ("SERVICE", "EXTERNAL_SERVICE"):
                ServiceOrderLabor.objects.create(
                    service_order=service_order,
                    description=item.description,
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
    def financial_summary(cls, service_order: "ServiceOrder") -> dict:
        """Calcula resumo financeiro: seguradora + complemento."""
        from decimal import Decimal as D

        parts_insurer = D("0")
        labor_insurer = D("0")
        parts_complement = D("0")
        labor_complement = D("0")
        complement_billed = D("0")

        for part in service_order.parts.filter(is_active=True):
            amount = D(str(part.quantity)) * D(str(part.unit_price)) - D(str(part.discount))
            if part.source_type == "complement":
                parts_complement += amount
                if part.billing_status == "billed":
                    complement_billed += amount
            else:
                parts_insurer += amount

        for labor in service_order.labor_items.filter(is_active=True):
            amount = D(str(labor.quantity)) * D(str(labor.unit_price)) - D(str(labor.discount))
            if labor.source_type == "complement":
                labor_complement += amount
                if labor.billing_status == "billed":
                    complement_billed += amount
            else:
                labor_insurer += amount

        insurer_subtotal = parts_insurer + labor_insurer
        deductible = min(D(str(service_order.deductible_amount or 0)), insurer_subtotal)
        insurer_net = insurer_subtotal - deductible
        complement_subtotal = parts_complement + labor_complement
        complement_pending = complement_subtotal - complement_billed
        customer_owes = deductible + complement_pending
        grand_total = insurer_subtotal + complement_subtotal

        active_version = service_order.versions.order_by("-version_number").first()

        return {
            "insurer_parts": parts_insurer,
            "insurer_labor": labor_insurer,
            "insurer_subtotal": insurer_subtotal,
            "deductible": deductible,
            "insurer_net": insurer_net,
            "complement_parts": parts_complement,
            "complement_labor": labor_complement,
            "complement_subtotal": complement_subtotal,
            "complement_billed": complement_billed,
            "complement_pending": complement_pending,
            "customer_owes": customer_owes,
            "insurer_owes": insurer_net,
            "grand_total": grand_total,
            "active_version": active_version,
        }

    @classmethod
    @transaction.atomic
    def create_budget_snapshot(
        cls,
        order: "ServiceOrder",
        trigger: str,
        created_by_id: str,
    ) -> "BudgetSnapshot":
        """
        Cria snapshot imutável do estado atual do orçamento da OS.

        Args:
            order: Instância da ServiceOrder.
            trigger: TriggerType (cilia_import, manual_save, delivery, part_change).
            created_by_id: UUID do usuário que disparou o snapshot.

        Returns:
            BudgetSnapshot criado.
        """
        from apps.service_orders.models import BudgetSnapshot, ServiceOrderPart, ServiceOrderLabor

        # Calcula próxima versão
        last_version = (
            BudgetSnapshot.objects
            .filter(service_order=order)
            .aggregate(max_v=models.Max("version"))["max_v"]
        ) or 0
        next_version = last_version + 1

        # Serializa items
        items: list[dict[str, Any]] = []
        for part in ServiceOrderPart.objects.filter(service_order=order):
            items.append({
                "type": "part",
                "description": part.description,
                "part_number": part.part_number,
                "product_name": part.product.name if part.product else None,
                "quantity": float(part.quantity),
                "unit_price": float(part.unit_price),
                "discount": float(part.discount),
                "total": part.total,
            })
        for labor in ServiceOrderLabor.objects.filter(service_order=order):
            items.append({
                "type": "labor",
                "description": labor.description,
                "quantity": float(labor.quantity),
                "unit_price": float(labor.unit_price),
                "discount": float(labor.discount),
                "total": labor.total,
            })

        snapshot = BudgetSnapshot.objects.create(
            service_order=order,
            version=next_version,
            trigger=trigger,
            parts_total=order.parts_total,
            services_total=order.services_total,
            discount_total=order.discount_total,
            items_snapshot=items,
            created_by_id=created_by_id,
        )

        logger.info(
            "OS #%d: budget snapshot v%d criado (trigger=%s)",
            order.number,
            next_version,
            trigger,
        )
        return snapshot

    @staticmethod
    @transaction.atomic
    def add_part(
        order: "ServiceOrder",
        data: dict[str, Any],
        created_by: Any,
    ) -> "ServiceOrderPart":
        """
        Adiciona peça à OS e recalcula totais.

        Args:
            order: Instância da ServiceOrder.
            data: Dados validados da peça.
            created_by: Usuário que está adicionando.

        Raises:
            ValidationError: Se a OS estiver encerrada (delivered/cancelled).

        Returns:
            ServiceOrderPart recém-criada.
        """
        from apps.service_orders.models import ServiceOrderPart, ServiceOrderStatus

        if order.status in (ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELLED):
            raise ValidationError(
                {"detail": "Não é possível modificar itens de uma OS encerrada."}
            )

        part = ServiceOrderPart(service_order=order, created_by=created_by, **data)
        part.save()

        from apps.service_orders.models import ServiceOrderActivityLog
        ServiceOrderActivityLog.objects.create(
            service_order=order,
            user_id=str(created_by.id),
            activity_type="part_added",
            description=f"Peça '{part.description}' adicionada (Qtd: {part.quantity} × R${part.unit_price})",
        )
        return part

    @staticmethod
    @transaction.atomic
    def add_labor(
        order: "ServiceOrder",
        data: dict[str, Any],
        created_by: Any,
    ) -> "ServiceOrderLabor":
        """
        Adiciona serviço à OS e recalcula totais.

        Args:
            order: Instância da ServiceOrder.
            data: Dados validados do serviço.
            created_by: Usuário que está adicionando.

        Raises:
            ValidationError: Se a OS estiver encerrada (delivered/cancelled).

        Returns:
            ServiceOrderLabor recém-criada.
        """
        from apps.service_orders.models import ServiceOrderLabor, ServiceOrderStatus

        if order.status in (ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELLED):
            raise ValidationError(
                {"detail": "Não é possível modificar itens de uma OS encerrada."}
            )

        labor = ServiceOrderLabor(service_order=order, created_by=created_by, **data)
        labor.save()

        from apps.service_orders.models import ServiceOrderActivityLog
        ServiceOrderActivityLog.objects.create(
            service_order=order,
            user_id=str(created_by.id),
            activity_type="labor_added",
            description=f"Serviço '{labor.description}' adicionado (Qtd: {labor.quantity} × R${labor.unit_price})",
        )
        return labor

    @classmethod
    @transaction.atomic
    def create_from_budget(
        cls, *, version: Any, created_by_user: Any = None,
    ) -> "ServiceOrder":
        """Cria ServiceOrder particular a partir de uma BudgetVersion aprovada.

        Copia: cliente (FK + nome), dados do veículo e itens (peças/serviços).

        Args:
            version: BudgetVersion. budget.customer deve estar acessível via FK.
            created_by_user: GlobalUser que aprovou — usado para o log de criação.

        Returns:
            ServiceOrder recém-criada vinculada ao Budget.
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

        # ── Copia itens do orçamento aprovado para a OS ─────────────────────
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
                # SERVICE, EXTERNAL_SERVICE, FEE → labor_items
                labor_to_create.append(
                    ServiceOrderLabor(
                        service_order=os_instance,
                        description=item.description,
                        quantity=item.quantity,
                        unit_price=item.unit_price,
                        discount=discount,
                    )
                )

            # Cada ItemOperation (mão de obra) do item vira um ServiceOrderLabor
            for op in ItemOperation.objects.filter(item_budget=item).select_related(
                "operation_type", "labor_category",
            ):
                op_label = str(op.operation_type) if op.operation_type else "Mão de obra"
                cat_label = str(op.labor_category) if op.labor_category else ""
                desc = f"{op_label} — {item.description}"
                if cat_label:
                    desc = f"{op_label} ({cat_label}) — {item.description}"
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

        # Recalcula totais uma única vez (bulk_create não dispara save())
        os_instance.recalculate_totals()

        # Log de criação no histórico (visível na aba Histórico da OS)
        if created_by_user:
            ServiceOrderActivityLog.objects.create(
                service_order=os_instance,
                user=created_by_user,
                activity_type="created",
                description=(
                    f"OS criada a partir do orçamento {version.budget.number} "
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


class ServiceOrderDeliveryService:
    """Lógica de entrega da OS ao cliente."""

    @classmethod
    @transaction.atomic
    def deliver(
        cls,
        order: "ServiceOrder",
        data: dict[str, Any],
        delivered_by_id: str,
    ) -> "ServiceOrder":
        """
        Entrega a OS ao cliente.

        Regras:
        - OS deve estar no status 'ready'
        - Cliente particular: NF-e ou NFS-e obrigatória
        - Cria BudgetSnapshot com trigger='delivery'
        - Cria ActivityLog com tipo 'delivery'
        - Registra mileage_out e notas se fornecidos

        Args:
            order: Instância da ServiceOrder (deve estar em status 'ready').
            data: Payload validado (mileage_out, notes, nfe_key, nfse_number).
            delivered_by_id: UUID do usuário realizando a entrega.

        Raises:
            ValidationError: Se status inválido ou fiscal obrigatório ausente.

        Returns:
            ServiceOrder com status 'delivered'.
        """
        from apps.service_orders.models import (
            ServiceOrder,
            ServiceOrderActivityLog,
            ActivityType,
        )
        from django.utils import timezone

        if order.status != "ready":
            raise ValidationError(
                {"detail": f"OS deve estar 'Pronto para Entrega' para ser entregue. Status atual: {order.status}"}
            )

        # Validação fiscal para clientes particulares
        if order.customer_type == "private":
            nfe_key = data.get("nfe_key") or order.nfe_key
            nfse_number = data.get("nfse_number") or order.nfse_number
            # 06C: aceita também FiscalDocument autorizado vinculado à OS
            has_authorized_doc = order.fiscal_documents.filter(
                status="authorized"
            ).exists() if hasattr(order, "fiscal_documents") else False
            if not nfe_key and not nfse_number and not has_authorized_doc:
                raise ValidationError(
                    {"fiscal": "NF-e ou NFS-e obrigatória para entrega de cliente particular."}
                )

        now = timezone.now()

        # Aplicar campos do payload
        if data.get("mileage_out"):
            order.mileage_out = data["mileage_out"]
        if data.get("notes"):
            order.notes = (order.notes + "\n" + data["notes"]).strip()
        nf_issued_now = False
        if data.get("nfe_key"):
            order.nfe_key = data["nfe_key"]
            if not order.invoice_issued:
                order.invoice_issued = True
                nf_issued_now = True
        if data.get("nfse_number"):
            order.nfse_number = data["nfse_number"]
            if not order.invoice_issued:
                order.invoice_issued = True
                nf_issued_now = True

        # Atualizar status e datas de entrega
        order.status = "delivered"
        if not order.client_delivery_date:
            order.client_delivery_date = now
        if not order.delivered_at:
            order.delivered_at = now

        order.save()

        # Log de nota fiscal emitida na entrega
        if nf_issued_now:
            from apps.service_orders.models import ServiceOrderActivityLog
            ServiceOrderActivityLog.objects.create(
                service_order=order,
                user_id=delivered_by_id,
                activity_type="invoice_issued",
                description=f"Nota fiscal registrada na entrega: {order.nfe_key or order.nfse_number}",
            )

        # Snapshot do orçamento final
        ServiceOrderService.create_budget_snapshot(
            order=order,
            trigger="delivery",
            created_by_id=delivered_by_id,
        )

        # Log de atividade
        from apps.authentication.models import GlobalUser
        user = GlobalUser.objects.filter(id=delivered_by_id).first()
        user_name = user.get_full_name() or user.email if user else "Usuário"

        ServiceOrderActivityLog.objects.create(
            service_order=order,
            user_id=delivered_by_id,
            activity_type=ActivityType.DELIVERY,
            description=f"{user_name} realizou a entrega do veículo ao cliente.",
            metadata={
                "mileage_out": order.mileage_out,
                "invoice_issued": order.invoice_issued,
                "delivered_at": now.isoformat(),
            },
        )

        # Criar título a receber automaticamente ao entregar a OS.
        # Savepoint isola a criação do recebível: se falhar, apenas reverte
        # esse bloco sem abortar a transação principal da entrega da OS.
        from django.db import transaction as _tx

        _sp = _tx.savepoint()
        try:
            from apps.accounts_receivable.models import ReceivableOrigin
            from apps.accounts_receivable.services import ReceivableDocumentService

            os_total = order.parts_total + order.services_total
            if os_total > 0:
                ReceivableDocumentService.create_receivable(
                    customer_id=str(order.customer_id) if order.customer_id else str(order.id),
                    customer_name=order.customer_name,
                    description=f"OS #{order.number} — {order.plate}",
                    amount=os_total,
                    due_date=now.date(),
                    competence_date=now.date(),
                    origin=ReceivableOrigin.OS,
                    service_order_id=str(order.id),
                    user=GlobalUser.objects.filter(id=delivered_by_id).first(),
                )
                _tx.savepoint_commit(_sp)
                logger.info(
                    "OS #%d: ReceivableDocument criado automaticamente (R$%s)",
                    order.number,
                    os_total,
                )
            else:
                _tx.savepoint_commit(_sp)
        except Exception as exc:
            _tx.savepoint_rollback(_sp)
            logger.error(
                "OS #%d: falha ao criar ReceivableDocument na entrega — %s",
                order.number,
                exc,
            )

        logger.info(
            "OS #%d: entregue ao cliente por user_id=%s",
            order.number,
            delivered_by_id,
        )
        return order
