"""
Paddock Solutions — Service Orders: Core Service Methods
Mixin com os metodos principais do ServiceOrderService.
"""
import logging
from datetime import timedelta
from typing import Any

from django.db import models, transaction
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)

# Mapeamento campo -> (status_de_origem_validos, status_destino)
# Quando um desses campos passa de None para um valor, o status muda automaticamente.
AUTO_TRANSITIONS: dict[str, tuple[list[str], str]] = {
    "authorization_date":   (["budget", "waiting_auth"], "authorized"),
    "scheduling_date":      (["reception"],              "initial_survey"),
    "final_survey_date":    (["washing"],                "final_survey"),
    "client_delivery_date": (["ready"],                  "delivered"),
    # Clientes particulares: ao definir data do orcamento, aguarda autorizacao
    "quotation_date":       (["budget", "initial_survey"], "waiting_auth"),
}


class _ServiceOrderCoreMixin:
    """Mixin com metodos core do ServiceOrderService."""

    @classmethod
    @transaction.atomic
    def get_next_number(cls) -> int:
        """Retorna proximo numero de OS disponivel (MAX + 1) no schema ativo usando lock de linha."""
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
        Cria nova OS com numero automatico.

        Args:
            data: Campos validados pelo serializer.
            created_by_id: UUID do usuario que esta abrindo a OS.

        Returns:
            ServiceOrder recem-criada.
        """
        from apps.service_orders.models import ServiceOrder, ServiceOrderActivityLog

        payload = dict(data)
        payload["number"] = cls.get_next_number()
        payload["created_by_id"] = created_by_id
        # Atribuicao automatica de consultor para quem abriu
        if not payload.get("consultant_id"):
            payload["consultant_id"] = created_by_id
        # customer e UUID do UnifiedCustomer (schema public) -- nao mapeia para o FK inteiro de Person.
        # Persiste como customer_uuid (UUIDField) e remove da chave FK para nao quebrar o INSERT.
        customer_uuid = payload.pop("customer", None)
        if customer_uuid is not None:
            payload["customer_uuid"] = customer_uuid

        # customer_id e FK inteira de Person (fluxo CreateOSForm) -- ja mapeada como customer_id no payload.
        # Auto-popula customer_name a partir do nome da Person quando nao enviado pelo frontend.
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
        Atualiza OS e processa transicoes automaticas de status.

        Regra: maximo 1 transicao por update. Se multiplos campos de data
        forem preenchidos de uma vez, apenas o primeiro gatilho e processado.

        Args:
            order_id: UUID da OS.
            data: Campos a atualizar (validados pelo serializer).
            updated_by_id: UUID do usuario que esta atualizando.

        Returns:
            ServiceOrder atualizada.
        """
        from apps.service_orders.models import ServiceOrder, StatusTransitionLog, ServiceOrderActivityLog

        order = ServiceOrder.objects.select_for_update().get(id=order_id)

        # customer e UUID do UnifiedCustomer -- nao e FK de Person. Persiste como customer_uuid.
        data = dict(data)
        customer_uuid = data.pop("customer", None)
        if customer_uuid is not None:
            data["customer_uuid"] = customer_uuid

        # Detectar campos de data recem-preenchidos que disparam transicao
        triggered_transitions: list[tuple[str, str]] = []

        FIELD_LABELS: dict[str, str] = {
            # Veiculo
            "plate": "Placa", "make": "Marca", "model": "Modelo", "year": "Ano",
            "color": "Cor", "chassis": "Chassi", "fuel_type": "Combustivel",
            "fipe_value": "Valor FIPE", "mileage_in": "KM entrada", "mileage_out": "KM saida",
            "vehicle_version": "Versao do veiculo", "vehicle_location": "Localizacao do veiculo",
            # Cliente
            "customer_name": "Nome do cliente", "customer_uuid": "Cliente vinculado",
            "customer_type": "Tipo de cliente",
            # Datas / prazo
            "entry_date": "Data de entrada",
            "service_authorization_date": "Autorizacao do servico",
            "scheduling_date": "Agendamento",
            "authorization_date": "Data de autorizacao",
            "quotation_date": "Data do orcamento",
            "repair_days": "Dias de reparo",
            "estimated_delivery_date": "Previsao de entrega",
            "delivery_date": "Data de entrega",
            "final_survey_date": "Vistoria final",
            "client_delivery_date": "Entrega ao cliente",
            # Seguradora
            "insurer": "Seguradora", "insured_type": "Tipo de segurado",
            "deductible_amount": "Franquia", "casualty_number": "Numero do sinistro",
            "broker_name": "Corretor", "expert": "Perito",
            "expert_date": "Visita do perito", "survey_date": "Data da vistoria",
            "os_type": "Tipo de OS",
            # Geral
            "consultant_id": "Consultor", "notes": "Observacoes",
            "invoice_issued": "NF emitida", "nfe_key": "Chave NF-e", "nfse_number": "NFS-e",
        }

        # Grupos de campos -> activity_type separado no log
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

        # Aplicar todos os campos e rastrear diferencas por grupo
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

        # Criar um log por grupo que teve alteracoes
        if any(changes_by_group.values()) or other_changes:
            from apps.authentication.models import GlobalUser
            user = GlobalUser.objects.filter(id=updated_by_id).first()
            user_name = user.get_full_name() or user.email if user else "Usuario"

            GROUP_LABELS: dict[str, str] = {
                "customer_updated": "atualizou dados do cliente",
                "vehicle_updated": "atualizou dados do veiculo",
                "schedule_updated": "atualizou datas e prazos",
                "insurer_updated": "atualizou dados da seguradora",
                "updated": "atualizou informacoes da OS",
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

        # Aplicar transicao (maximo 1 por update)
        if triggered_transitions:
            field_trigger, new_status = triggered_transitions[0]
            old_status = order.status
            order.status = new_status
            logger.info(
                "OS #%d: auto-transition %s->%s via campo '%s'",
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

        # Calcular previsao de entrega automaticamente
        if order.entry_date and order.repair_days:
            entry = order.entry_date
            entry_date = entry.date() if hasattr(entry, "date") else entry
            order.estimated_delivery_date = entry_date + timedelta(days=order.repair_days)

        order.save()

        # -- Propagar dados do veiculo para outras OSes com a mesma placa --
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
        force: bool = False,
        override_id: str | None = None,
        justification: str = "",
    ) -> "ServiceOrder":
        """
        Executa transicao manual de status da OS com validacao de pre-requisitos.

        Args:
            order_id: UUID da OS.
            new_status: Status de destino.
            changed_by_id: UUID do usuario que esta executando a transicao.
            force: Se True, ignora soft blocks (requer MANAGER+).
            override_id: ID de um TransitionOverrideRequest aprovado.
            justification: Justificativa para force/cancelled.

        Raises:
            ValidationError: Se a transicao nao for permitida ou tiver hard blocks.

        Returns:
            ServiceOrder com status atualizado.
        """
        from apps.service_orders.models import (
            ServiceOrder,
            StatusTransitionLog,
            ServiceOrderActivityLog,
            TransitionOverrideRequest,
            VALID_TRANSITIONS,
        )
        from apps.service_orders.transition_validator import TransitionValidator

        order = ServiceOrder.objects.select_for_update().get(id=order_id)

        if new_status not in VALID_TRANSITIONS.get(order.status, []):
            raise ValidationError(
                {
                    "status": (
                        f"Transicao invalida: {order.status} -> {new_status}. "
                        f"Permitidas: {VALID_TRANSITIONS.get(order.status, [])}"
                    )
                }
            )

        # Validar pre-requisitos de negocio
        result = TransitionValidator.validate(
            order, new_status, justification=justification
        )

        # Hard blocks: SEMPRE bloqueiam
        if result.hard_blocks:
            raise ValidationError({
                "transition_blocks": {
                    "type": "hard",
                    "can_override": False,
                    "blocks": [b.to_dict() for b in result.hard_blocks],
                    "warnings": [w.to_dict() for w in result.warnings],
                }
            })

        # Soft blocks: bloqueiam exceto com force/override aprovado
        if result.soft_blocks:
            has_approved_override = False

            # Verificar override aprovado
            if override_id:
                has_approved_override = TransitionOverrideRequest.objects.filter(
                    id=override_id,
                    service_order=order,
                    to_status=new_status,
                    status="approved",
                ).exists()

            if not force and not has_approved_override:
                raise ValidationError({
                    "transition_blocks": {
                        "type": "soft",
                        "can_override": True,
                        "blocks": [b.to_dict() for b in result.soft_blocks],
                        "warnings": [w.to_dict() for w in result.warnings],
                        "has_pending_override": TransitionValidator._has_pending_override(
                            order, new_status
                        ),
                    }
                })

            # Se force=True sem override aprovado, criar registro de auditoria
            if force and not has_approved_override:
                from django.utils import timezone as tz
                TransitionOverrideRequest.objects.create(
                    service_order=order,
                    from_status=order.status,
                    to_status=new_status,
                    requested_by_id=changed_by_id,
                    approved_by_id=changed_by_id,
                    status="approved",
                    blocks_snapshot=[b.to_dict() for b in result.soft_blocks],
                    request_reason=justification or "Override presencial",
                    justification=justification or "Override presencial",
                    resolved_at=tz.now(),
                    expires_at=tz.now(),
                )

        old_status = order.status
        order.status = new_status

        from django.utils import timezone
        now = timezone.now()

        # Auto-preenchimento de datas chaves ao avancar no Kanban
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
        user = GlobalUser.objects.filter(id=changed_by_id).first()
        user_name = user.get_full_name() or user.email if user else "Usuario"
        from apps.service_orders.models import ServiceOrderStatus as SOS
        old_label = dict(SOS.choices).get(old_status, old_status)
        new_label = dict(SOS.choices).get(new_status, new_status)
        ServiceOrderActivityLog.objects.create(
            service_order=order,
            user_id=changed_by_id,
            activity_type="status_changed",
            description=f"{user_name} moveu a OS de '{old_label}' para '{new_label}'",
            metadata={
                "from_status": old_status,
                "to_status": new_status,
                "had_warnings": len(result.warnings) > 0,
                "was_forced": force,
            },
        )

        logger.info(
            "OS #%d: transicao manual %s->%s por user_id=%s (force=%s)",
            order.number,
            old_status,
            new_status,
            changed_by_id,
            force,
        )
        return order

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
        Muda status com validacao de transicao (nova API -- paralela ao transition()).
        Salva previous_status ao entrar em 'budget'. Loga ServiceOrderEvent.

        Raises:
            ValidationError: Transicao invalida.
        """
        from apps.service_orders.models import VALID_TRANSITIONS
        from apps.service_orders.events import OSEventLogger

        current = service_order.status
        allowed = VALID_TRANSITIONS.get(current, [])
        if new_status not in allowed:
            raise ValidationError({
                "status": (
                    f"Transicao invalida: {current} -> {new_status}. "
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
        Cria snapshot imutavel do estado atual do orcamento da OS.

        Args:
            order: Instancia da ServiceOrder.
            trigger: TriggerType (cilia_import, manual_save, delivery, part_change).
            created_by_id: UUID do usuario que disparou o snapshot.

        Returns:
            BudgetSnapshot criado.
        """
        from apps.service_orders.models import BudgetSnapshot, ServiceOrderPart, ServiceOrderLabor

        # Calcula proxima versao
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
        Adiciona peca a OS e recalcula totais.

        Args:
            order: Instancia da ServiceOrder.
            data: Dados validados da peca.
            created_by: Usuario que esta adicionando.

        Raises:
            ValidationError: Se a OS estiver encerrada (delivered/cancelled).

        Returns:
            ServiceOrderPart recem-criada.
        """
        from apps.service_orders.models import ServiceOrderPart, ServiceOrderStatus

        if order.status in (ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELLED):
            raise ValidationError(
                {"detail": "Nao e possivel modificar itens de uma OS encerrada."}
            )

        part = ServiceOrderPart(service_order=order, created_by=created_by, **data)
        part.save()

        from apps.service_orders.models import ServiceOrderActivityLog
        ServiceOrderActivityLog.objects.create(
            service_order=order,
            user_id=str(created_by.id),
            activity_type="part_added",
            description=f"Peca '{part.description}' adicionada (Qtd: {part.quantity} x R${part.unit_price})",
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
        Adiciona servico a OS e recalcula totais.

        Args:
            order: Instancia da ServiceOrder.
            data: Dados validados do servico.
            created_by: Usuario que esta adicionando.

        Raises:
            ValidationError: Se a OS estiver encerrada (delivered/cancelled).

        Returns:
            ServiceOrderLabor recem-criada.
        """
        from apps.service_orders.models import ServiceOrderLabor, ServiceOrderStatus

        if order.status in (ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELLED):
            raise ValidationError(
                {"detail": "Nao e possivel modificar itens de uma OS encerrada."}
            )

        labor = ServiceOrderLabor(service_order=order, created_by=created_by, **data)
        labor.save()

        from apps.service_orders.models import ServiceOrderActivityLog
        ServiceOrderActivityLog.objects.create(
            service_order=order,
            user_id=str(created_by.id),
            activity_type="labor_added",
            description=f"Servico '{labor.description}' adicionado (Qtd: {labor.quantity} x R${labor.unit_price})",
        )
        return labor
