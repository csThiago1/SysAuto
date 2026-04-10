"""
Paddock Solutions — Accounting: Serviço de Lançamentos Contábeis

JournalEntryService — criação, aprovação e estorno de lançamentos.

Regra de ouro: sum(debit) == sum(credit) sempre.
Lançamentos aprovados são IMUTÁVEIS.
"""
import logging
from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.accounting.models.chart_of_accounts import ChartOfAccount
from apps.accounting.models.fiscal_period import FiscalPeriod
from apps.accounting.models.journal_entry import (
    JournalEntry,
    JournalEntryLine,
    JournalEntryOrigin,
)
from apps.authentication.models import GlobalUser

from .fiscal_period_service import FiscalPeriodService
from .number_service import NumberingService

logger = logging.getLogger(__name__)

# Codigos de contas padrao DS Car
_ACCOUNT_AR = "1.1.02.001"        # Clientes a Receber
_ACCOUNT_REVENUE_SVC = "4.1.02.001"  # Receita Bruta Servicos
_ACCOUNT_REVENUE_PARTS = "4.1.03.001"  # Receita Bruta Pecas
_ACCOUNT_CMV_PARTS = "5.1.01.001"  # CMV Pecas
_ACCOUNT_INVENTORY = "1.1.04.001"  # Estoque de Pecas


