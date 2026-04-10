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
    "entry_date":           (["reception"],              "initial_survey"),
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

        # Detectar campos de data recém-preenchidos que disparam transição
        triggered_transitions: list[tuple[str, str]] = []
        
        # Guardar modificações para log
        field_changes = []

        FIELD_LABELS: dict[str, str] = {
            "plate": "Placa", "make": "Marca", "model": "Modelo", "year": "Ano",
            "color": "Cor", "chassis": "Chassi", "fuel_type": "Combustível",
            "entry_date": "Data de entrada", "estimated_delivery_date": "Previsão de entrega",
            "repair_days": "Dias de reparo", "notes": "Observações",
            "consultant_id": "Consultor", "customer_name": "Cliente",
            "mileage_in": "KM entrada", "mileage_out": "KM saída",
            "casualty_number": "Número do sinistro", "broker_name": "Corretor",
            "authorization_date": "Data de autorização",
            "final_survey_date": "Vistoria final", "client_delivery_date": "Entrega ao cliente",
            "invoice_issued": "NF emitida", "nfe_key": "Chave NF-e", "nfse_number": "NFS-e",
        }

        for field, (valid_from, target) in AUTO_TRANSITIONS.items():
            old_value = getattr(order, field)
            new_value = data.get(field)
            if old_value is None and new_value is not None:
                if order.status in valid_from:
                    triggered_transitions.append((field, target))

        # Aplicar todos os campos e rastrear diferenças
        structured_changes: list[dict[str, Any]] = []
        desc_parts: list[str] = []
        for key, value in data.items():
            old_value = getattr(order, key)
            if old_value != value:
                label = FIELD_LABELS.get(key, key)
                structured_changes.append({
                    "field": key,
                    "field_label": label,
                    "old_value": str(old_value) if old_value is not None else None,
                    "new_value": str(value) if value is not None else None,
                })
                if old_value and value:
                    desc_parts.append(f"mudou {label} de '{old_value}' para '{value}'")
                elif value and not old_value:
                    desc_parts.append(f"definiu {label} como '{value}'")
                else:
                    desc_parts.append(f"removeu {label}")
            setattr(order, key, value)

        if structured_changes:
            from apps.authentication.models import GlobalUser
            user = GlobalUser.objects.filter(id=updated_by_id).first()
            user_name = user.get_full_name() or user.email if user else "Usuário"
            desc = (f"{user_name} " + ", ".join(desc_parts))[:5000]
            ServiceOrderActivityLog.objects.create(
                service_order=order,
                user_id=updated_by_id,
                activity_type="updated",
                description=desc,
                metadata={"field_changes": structured_changes},
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
            if not nfe_key and not nfse_number:
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

        logger.info(
            "OS #%d: entregue ao cliente por user_id=%s",
            order.number,
            delivered_by_id,
        )
        return order
