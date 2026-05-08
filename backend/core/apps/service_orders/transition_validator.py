"""
Paddock Solutions — OS Transition Validator

Valida pré-requisitos de negócio para transições de status das Ordens de Serviço.

3 níveis de severidade:
  - hard_blocks  : impedem a transição sem possibilidade de override
  - soft_blocks  : impedem a transição, mas MANAGER+ pode fazer override
  - warnings     : alertas informativos que não impedem a transição

Uso:
    result = TransitionValidator.validate(order, "budget")
    if not result.can_proceed:
        raise ValidationError(result.to_dict())

    # Pré-carregar no serializer de detalhe:
    requirements = TransitionValidator.validate_all_targets(order)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.service_orders.models import ServiceOrder

logger = logging.getLogger(__name__)


# ── Dataclasses ───────────────────────────────────────────────────────────────


@dataclass
class ValidationBlock:
    """Um bloqueio ou aviso individual de validação de transição.

    Attributes:
        code: Identificador da regra de negócio violada (ex: "PHOTOS_MIN_12").
        message: Mensagem legível descrevendo o bloqueio.
    """

    code: str
    message: str

    def to_dict(self) -> dict[str, str]:
        """Serializa para dict compatível com respostas DRF.

        Returns:
            Dict com campos 'code' e 'message'.
        """
        return {"code": self.code, "message": self.message}


@dataclass
class ValidationResult:
    """Resultado completo da validação de uma transição de status.

    Attributes:
        hard_blocks: Bloqueios impeditivos — sem override possível.
        soft_blocks: Bloqueios superáveis com override de MANAGER+.
        warnings: Avisos informativos — não impedem a transição.
        has_pending_override: True se há override pendente para esta transição.
    """

    hard_blocks: list[ValidationBlock] = field(default_factory=list)
    soft_blocks: list[ValidationBlock] = field(default_factory=list)
    warnings: list[ValidationBlock] = field(default_factory=list)
    has_pending_override: bool = False

    @property
    def can_proceed(self) -> bool:
        """True se não há hard blocks nem soft blocks pendentes.

        Returns:
            Booleano indicando se a transição pode ser executada diretamente.
        """
        return not self.hard_blocks and not self.soft_blocks

    def to_dict(self) -> dict:
        """Serializa para dict compatível com respostas DRF.

        Returns:
            Dict com campos can_proceed, hard_blocks, soft_blocks,
            warnings e has_pending_override.
        """
        return {
            "can_proceed": self.can_proceed,
            "hard_blocks": [b.to_dict() for b in self.hard_blocks],
            "soft_blocks": [b.to_dict() for b in self.soft_blocks],
            "warnings": [w.to_dict() for w in self.warnings],
            "has_pending_override": self.has_pending_override,
        }


# ── TransitionValidator ───────────────────────────────────────────────────────


class TransitionValidator:
    """Valida pré-requisitos de negócio para transições de status da OS.

    Classe de serviço pura — sem estado, sem model. Consulta os dados da OS
    via ORM e retorna ValidationResult.

    Todos os métodos são @classmethod para evitar instâncias desnecessárias.
    Importe e use diretamente:

        result = TransitionValidator.validate(order, "budget")
        all_results = TransitionValidator.validate_all_targets(order)
    """

    # ── Entrada principal ─────────────────────────────────────────────────────

    @classmethod
    def validate(
        cls,
        order: ServiceOrder,
        target_status: str,
        **kwargs,
    ) -> ValidationResult:
        """Valida pré-requisitos para a transição order.status → target_status.

        Args:
            order: Instância de ServiceOrder a ser validada.
            target_status: Status de destino desejado.
            **kwargs: Argumentos extras passados ao validador específico.
                justification (str): Justificativa para transição para 'cancelled'.

        Returns:
            ValidationResult com hard_blocks, soft_blocks, warnings e
            has_pending_override preenchidos.
        """
        method_name = f"_validate_to_{target_status}"
        validator = getattr(cls, method_name, None)
        if validator is None:
            logger.debug(
                "TransitionValidator: sem regras para target_status='%s', permitindo.",
                target_status,
            )
            return ValidationResult()

        if target_status == "cancelled":
            return validator(order, justification=kwargs.get("justification", ""))

        return validator(order)

    @classmethod
    def validate_all_targets(
        cls,
        order: ServiceOrder,
    ) -> dict[str, dict]:
        """Valida todos os status-alvo permitidos para a OS em seu estado atual.

        Usado pelo ServiceOrderDetailSerializer para pré-carregar o campo
        transition_requirements no GET da OS.

        Args:
            order: Instância de ServiceOrder.

        Returns:
            Dict mapeando cada status-alvo permitido ao seu ValidationResult
            serializado como dict.
        """
        from apps.service_orders.models import VALID_TRANSITIONS

        allowed: list[str] = VALID_TRANSITIONS.get(order.status, [])
        results: dict[str, dict] = {}

        for target in allowed:
            try:
                result = cls.validate(order, target)
                result.has_pending_override = cls._has_pending_override(order, target)
                results[target] = result.to_dict()
            except Exception as exc:
                logger.error(
                    "TransitionValidator: erro ao validar OS #%s → '%s': %s",
                    getattr(order, "number", "?"),
                    target,
                    exc,
                )
                # Retorna resultado neutro para não quebrar o GET
                results[target] = ValidationResult().to_dict()

        return results

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _count_photos(order: ServiceOrder, folders: list[str]) -> int:
        """Conta fotos ativas nas pastas especificadas.

        Args:
            order: Instância de ServiceOrder.
            folders: Lista de valores do campo ServiceOrderPhoto.folder.

        Returns:
            Número inteiro de fotos ativas nessas pastas.
        """
        return order.photos.filter(folder__in=folders, is_active=True).count()

    @staticmethod
    def _has_signature(order: ServiceOrder, doc_type: str) -> bool:
        """Verifica se existe assinatura do tipo especificado para a OS.

        Args:
            order: Instância de ServiceOrder.
            doc_type: Valor do campo Signature.document_type
                (ex: 'BUDGET_APPROVAL', 'OS_DELIVERY').

        Returns:
            True se existe pelo menos uma assinatura com esse document_type.
        """
        from apps.signatures.models import Signature

        return Signature.objects.filter(
            service_order=order,
            document_type=doc_type,
        ).exists()

    @staticmethod
    def _has_pending_override(order: ServiceOrder, target_status: str) -> bool:
        """Verifica se existe override pendente para esta transição específica.

        Args:
            order: Instância de ServiceOrder.
            target_status: Status de destino para o qual verificar o override.

        Returns:
            True se há um TransitionOverrideRequest com status='pending' para
            esta OS e target_status.
        """
        return order.override_requests.filter(
            to_status=target_status,
            status="pending",
        ).exists()

    @staticmethod
    def _has_checklist(order: ServiceOrder, checklist_type: str) -> bool:
        """Verifica se existe pelo menos 1 item de checklist do tipo especificado.

        Args:
            order: Instância de ServiceOrder.
            checklist_type: Valor do campo ChecklistItem.checklist_type
                ('entrada', 'acompanhamento' ou 'saida').

        Returns:
            True se existe pelo menos um ChecklistItem com esse checklist_type.
        """
        return order.checklist_items.filter(checklist_type=checklist_type).exists()

    @staticmethod
    def _sector_has_timesheet(order: ServiceOrder) -> bool:
        """Verifica se há ao menos um apontamento encerrado na OS.

        Usado para validar que o setor atual registrou horas antes de avançar.

        Args:
            order: Instância de ServiceOrder.

        Returns:
            True se existe ao menos um ApontamentoHoras com status='encerrado'.
        """
        return order.apontamentos.filter(status="encerrado").exists()

    @staticmethod
    def _all_timesheets_closed(order: ServiceOrder) -> bool:
        """Verifica se todos os apontamentos da OS estão encerrados ou validados.

        Uma OS sem apontamentos retorna True (sem bloqueio).

        Args:
            order: Instância de ServiceOrder.

        Returns:
            True se todos os ApontamentoHoras estão com status 'encerrado'
            ou 'validado', ou se não há apontamentos.
        """
        total = order.apontamentos.count()
        if total == 0:
            return True
        closed = order.apontamentos.filter(
            status__in=["encerrado", "validado"]
        ).count()
        return total == closed

    @staticmethod
    def _all_parts_received(order: ServiceOrder) -> bool:
        """Verifica se todas as peças ativas estão recebidas ou bloqueadas no estoque.

        Uma OS sem peças retorna True (sem bloqueio).

        Args:
            order: Instância de ServiceOrder.

        Returns:
            True se todas as ServiceOrderPart ativas têm status_peca em
            ('bloqueada', 'recebida'), ou se não há peças.
        """
        total = order.parts.filter(is_active=True).count()
        if total == 0:
            return True
        received = order.parts.filter(
            is_active=True,
            status_peca__in=["bloqueada", "recebida"],
        ).count()
        return total == received

    @staticmethod
    def _parts_purchased(order: ServiceOrder) -> list[str]:
        """Retorna descrições de peças de compra sem OC ou com status insuficiente.

        Uma peça de compra está "sourced" quando:
        - tem pedido_compra vinculado, E
        - status_peca em ('comprada', 'recebida', 'bloqueada')

        Args:
            order: Instância de ServiceOrder.

        Returns:
            Lista de strings descrevendo peças com problemas de sourcing.
            Lista vazia indica que todas as peças de compra estão devidamente
            associadas a pedidos de compra.
        """
        pending: list[str] = []
        for part in order.parts.filter(is_active=True, origem="compra"):
            if not part.pedido_compra_id:
                pending.append(f"{part.description} (sem pedido de compra)")
            elif part.status_peca not in ("comprada", "recebida", "bloqueada"):
                pending.append(
                    f"{part.description} (status: {part.get_status_peca_display()})"
                )
        return pending

    @staticmethod
    def _parts_incomplete(order: ServiceOrder) -> list[str]:
        """Retorna descrições de peças que ainda não foram recebidas ou bloqueadas.

        Args:
            order: Instância de ServiceOrder.

        Returns:
            Lista de strings com nome e status atual de peças pendentes.
            Lista vazia indica que todas as peças estão em estado terminal.
        """
        pending: list[str] = []
        for part in order.parts.filter(is_active=True).exclude(
            status_peca__in=["bloqueada", "recebida"]
        ):
            pending.append(
                f"{part.description} ({part.get_status_peca_display()})"
            )
        return pending

    @staticmethod
    def _has_nfce(order: ServiceOrder) -> bool:
        """Verifica se existe NFC-e autorizada vinculada diretamente à OS.

        Usa o relacionamento fiscal_documents (via FK ServiceOrder → FiscalDocument).
        Também verifica via reference_id legado como fallback.

        Args:
            order: Instância de ServiceOrder.

        Returns:
            True se há pelo menos uma FiscalDocument do tipo 'nfce' com
            status 'authorized' vinculada à OS.
        """
        # Verificação via FK direto (novo padrão 06C+)
        if order.fiscal_documents.filter(
            document_type="nfce", status="authorized"
        ).exists():
            return True

        # Fallback: referência legada via reference_id
        try:
            from apps.fiscal.models import FiscalDocument

            return FiscalDocument.objects.filter(
                reference_id=order.pk,
                reference_type="service_order",
                document_type="nfce",
                status="authorized",
            ).exists()
        except Exception as exc:
            logger.warning(
                "TransitionValidator._has_nfce: erro ao verificar via reference_id: %s",
                exc,
            )
            return False

    @staticmethod
    def _has_receivables(order: ServiceOrder) -> bool:
        """Verifica se existem contas a receber ativas geradas para esta OS.

        ReceivableDocument usa service_order_id (UUID, sem FK) para evitar
        joins cross-schema no multitenancy.

        Args:
            order: Instância de ServiceOrder.

        Returns:
            True se há pelo menos um ReceivableDocument ativo com
            service_order_id = order.pk.
        """
        try:
            from apps.accounts_receivable.models import ReceivableDocument

            return ReceivableDocument.objects.filter(
                service_order_id=order.pk,
                is_active=True,
            ).exists()
        except Exception as exc:
            logger.warning(
                "TransitionValidator._has_receivables: erro ao consultar: %s", exc
            )
            return False

    @staticmethod
    def _complement_all_billed(order: ServiceOrder) -> bool:
        """Verifica se todos os itens de complemento particular estão faturados.

        Uma OS sem complemento particular retorna True (sem bloqueio).
        Verifica tanto peças quanto serviços com source_type='complement'.

        Args:
            order: Instância de ServiceOrder.

        Returns:
            True se não há itens de complemento, ou se todos têm
            billing_status='billed'.
        """
        complement_parts = order.parts.filter(
            is_active=True, source_type="complement"
        )
        complement_labor = order.labor_items.filter(
            is_active=True, source_type="complement"
        )

        if not complement_parts.exists() and not complement_labor.exists():
            return True  # Sem complemento particular — sem bloqueio

        parts_ok = not complement_parts.exclude(billing_status="billed").exists()
        labor_ok = not complement_labor.exclude(billing_status="billed").exists()
        return parts_ok and labor_ok

    # ── Validators por transição ──────────────────────────────────────────────

    @classmethod
    def _validate_to_initial_survey(cls, order: ServiceOrder) -> ValidationResult:
        """Valida pré-requisitos para reception → initial_survey.

        Args:
            order: Instância de ServiceOrder.

        Returns:
            ValidationResult com:
              HARD: VEHICLE_BASIC_DATA, CUSTOMER_TYPE_SET, CUSTOMER_LINKED,
                    INSURER_DATA (se seguradora)
              WARN: VEHICLE_YEAR, VEHICLE_COLOR, FUEL_TYPE, MILEAGE_IN
        """
        hard: list[ValidationBlock] = []
        soft: list[ValidationBlock] = []
        warn: list[ValidationBlock] = []

        # HARD: dados básicos do veículo (placa, marca e modelo são obrigatórios)
        missing_vehicle: list[str] = []
        if not order.plate:
            missing_vehicle.append("placa")
        if not order.make:
            missing_vehicle.append("marca")
        if not order.model:
            missing_vehicle.append("modelo")
        if missing_vehicle:
            hard.append(
                ValidationBlock(
                    code="VEHICLE_BASIC_DATA",
                    message=f"Dados do veículo incompletos: falta {', '.join(missing_vehicle)}",
                )
            )

        # HARD: tipo de atendimento (seguradora ou particular)
        if not order.customer_type:
            hard.append(
                ValidationBlock(
                    code="CUSTOMER_TYPE_SET",
                    message="Tipo de atendimento não definido (seguradora ou particular)",
                )
            )

        # HARD: cliente vinculado (FK local ou UUID do cliente unificado)
        if not order.customer_id and not order.customer_uuid:
            hard.append(
                ValidationBlock(
                    code="CUSTOMER_LINKED",
                    message="Cliente não vinculado à OS",
                )
            )

        # HARD: dados de seguradora obrigatórios quando customer_type = 'insurer'
        if order.customer_type == "insurer":
            missing_insurer: list[str] = []
            if not order.insurer_id:
                missing_insurer.append("seguradora")
            if not order.insured_type:
                missing_insurer.append("tipo de segurado")
            if missing_insurer:
                hard.append(
                    ValidationBlock(
                        code="INSURER_DATA",
                        message=(
                            f"Dados de seguradora incompletos: "
                            f"falta {', '.join(missing_insurer)}"
                        ),
                    )
                )

        # WARN: campos opcionais que enriquecem o laudo
        if not order.year:
            warn.append(
                ValidationBlock(code="VEHICLE_YEAR", message="Ano do veículo não informado")
            )
        if not order.color:
            warn.append(
                ValidationBlock(code="VEHICLE_COLOR", message="Cor do veículo não informada")
            )
        if not order.fuel_type:
            warn.append(
                ValidationBlock(code="FUEL_TYPE", message="Combustível não informado")
            )
        if not order.mileage_in:
            warn.append(
                ValidationBlock(code="MILEAGE_IN", message="KM de entrada não informado")
            )

        return ValidationResult(hard_blocks=hard, soft_blocks=soft, warnings=warn)

    @classmethod
    def _validate_to_budget(cls, order: ServiceOrder) -> ValidationResult:
        """Valida pré-requisitos para initial_survey → budget.

        Args:
            order: Instância de ServiceOrder.

        Returns:
            ValidationResult com:
              SOFT: PHOTOS_MIN_12 (fotos de vistoria insuficientes)
              WARN: ENTRY_DATE_SET (data de entrada não preenchida)
        """
        hard: list[ValidationBlock] = []
        soft: list[ValidationBlock] = []
        warn: list[ValidationBlock] = []

        # SOFT: mínimo 12 fotos de vistoria (pasta vistoria_inicial ou checklist_entrada)
        photo_count = cls._count_photos(
            order, ["vistoria_inicial", "checklist_entrada"]
        )
        if photo_count < 12:
            soft.append(
                ValidationBlock(
                    code="PHOTOS_MIN_12",
                    message=(
                        f"Fotos de vistoria: {photo_count}/12 "
                        f"(faltam {12 - photo_count})"
                    ),
                )
            )

        # WARN: data de entrada do veículo
        if not order.entry_date:
            warn.append(
                ValidationBlock(
                    code="ENTRY_DATE_SET",
                    message="Data de entrada do veículo não preenchida",
                )
            )

        return ValidationResult(hard_blocks=hard, soft_blocks=soft, warnings=warn)

    @classmethod
    def _validate_to_waiting_auth(cls, order: ServiceOrder) -> ValidationResult:
        """Valida pré-requisitos para budget → waiting_auth (ou initial_survey → waiting_auth).

        Quando a OS vem de initial_survey, herda as validações de fotos e
        data de entrada do _validate_to_budget.

        Args:
            order: Instância de ServiceOrder.

        Returns:
            ValidationResult com:
              HARD: BUDGET_PDF_INSURER (se seguradora), BUDGET_ITEMS_PRIVATE (se particular)
              SOFT: PHOTOS_MIN_12 herdado (se vindo de initial_survey)
              WARN: CASUALTY_NUMBER (se seguradora), ENTRY_DATE_SET herdado
        """
        hard: list[ValidationBlock] = []
        soft: list[ValidationBlock] = []
        warn: list[ValidationBlock] = []

        # Herdar validação de fotos e data de entrada quando vindo de initial_survey
        if order.status == "initial_survey":
            budget_result = cls._validate_to_budget(order)
            soft.extend(budget_result.soft_blocks)
            warn.extend(budget_result.warnings)

        if order.customer_type == "insurer":
            # HARD: PDF do orçamento enviado à seguradora (pasta 'orcamentos')
            pdf_count = cls._count_photos(order, ["orcamentos"])
            if pdf_count == 0:
                hard.append(
                    ValidationBlock(
                        code="BUDGET_PDF_INSURER",
                        message="PDF do orçamento não enviado (pasta Orçamentos vazia)",
                    )
                )

            # WARN: número do sinistro
            if not order.casualty_number:
                warn.append(
                    ValidationBlock(
                        code="CASUALTY_NUMBER",
                        message="Número do sinistro não informado",
                    )
                )

        if order.customer_type == "private":
            # HARD: pelo menos 1 peça ou 1 serviço cadastrado
            has_parts = order.parts.filter(is_active=True).exists()
            has_labor = order.labor_items.filter(is_active=True).exists()
            if not has_parts and not has_labor:
                hard.append(
                    ValidationBlock(
                        code="BUDGET_ITEMS_PRIVATE",
                        message="Orçamento vazio — adicione pelo menos 1 peça ou 1 serviço",
                    )
                )

        return ValidationResult(hard_blocks=hard, soft_blocks=soft, warnings=warn)

    @classmethod
    def _validate_to_authorized(cls, order: ServiceOrder) -> ValidationResult:
        """Valida pré-requisitos para waiting_auth → authorized.

        Args:
            order: Instância de ServiceOrder.

        Returns:
            ValidationResult com:
              HARD: AUTH_DATE_SET, VERSION_AUTHORIZED (seguradora),
                    CASUALTY_NUMBER_REQUIRED (seguradora), DEDUCTIBLE_SET (segurado),
                    SIGNATURE_APPROVAL (particular)
        """
        hard: list[ValidationBlock] = []
        soft: list[ValidationBlock] = []
        warn: list[ValidationBlock] = []

        # HARD: data de autorização obrigatória para qualquer tipo
        if not order.authorization_date:
            hard.append(
                ValidationBlock(
                    code="AUTH_DATE_SET",
                    message="Data de autorização não preenchida",
                )
            )

        if order.customer_type == "insurer":
            # HARD: pelo menos uma versão da OS com status 'autorizado' ou 'approved'
            has_authorized_version = order.versions.filter(
                status__in=["autorizado", "approved"]
            ).exists()
            if not has_authorized_version:
                hard.append(
                    ValidationBlock(
                        code="VERSION_AUTHORIZED",
                        message="Nenhuma versão do orçamento foi autorizada pela seguradora",
                    )
                )

            # HARD: número do sinistro obrigatório para seguradora
            if not order.casualty_number:
                hard.append(
                    ValidationBlock(
                        code="CASUALTY_NUMBER_REQUIRED",
                        message="Número do sinistro não informado (obrigatório para seguradora)",
                    )
                )

            # HARD: valor da franquia quando insured_type = 'insured'
            if order.insured_type == "insured" and not order.deductible_amount:
                hard.append(
                    ValidationBlock(
                        code="DEDUCTIBLE_SET",
                        message="Valor da franquia não informado (obrigatório para segurado)",
                    )
                )

        if order.customer_type == "private":
            # HARD: assinatura de aprovação do orçamento pelo cliente
            if not cls._has_signature(order, "BUDGET_APPROVAL"):
                hard.append(
                    ValidationBlock(
                        code="SIGNATURE_APPROVAL",
                        message="Assinatura de aprovação do orçamento não capturada",
                    )
                )

        return ValidationResult(hard_blocks=hard, soft_blocks=soft, warnings=warn)

    @classmethod
    def _validate_to_waiting_parts(cls, order: ServiceOrder) -> ValidationResult:
        """Valida pré-requisitos para authorized → waiting_parts.

        Args:
            order: Instância de ServiceOrder.

        Returns:
            ValidationResult com:
              HARD: PARTS_EXIST (nenhuma peça cadastrada)
              SOFT: PARTS_SOURCED (peças sem OC ou status insuficiente)
        """
        hard: list[ValidationBlock] = []
        soft: list[ValidationBlock] = []
        warn: list[ValidationBlock] = []

        # HARD: pelo menos 1 peça cadastrada
        if not order.parts.filter(is_active=True).exists():
            hard.append(
                ValidationBlock(
                    code="PARTS_EXIST",
                    message="Nenhuma peça cadastrada na OS",
                )
            )

        # SOFT: peças de compra devem ter OC e status >= 'comprada'
        pending_parts = cls._parts_purchased(order)
        if pending_parts:
            soft.append(
                ValidationBlock(
                    code="PARTS_SOURCED",
                    message=(
                        f"Peças sem pedido de compra ou não compradas: "
                        f"{', '.join(pending_parts[:3])}"
                        f"{' e outras...' if len(pending_parts) > 3 else ''}"
                    ),
                )
            )

        return ValidationResult(hard_blocks=hard, soft_blocks=soft, warnings=warn)

    @classmethod
    def _validate_to_repair(cls, order: ServiceOrder) -> ValidationResult:
        """Valida pré-requisitos para authorized/waiting_parts → repair.

        O conjunto de regras varia conforme o status atual da OS:
        - Se vindo de 'authorized': valida existência de itens e avisa peças pendentes.
        - Se vindo de 'waiting_parts': valida compra de peças e recebimento.

        Args:
            order: Instância de ServiceOrder.

        Returns:
            ValidationResult com:
              HARD: PARTS_OR_LABOR_EXIST (se de 'authorized')
              SOFT: PARTS_PURCHASED (se de 'waiting_parts')
              WARN: PARTS_PENDING (peças com status pendente), PARTS_INCOMPLETE
        """
        hard: list[ValidationBlock] = []
        soft: list[ValidationBlock] = []
        warn: list[ValidationBlock] = []

        if order.status == "waiting_parts":
            # SOFT: peças de compra devem estar compradas antes de iniciar reparo
            pending_purchased = cls._parts_purchased(order)
            if pending_purchased:
                soft.append(
                    ValidationBlock(
                        code="PARTS_PURCHASED",
                        message=(
                            f"Peças pendentes de compra: "
                            f"{', '.join(pending_purchased[:3])}"
                            f"{' e outras...' if len(pending_purchased) > 3 else ''}"
                        ),
                    )
                )

            # WARN: peças não recebidas fisicamente
            incomplete = cls._parts_incomplete(order)
            if incomplete:
                warn.append(
                    ValidationBlock(
                        code="PARTS_INCOMPLETE",
                        message=(
                            f"Peças não recebidas fisicamente: "
                            f"{', '.join(incomplete[:3])}"
                            f"{' e outras...' if len(incomplete) > 3 else ''}"
                        ),
                    )
                )
        else:
            # Vindo de 'authorized' (ou outros): pelo menos 1 peça ou 1 serviço
            has_parts = order.parts.filter(is_active=True).exists()
            has_labor = order.labor_items.filter(is_active=True).exists()
            if not has_parts and not has_labor:
                hard.append(
                    ValidationBlock(
                        code="PARTS_OR_LABOR_EXIST",
                        message="Nenhuma peça ou serviço cadastrado na OS",
                    )
                )

            # WARN: peças com status pendente (cotação, aprovação, etc.)
            incomplete = cls._parts_incomplete(order)
            if incomplete:
                warn.append(
                    ValidationBlock(
                        code="PARTS_PENDING",
                        message=(
                            f"Peças com status pendente: "
                            f"{', '.join(incomplete[:3])}"
                            f"{' e outras...' if len(incomplete) > 3 else ''}"
                        ),
                    )
                )

        return ValidationResult(hard_blocks=hard, soft_blocks=soft, warnings=warn)

    @classmethod
    def _validate_workshop_transition(cls, order: ServiceOrder) -> ValidationResult:
        """Valida pré-requisitos para transições entre setores de oficina.

        Aplica-se a todas as transições entre:
        repair ↔ mechanic ↔ bodywork ↔ painting ↔ assembly ↔ polishing ↔ washing

        Args:
            order: Instância de ServiceOrder no setor atual.

        Returns:
            ValidationResult com:
              SOFT: TIMESHEET_CLOSED (sem apontamento encerrado no setor)
              SOFT: PROGRESS_PHOTO (sem foto de acompanhamento)
        """
        hard: list[ValidationBlock] = []
        soft: list[ValidationBlock] = []
        warn: list[ValidationBlock] = []

        # SOFT: apontamento de horas encerrado no setor atual
        if not cls._sector_has_timesheet(order):
            soft.append(
                ValidationBlock(
                    code="TIMESHEET_CLOSED",
                    message=(
                        f"Apontamento de horas não encerrado "
                        f"no setor '{order.status}'"
                    ),
                )
            )

        # SOFT: foto de acompanhamento do setor atual
        photo_count = cls._count_photos(order, ["acompanhamento"])
        if photo_count == 0:
            soft.append(
                ValidationBlock(
                    code="PROGRESS_PHOTO",
                    message=(
                        f"Nenhuma foto de acompanhamento registrada "
                        f"no setor '{order.status}'"
                    ),
                )
            )

        return ValidationResult(hard_blocks=hard, soft_blocks=soft, warnings=warn)

    # Aliases — todos os setores de oficina compartilham o mesmo validador
    _validate_to_mechanic = _validate_workshop_transition
    _validate_to_bodywork = _validate_workshop_transition
    _validate_to_painting = _validate_workshop_transition
    _validate_to_assembly = _validate_workshop_transition
    _validate_to_polishing = _validate_workshop_transition
    _validate_to_washing = _validate_workshop_transition

    @classmethod
    def _validate_to_final_survey(cls, order: ServiceOrder) -> ValidationResult:
        """Valida pré-requisitos para washing → final_survey.

        Herda as regras de setor (timesheet + foto) e adiciona verificações
        de conclusão da fase de reparo.

        Args:
            order: Instância de ServiceOrder.

        Returns:
            ValidationResult com:
              HARD: ALL_PARTS_RECEIVED (peças não recebidas), ALL_TIMESHEETS_CLOSED
              SOFT: TIMESHEET_CLOSED, PROGRESS_PHOTO (herdados do setor)
        """
        hard: list[ValidationBlock] = []
        soft: list[ValidationBlock] = []
        warn: list[ValidationBlock] = []

        # Herdar regras de setor de oficina
        workshop_result = cls._validate_workshop_transition(order)
        soft.extend(workshop_result.soft_blocks)

        # HARD: todas as peças devem estar recebidas ou bloqueadas
        if not cls._all_parts_received(order):
            hard.append(
                ValidationBlock(
                    code="ALL_PARTS_RECEIVED",
                    message="Há peças que ainda não foram recebidas fisicamente",
                )
            )

        # HARD: todos os apontamentos de todos os setores devem estar encerrados
        if not cls._all_timesheets_closed(order):
            hard.append(
                ValidationBlock(
                    code="ALL_TIMESHEETS_CLOSED",
                    message=(
                        "Há apontamentos de horas não encerrados "
                        "em setores anteriores"
                    ),
                )
            )

        return ValidationResult(hard_blocks=hard, soft_blocks=soft, warnings=warn)

    @classmethod
    def _validate_to_ready(cls, order: ServiceOrder) -> ValidationResult:
        """Valida pré-requisitos para final_survey → ready.

        Args:
            order: Instância de ServiceOrder.

        Returns:
            ValidationResult com:
              SOFT: FINAL_PHOTOS_12 (fotos da vistoria final insuficientes)
              SOFT: EXIT_CHECKLIST (checklist de saída não preenchido)
        """
        hard: list[ValidationBlock] = []
        soft: list[ValidationBlock] = []
        warn: list[ValidationBlock] = []

        # SOFT: mínimo 12 fotos de vistoria final
        final_photo_count = cls._count_photos(order, ["vistoria_final"])
        if final_photo_count < 12:
            soft.append(
                ValidationBlock(
                    code="FINAL_PHOTOS_12",
                    message=(
                        f"Fotos de vistoria final: {final_photo_count}/12 "
                        f"(faltam {12 - final_photo_count})"
                    ),
                )
            )

        # SOFT: checklist de saída preenchido
        if not cls._has_checklist(order, "saida"):
            soft.append(
                ValidationBlock(
                    code="EXIT_CHECKLIST",
                    message="Checklist de saída não preenchido",
                )
            )

        return ValidationResult(hard_blocks=hard, soft_blocks=soft, warnings=warn)

    @classmethod
    def _validate_to_delivered(cls, order: ServiceOrder) -> ValidationResult:
        """Valida pré-requisitos para ready → delivered.

        Esta é a transição mais restrita — garante que todas as obrigações
        fiscais, financeiras e operacionais foram cumpridas antes da entrega.

        Args:
            order: Instância de ServiceOrder.

        Returns:
            ValidationResult com:
              HARD: NFCE_ISSUED (particular sem NFC-e), CLIENT_SIGNATURE,
                    MILEAGE_OUT, RECEIVABLE_CREATED, COMPLEMENT_BILLED
        """
        hard: list[ValidationBlock] = []
        soft: list[ValidationBlock] = []
        warn: list[ValidationBlock] = []

        # HARD: NFC-e obrigatória para clientes particulares
        if order.customer_type == "private":
            if not cls._has_nfce(order):
                hard.append(
                    ValidationBlock(
                        code="NFCE_ISSUED",
                        message="NFC-e não emitida (obrigatório para cliente particular)",
                    )
                )

        # HARD: assinatura de entrega do cliente
        if not cls._has_signature(order, "OS_DELIVERY"):
            hard.append(
                ValidationBlock(
                    code="CLIENT_SIGNATURE",
                    message="Assinatura de entrega do veículo não capturada",
                )
            )

        # HARD: KM de saída obrigatório
        if not order.mileage_out:
            hard.append(
                ValidationBlock(
                    code="MILEAGE_OUT",
                    message="KM de saída não informado",
                )
            )

        # HARD: contas a receber devem estar geradas
        if not cls._has_receivables(order):
            hard.append(
                ValidationBlock(
                    code="RECEIVABLE_CREATED",
                    message="Contas a receber não geradas para esta OS",
                )
            )

        # HARD: itens de complemento particular devem estar faturados
        if not cls._complement_all_billed(order):
            hard.append(
                ValidationBlock(
                    code="COMPLEMENT_BILLED",
                    message="Há itens de complemento particular não faturados",
                )
            )

        return ValidationResult(hard_blocks=hard, soft_blocks=soft, warnings=warn)

    @classmethod
    def _validate_to_cancelled(
        cls,
        order: ServiceOrder,
        justification: str = "",
    ) -> ValidationResult:
        """Valida pré-requisitos para qualquer → cancelled.

        O cancelamento requer justificativa textual para fins de auditoria.

        Args:
            order: Instância de ServiceOrder.
            justification: Texto de justificativa fornecido pelo usuário.
                Obrigatório — sem ele a transição é bloqueada.

        Returns:
            ValidationResult com:
              HARD: CANCEL_JUSTIFICATION (justificativa ausente)
        """
        hard: list[ValidationBlock] = []

        if not justification or not justification.strip():
            hard.append(
                ValidationBlock(
                    code="CANCEL_JUSTIFICATION",
                    message="Justificativa obrigatória para cancelamento da OS",
                )
            )

        return ValidationResult(hard_blocks=hard)