class JournalEntryService:
    """
    Servico principal de lancamentos contabeis.

    Regra de ouro: sum(debit) == sum(credit) sempre.
    Lancamentos automaticos sao aprovados automaticamente.
    """

    @classmethod
    @transaction.atomic
    def create_entry(
        cls,
        *,
        description: str,
        competence_date: date,
        origin: str,
        lines: list[dict],
        origin_object: models.Model | None = None,
        user: GlobalUser | None = None,
        auto_approve: bool = False,
    ) -> JournalEntry:
        """
        Cria lancamento contabil com validacao de balanceamento.

        Args:
            description: Descricao do lancamento.
            competence_date: Data de competencia.
            origin: Origem (JournalEntryOrigin choice).
            lines: Lista de dicts com campos da JournalEntryLine:
                   account_id, debit_amount, credit_amount,
                   cost_center_id (opcional), description (opcional).
            origin_object: Objeto de origem para GenericFK (opcional).
            user: Usuario criador (opcional).
            auto_approve: True para aprovar automaticamente (lancamentos do sistema).

        Returns:
            JournalEntry criado e salvo.

        Raises:
            ValidationError: Se debitos != creditos.
            ValidationError: Se o periodo fiscal estiver fechado.
            ValidationError: Se alguma conta nao for analitica.
        """
        # Obtém o período fiscal — lança ValidationError se fechado
        fiscal_period = cls._get_fiscal_period(competence_date)

        # Valida balanceamento e contas
        cls._validate_lines(lines)

        # Gera número sequencial thread-safe
        number = NumberingService.next("JE")

        # Resolve GenericFK se origin_object fornecido
        from django.contrib.contenttypes.models import ContentType

        content_type = None
        object_id = None
        if origin_object is not None:
            content_type = ContentType.objects.get_for_model(origin_object)
            object_id = origin_object.pk

        entry = JournalEntry.objects.create(
            number=number,
            description=description,
            competence_date=competence_date,
            origin=origin,
            fiscal_period=fiscal_period,
            content_type=content_type,
            object_id=object_id,
            created_by=user,
            is_approved=auto_approve,
            approved_by=user if auto_approve else None,
        )

        # Cria as linhas
        entry_lines: list[JournalEntryLine] = []
        for line_data in lines:
            line = JournalEntryLine(
                entry=entry,
                account_id=line_data["account_id"],
                debit_amount=Decimal(str(line_data.get("debit_amount", "0.00"))),
                credit_amount=Decimal(str(line_data.get("credit_amount", "0.00"))),
                cost_center_id=line_data.get("cost_center_id"),
                description=line_data.get("description", ""),
                document_number=line_data.get("document_number", ""),
            )
            entry_lines.append(line)

        JournalEntryLine.objects.bulk_create(entry_lines)

        logger.info(
            "JournalEntryService.create_entry: %s (%s) criado%s",
            number,
            origin,
            " e aprovado" if auto_approve else "",
        )
        return entry

    @classmethod
    @transaction.atomic
    def approve_entry(
        cls, entry: JournalEntry, user: GlobalUser
    ) -> JournalEntry:
        """
        Aprova lancamento manual.

        Valida balanceamento antes de aprovar.

        Args:
            entry: Lancamento a aprovar.
            user: Usuario que esta aprovando.

        Returns:
            JournalEntry aprovado.

        Raises:
            ValidationError: Se o lancamento ja estiver aprovado.
            ValidationError: Se o lancamento nao estiver balanceado.
        """
        if entry.is_approved:
            raise ValidationError(_("Lançamento já foi aprovado."))

        if not entry.is_balanced:
            raise ValidationError(
                _(
                    f"Lançamento não está balanceado. "
                    f"Débito: {entry.total_debit} / Crédito: {entry.total_credit}"
                )
            )

        entry.is_approved = True
        entry.approved_by = user
        entry.save(update_fields=["is_approved", "approved_by", "updated_at"])

        logger.info(
            "JournalEntryService.approve_entry: %s aprovado por %s",
            entry.number,
            user.get_full_name(),
        )
        return entry

    @classmethod
    @transaction.atomic
    def reverse_entry(
        cls,
        entry: JournalEntry,
        user: GlobalUser,
        description: str | None = None,
    ) -> JournalEntry:
        """
        Cria estorno do lancamento (linhas D/C invertidas).

        Marca entry.is_reversed=True e vincula reversal_entry.

        Args:
            entry: Lancamento a estornar.
            user: Usuario que esta estornando.
            description: Descricao do estorno (padrao: "Estorno de {number}").

        Returns:
            Novo JournalEntry de estorno.

        Raises:
            ValidationError: Se o lancamento ja foi estornado.
            ValidationError: Se o lancamento nao estiver aprovado.
        """
        if entry.is_reversed:
            raise ValidationError(
                _("Lançamento já foi estornado. Não é possível estornar duas vezes.")
            )
        if not entry.is_approved:
            raise ValidationError(
                _("Apenas lançamentos aprovados podem ser estornados.")
            )

        reversal_description = description or f"Estorno de {entry.number}: {entry.description}"
        reversal_date = timezone.now().date()
        fiscal_period = cls._get_fiscal_period(reversal_date)

        reversal_number = NumberingService.next("JE")

        from django.contrib.contenttypes.models import ContentType

        reversal_entry = JournalEntry.objects.create(
            number=reversal_number,
            description=reversal_description,
            competence_date=reversal_date,
            origin=entry.origin,
            fiscal_period=fiscal_period,
            created_by=user,
            is_approved=True,
            approved_by=user,
        )

        # Inverte D/C das linhas originais
        reversal_lines: list[JournalEntryLine] = []
        for original_line in entry.lines.select_related("account", "cost_center").all():
            reversal_lines.append(
                JournalEntryLine(
                    entry=reversal_entry,
                    account=original_line.account,
                    cost_center=original_line.cost_center,
                    debit_amount=original_line.credit_amount,
                    credit_amount=original_line.debit_amount,
                    description=original_line.description,
                    document_number=original_line.document_number,
                )
            )
        JournalEntryLine.objects.bulk_create(reversal_lines)

        # Marca o lancamento original como estornado
        entry.is_reversed = True
        entry.reversal_entry = reversal_entry
        entry.save(update_fields=["is_reversed", "reversal_entry", "updated_at"])

        logger.info(
            "JournalEntryService.reverse_entry: %s estornado por %s -> %s",
            entry.number,
            user.get_full_name(),
            reversal_number,
        )
        return reversal_entry

    @classmethod
    @transaction.atomic
    def create_from_service_order(
        cls, service_order: models.Model
    ) -> JournalEntry:
        """
        Gera lancamento ao fechar Ordem de Servico.

        Estrutura:
          D: Clientes a Receber (1.1.02.001)
          C: Receita Bruta Servicos (4.1.02.001) — pelo valor dos servicos
          C: Receita Bruta Pecas (4.1.03.001)  — pelo valor das pecas
          D: CMV Pecas (5.1.01.001)             — pelo custo das pecas (se houver)
          C: Estoque de Pecas (1.1.04.001)      — pelo custo das pecas (se houver)

        Args:
            service_order: Instancia de ServiceOrder com atributos:
                           total_amount, parts_amount, parts_cost,
                           service_amount, os_type, competence_date (ou closed_at).

        Returns:
            JournalEntry aprovado automaticamente.
        """
        # Extrai dados da OS de forma segura
        total_amount: Decimal = Decimal(str(getattr(service_order, "total_amount", "0.00")))
        parts_amount: Decimal = Decimal(str(getattr(service_order, "parts_amount", "0.00")))
        parts_cost: Decimal = Decimal(str(getattr(service_order, "parts_cost", "0.00")))
        service_amount: Decimal = total_amount - parts_amount
        os_type: str = getattr(service_order, "os_type", "")

        comp_date: date
        if hasattr(service_order, "closed_at") and service_order.closed_at:
            comp_date = service_order.closed_at.date()
        else:
            comp_date = timezone.now().date()

        # Busca contas — falha silencioso com log de erro se nao encontrar
        def _get_account(code: str) -> ChartOfAccount | None:
            account = ChartOfAccount.objects.filter(code=code, is_analytical=True).first()
            if not account:
                logger.error(
                    "JournalEntryService: conta %s nao encontrada no plano de contas", code
                )
            return account

        account_ar = _get_account(_ACCOUNT_AR)
        account_revenue_svc = _get_account(_ACCOUNT_REVENUE_SVC)
        account_revenue_parts = _get_account(_ACCOUNT_REVENUE_PARTS)
        account_cmv = _get_account(_ACCOUNT_CMV_PARTS)
        account_inventory = _get_account(_ACCOUNT_INVENTORY)

        if not account_ar or not account_revenue_svc:
            raise ValidationError(
                _(
                    "Contas contábeis padrão não configuradas. "
                    "Execute setup_chart_of_accounts antes de fechar OSs."
                )
            )

        # Busca centro de custo derivado do os_type
        from apps.accounting.models.chart_of_accounts import CostCenter

        cost_center = CostCenter.objects.filter(os_type_code=os_type, is_active=True).first()
        cost_center_id = str(cost_center.id) if cost_center else None

        lines: list[dict] = []

        # D: Clientes a Receber / C: Receita Total
        lines.append(
            {
                "account_id": str(account_ar.id),
                "debit_amount": total_amount,
                "credit_amount": Decimal("0.00"),
                "cost_center_id": cost_center_id,
                "description": f"OS {getattr(service_order, 'number', '')}",
            }
        )

        if service_amount > 0 and account_revenue_svc:
            lines.append(
                {
                    "account_id": str(account_revenue_svc.id),
                    "debit_amount": Decimal("0.00"),
                    "credit_amount": service_amount,
                    "cost_center_id": cost_center_id,
                    "description": f"OS {getattr(service_order, 'number', '')} — Serviços",
                }
            )

        if parts_amount > 0 and account_revenue_parts:
            lines.append(
                {
                    "account_id": str(account_revenue_parts.id),
                    "debit_amount": Decimal("0.00"),
                    "credit_amount": parts_amount,
                    "cost_center_id": cost_center_id,
                    "description": f"OS {getattr(service_order, 'number', '')} — Peças",
                }
            )

        # CMV de pecas
        if parts_cost > 0 and account_cmv and account_inventory:
            lines.append(
                {
                    "account_id": str(account_cmv.id),
                    "debit_amount": parts_cost,
                    "credit_amount": Decimal("0.00"),
                    "cost_center_id": cost_center_id,
                    "description": f"OS {getattr(service_order, 'number', '')} — CMV Peças",
                }
            )
            lines.append(
                {
                    "account_id": str(account_inventory.id),
                    "debit_amount": Decimal("0.00"),
                    "credit_amount": parts_cost,
                    "cost_center_id": cost_center_id,
                    "description": f"OS {getattr(service_order, 'number', '')} — Baixa Estoque",
                }
            )

        return cls.create_entry(
            description=f"OS {getattr(service_order, 'number', '')} — Fechamento",
            competence_date=comp_date,
            origin=JournalEntryOrigin.SERVICE_ORDER,
            lines=lines,
            origin_object=service_order,
            auto_approve=True,
        )

    @classmethod
    def _get_fiscal_period(cls, competence_date: date) -> FiscalPeriod:
        """
        Obtém o período fiscal para a data; lança ValidationError se fechado.

        Args:
            competence_date: Data de competencia do lancamento.

        Returns:
            FiscalPeriod correspondente.

        Raises:
            ValidationError: Se o período estiver fechado.
        """
        period = FiscalPeriodService.get_or_create_period(competence_date)
        if not period.can_post():
            raise ValidationError(
                _(
                    f"Período {period} está fechado. "
                    "Não é possível lançar neste período."
                )
            )
        return period

    @classmethod
    def _validate_lines(cls, lines: list[dict]) -> None:
        """
        Valida o conjunto de linhas do lancamento.

        Verifica:
        - Pelo menos uma linha fornecida.
        - Balanceamento: sum(debit) == sum(credit).
        - Cada conta existe e é analítica.
        - Nenhuma linha tem D e C ao mesmo tempo.
        - Nenhuma linha tem ambos os valores zerados.

        Args:
            lines: Lista de dicts das linhas do lancamento.

        Raises:
            ValidationError: Se qualquer validação falhar.
        """
        if not lines:
            raise ValidationError(_("O lançamento deve ter pelo menos uma linha."))

        total_debit = Decimal("0.00")
        total_credit = Decimal("0.00")

        for i, line_data in enumerate(lines, start=1):
            debit = Decimal(str(line_data.get("debit_amount", "0.00")))
            credit = Decimal(str(line_data.get("credit_amount", "0.00")))

            if debit > 0 and credit > 0:
                raise ValidationError(
                    _(f"Linha {i}: não pode ter débito e crédito simultaneamente.")
                )
            if debit == 0 and credit == 0:
                raise ValidationError(
                    _(f"Linha {i}: deve ter débito OU crédito com valor positivo.")
                )

            account_id = line_data.get("account_id")
            if not account_id:
                raise ValidationError(_(f"Linha {i}: account_id é obrigatório."))

            try:
                account = ChartOfAccount.objects.get(pk=account_id)
            except ChartOfAccount.DoesNotExist:
                raise ValidationError(
                    _(f"Linha {i}: conta {account_id} não encontrada.")
                )

            if not account.is_analytical:
                raise ValidationError(
                    _(
                        f"Linha {i}: conta '{account.code} — {account.name}' "
                        "não é analítica. Apenas contas analíticas aceitam lançamentos."
                    )
                )

            total_debit += debit
            total_credit += credit

        if total_debit != total_credit:
            raise ValidationError(
                _(
                    f"Lançamento não está balanceado. "
                    f"Débito total: {total_debit} / Crédito total: {total_credit}"
                )
            )
