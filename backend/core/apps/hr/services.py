"""
Paddock Solutions — HR Services
Sprint 6: TimeClockService, AllowanceService, PayslipService.

Regras de negócio do RH — nunca nos ViewSets.
"""
import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Allowance,
    Bonus,
    Deduction,
    Employee,
    GoalTarget,
    Payslip,
    TimeClockEntry,
)

logger = logging.getLogger(__name__)


# ── TimeClockService ──────────────────────────────────────────────────────────

# Sequência válida de batidas de ponto por dia
_VALID_NEXT: dict[str | None, list[str]] = {
    None: ["clock_in"],
    "clock_in": ["break_start", "clock_out"],
    "break_start": ["break_end"],
    "break_end": ["break_start", "clock_out"],
    "clock_out": ["clock_in"],
}


class TimeClockService:
    """Regras de negócio de ponto — nunca no ViewSet."""

    @classmethod
    @transaction.atomic
    def register_clock(
        cls,
        employee_id: str,
        entry_type: str,
        source: str = TimeClockEntry.Source.SYSTEM,
        ip_address: str | None = None,
        device_info: str = "",
        justification: str = "",
    ) -> TimeClockEntry:
        """
        Registra batida de ponto com validação de sequência.

        Raises:
            serializers.ValidationError: se a sequência for inválida,
                se source=biometric (bloqueado), ou se manual sem justificativa.
        """
        if source == TimeClockEntry.Source.BIOMETRIC:
            raise serializers.ValidationError(
                {
                    "source": (
                        "Integração com relógio de ponto físico ainda não disponível. "
                        "Use source='system' ou 'mobile'."
                    )
                }
            )

        if source == TimeClockEntry.Source.MANUAL and not justification:
            raise serializers.ValidationError(
                {"justification": "Ajuste manual exige justificativa."}
            )

        employee = Employee.objects.select_for_update().get(
            id=employee_id, status=Employee.Status.ACTIVE
        )

        now = timezone.now()
        last_entry = (
            TimeClockEntry.objects.filter(
                employee=employee, timestamp__date=now.date()
            )
            .order_by("-timestamp")
            .first()
        )

        cls._validate_sequence(last_entry, entry_type)

        entry = TimeClockEntry.objects.create(
            employee=employee,
            entry_type=entry_type,
            timestamp=now,
            source=source,
            ip_address=ip_address,
            device_info=device_info,
            justification=justification,
            is_approved=(source != TimeClockEntry.Source.MANUAL),
        )
        logger.info(
            "Clock %s registered for employee %s (source=%s)",
            entry_type,
            employee_id,
            source,
        )
        return entry

    @staticmethod
    def _validate_sequence(
        last: TimeClockEntry | None, new_type: str
    ) -> None:
        """Valida que a nova batida é permitida dado o último registro do dia."""
        last_type = last.entry_type if last else None
        allowed = _VALID_NEXT.get(last_type, [])
        if new_type not in allowed:
            raise serializers.ValidationError(
                {
                    "entry_type": (
                        f"Após '{last_type or 'nenhum registro'}', "
                        f"apenas {allowed} são permitidos. "
                        f"Recebido: '{new_type}'."
                    )
                }
            )

    @classmethod
    def approve_entry(
        cls, entry_id: str, approved_by_id: str
    ) -> TimeClockEntry:
        """Aprova ajuste manual de ponto."""
        entry = TimeClockEntry.objects.select_for_update().get(id=entry_id)
        if entry.source != TimeClockEntry.Source.MANUAL:
            raise serializers.ValidationError(
                {"detail": "Apenas ajustes manuais precisam de aprovação."}
            )
        if entry.is_approved:
            raise serializers.ValidationError(
                {"detail": "Registro já aprovado."}
            )
        entry.is_approved = True
        entry.approved_by_id = approved_by_id
        entry.approved_at = timezone.now()
        entry.save(update_fields=["is_approved", "approved_by", "approved_at", "updated_at"])
        return entry

    @classmethod
    def get_daily_summary(
        cls, employee_id: str, day: date
    ) -> dict[str, Any]:
        """Retorna espelho do dia: entradas, total horas, status."""
        entries = list(
            TimeClockEntry.objects.filter(
                employee_id=employee_id,
                timestamp__date=day,
                is_approved=True,
            ).order_by("timestamp")
        )
        total_minutes = cls._calculate_worked_minutes(entries)
        return {
            "date": day.isoformat(),
            "entries": [
                {
                    "id": str(e.id),
                    "type": e.entry_type,
                    "timestamp": e.timestamp.isoformat(),
                    "source": e.source,
                }
                for e in entries
            ],
            "total_hours": round(total_minutes / 60, 2),
            "total_minutes": total_minutes,
        }

    @staticmethod
    def _calculate_worked_minutes(entries: list[TimeClockEntry]) -> int:
        """Calcula minutos trabalhados a partir das batidas aprovadas do dia."""
        total = 0
        clock_in_time = None
        on_break = False
        break_start_time = None

        for entry in entries:
            if entry.entry_type == TimeClockEntry.EntryType.CLOCK_IN:
                clock_in_time = entry.timestamp
                on_break = False
            elif entry.entry_type == TimeClockEntry.EntryType.BREAK_START:
                if clock_in_time:
                    total += int((entry.timestamp - clock_in_time).total_seconds() // 60)
                    clock_in_time = None
                break_start_time = entry.timestamp
                on_break = True
            elif entry.entry_type == TimeClockEntry.EntryType.BREAK_END:
                clock_in_time = entry.timestamp
                on_break = False
                break_start_time = None
            elif entry.entry_type == TimeClockEntry.EntryType.CLOCK_OUT:
                if clock_in_time:
                    total += int((entry.timestamp - clock_in_time).total_seconds() // 60)
                    clock_in_time = None

        return total


# ── AllowanceService ──────────────────────────────────────────────────────────


class AllowanceService:
    """Fluxo de vale: Solicitação → Aprovação → Pagamento → Recibo."""

    @classmethod
    @transaction.atomic
    def request_allowance(
        cls,
        employee_id: str,
        allowance_type: str,
        amount: Decimal,
        reference_month: date,
        is_recurring: bool = True,
    ) -> Allowance:
        """Colaborador ou automação solicita vale."""
        allowance = Allowance.objects.create(
            employee_id=employee_id,
            allowance_type=allowance_type,
            amount=amount,
            reference_month=reference_month,
            status=Allowance.AllowanceStatus.REQUESTED,
            is_recurring=is_recurring,
        )
        logger.info(
            "Allowance %s requested for employee %s", allowance_type, employee_id
        )
        return allowance

    @classmethod
    @transaction.atomic
    def approve_allowance(
        cls, allowance_id: str, approved_by_id: str
    ) -> Allowance:
        """Gestor aprova solicitação de vale."""
        allowance = Allowance.objects.select_for_update().get(id=allowance_id)
        if allowance.status != Allowance.AllowanceStatus.REQUESTED:
            raise serializers.ValidationError(
                {"detail": "Apenas solicitações no status 'solicitado' podem ser aprovadas."}
            )
        allowance.status = Allowance.AllowanceStatus.APPROVED
        allowance.approved_by_id = approved_by_id
        allowance.approved_at = timezone.now()
        allowance.save(
            update_fields=["status", "approved_by", "approved_at", "updated_at"]
        )
        logger.info("Allowance %s approved by %s", allowance_id, approved_by_id)
        return allowance

    @classmethod
    @transaction.atomic
    def mark_as_paid(
        cls,
        allowance_id: str,
        receipt_file_key: str = "",
        paid_by_id: str | None = None,
    ) -> Allowance:
        """Marca vale como pago, vincula recibo e gera lancamento contabil."""
        allowance = Allowance.objects.select_for_update().get(id=allowance_id)
        if allowance.status != Allowance.AllowanceStatus.APPROVED:
            raise serializers.ValidationError(
                {"detail": "Vale precisa estar aprovado antes de ser pago."}
            )
        allowance.status = Allowance.AllowanceStatus.PAID
        allowance.paid_at = timezone.now()
        allowance.receipt_file_key = receipt_file_key
        allowance.save(
            update_fields=["status", "paid_at", "receipt_file_key", "updated_at"]
        )
        logger.info("Allowance %s marked as paid", allowance_id)

        # Gerar lançamento contábil automaticamente
        try:
            from apps.authentication.models import GlobalUser
            from apps.hr.accounting_service import HRAccountingService

            paid_by: GlobalUser | None = None
            if paid_by_id:
                try:
                    paid_by = GlobalUser.objects.get(id=paid_by_id)
                except GlobalUser.DoesNotExist:
                    pass

            HRAccountingService.post_allowance_payment(allowance, paid_by)
        except Exception as exc:
            logger.warning("Falha ao lancar vale %s na contabilidade: %s", allowance.id, exc)

        return allowance

    @classmethod
    def generate_recurring_allowances(
        cls, reference_month: date
    ) -> list[Allowance]:
        """
        Automação mensal: gera vales recorrentes para colaboradores ativos.

        Chamado pela Celery task no 1º dia útil do mês.
        """
        recurring = (
            Allowance.objects.filter(
                is_recurring=True,
                status=Allowance.AllowanceStatus.PAID,
                employee__status=Employee.Status.ACTIVE,
            )
            .values("employee_id", "allowance_type", "amount")
            .distinct()
        )

        created: list[Allowance] = []
        for item in recurring:
            exists = Allowance.objects.filter(
                employee_id=item["employee_id"],
                allowance_type=item["allowance_type"],
                reference_month=reference_month,
            ).exists()
            if not exists:
                allowance = Allowance.objects.create(
                    employee_id=item["employee_id"],
                    allowance_type=item["allowance_type"],
                    amount=item["amount"],
                    reference_month=reference_month,
                    status=Allowance.AllowanceStatus.REQUESTED,
                    is_recurring=True,
                )
                created.append(allowance)

        logger.info(
            "Generated %d recurring allowances for %s", len(created), reference_month
        )
        return created


# ── GoalService ───────────────────────────────────────────────────────────────


class GoalService:
    """Regras de negócio de metas — achieve gera Bonus automaticamente."""

    @classmethod
    @transaction.atomic
    def achieve_goal(cls, goal_id: str, created_by_id: str) -> GoalTarget:
        """
        Marca meta como atingida e gera Bonus automaticamente.

        Raises:
            serializers.ValidationError: se meta não estiver ativa ou não tiver employee.
        """
        goal = GoalTarget.objects.select_for_update().get(id=goal_id)
        if goal.status != GoalTarget.GoalStatus.ACTIVE:
            raise serializers.ValidationError(
                {"detail": f"Meta não está ativa (status atual: {goal.status})."}
            )
        if not goal.employee_id:
            raise serializers.ValidationError(
                {
                    "detail": (
                        "Metas de setor não geram bônus individual automaticamente. "
                        "Crie os bônus manualmente para cada colaborador do setor."
                    )
                }
            )

        goal.status = GoalTarget.GoalStatus.ACHIEVED
        goal.current_value = goal.target_value
        goal.save(update_fields=["status", "current_value", "updated_at"])

        # Gera bônus automaticamente se há valor configurado
        if goal.bonus_amount > 0:
            reference_month = date.today().replace(day=1)
            bonus = Bonus.objects.create(
                employee_id=goal.employee_id,
                bonus_type=Bonus.BonusType.GOAL,
                description=f"Meta atingida: {goal.title}",
                amount=goal.bonus_amount,
                reference_month=reference_month,
                created_by_id=created_by_id,
            )
            goal.linked_bonus = bonus
            goal.save(update_fields=["linked_bonus", "updated_at"])
            logger.info(
                "Goal %s achieved — bonus %s created (R$ %s)",
                goal_id,
                bonus.id,
                goal.bonus_amount,
            )

        return goal


# ── PayslipService ────────────────────────────────────────────────────────────


class PayslipService:
    """Geração e fechamento de contracheque mensal."""

    @classmethod
    def _thirteenth_proportional_months(cls, employee: Employee, year: int) -> int:
        """Calcula meses proporcionais para 13º salário.

        Regra CLT: mínimo 15 dias trabalhados no mês conta como mês cheio.
        """
        hire = employee.hire_date
        # Início da contagem no ano
        start_month = hire.month if hire.year == year else 1
        # Fim: mês atual ou 12
        end_month = 12
        if employee.termination_date and employee.termination_date.year == year:
            end_month = employee.termination_date.month

        months = 0
        for m in range(start_month, end_month + 1):
            if hire.year == year and m == hire.month:
                # Mês da admissão — conta se trabalhou >= 15 dias
                days_in_month = 30  # simplificação CLT
                if (days_in_month - hire.day + 1) >= 15:
                    months += 1
            else:
                months += 1
        return months

    @classmethod
    @transaction.atomic
    def generate_payslip(
        cls,
        employee_id: str,
        reference_month: date,
        payslip_type: str = "regular",
    ) -> Payslip:
        """
        Calcula contracheque: salário + bônus + vales + HE - descontos = líquido.

        Suporta tipos: regular, thirteenth_first, thirteenth_second, thirteenth_full.
        Colaboradores PJ não geram contracheque — levanta erro.

        Se já existir contracheque aberto para o mês/tipo, atualiza os valores.
        Contracheques fechados são imutáveis — levanta erro.
        """
        employee = Employee.objects.get(id=employee_id)

        # Bloquear PJ
        if employee.contract_type == "pj":
            raise serializers.ValidationError(
                {"detail": "Colaboradores PJ não geram contracheque. Use pagamento PJ."}
            )

        month_start = reference_month.replace(day=1)
        if month_start.month == 12:
            month_end = month_start.replace(year=month_start.year + 1, month=1)
        else:
            month_end = month_start.replace(month=month_start.month + 1)

        # Verificar se já existe contracheque fechado para este tipo
        existing = Payslip.objects.filter(
            employee=employee, reference_month=month_start, payslip_type=payslip_type,
        ).first()
        if existing and existing.is_closed:
            raise serializers.ValidationError(
                {"detail": "Contracheque já fechado — imutável. Corrija no próximo mês."}
            )

        # Ponto aprovado do mês
        entries = list(
            TimeClockEntry.objects.filter(
                employee=employee,
                timestamp__gte=month_start,
                timestamp__lt=month_end,
                is_approved=True,
            ).order_by("timestamp")
        )
        worked = cls._calculate_worked_data(entries, employee)

        # Bonificações do mês
        bonuses = Bonus.objects.filter(
            employee=employee,
            reference_month=month_start,
            is_active=True,
        )
        bonus_total = sum(b.amount for b in bonuses)
        bonus_breakdown = [
            {
                "type": b.bonus_type,
                "description": b.description,
                "amount": float(b.amount),
            }
            for b in bonuses
        ]

        # Vales pagos do mês
        allowances = Allowance.objects.filter(
            employee=employee,
            reference_month=month_start,
            status=Allowance.AllowanceStatus.PAID,
            is_active=True,
        )
        allowance_total = sum(a.amount for a in allowances)
        allowance_breakdown = [
            {"type": a.allowance_type, "amount": float(a.amount)} for a in allowances
        ]

        # Descontos manuais do mês — suporta valores fixos (FIXED) e percentuais (PERCENTAGE)
        deductions = Deduction.objects.filter(
            employee=employee,
            reference_month=month_start,
            is_active=True,
        )
        manual_deduction_total = Decimal("0")
        manual_deduction_breakdown: list[dict] = []
        for d in deductions:
            if d.discount_type == "percentage" and d.rate:
                calc_amount = (employee.base_salary * d.rate / Decimal("100")).quantize(
                    Decimal("0.01")
                )
            else:
                calc_amount = d.amount or Decimal("0")
            manual_deduction_total += calc_amount
            manual_deduction_breakdown.append({
                "type": d.deduction_type,
                "description": d.description,
                "amount": float(calc_amount),
            })

        # ── 13º salário: cálculo proporcional ──────────────────────────────────
        from apps.hr.tax_calculator import calcular_impostos

        is_thirteenth = payslip_type in (
            "thirteenth_first", "thirteenth_second", "thirteenth_full"
        )

        if is_thirteenth:
            prop_months = cls._thirteenth_proportional_months(employee, month_start.year)
            thirteenth_base = (employee.base_salary * prop_months / Decimal("12")).quantize(
                Decimal("0.01")
            )

            if payslip_type == "thirteenth_first":
                # 1ª parcela: 50% sem descontos
                gross = (thirteenth_base * Decimal("0.5")).quantize(Decimal("0.01"))
                gross_total = gross
                inss = irrf = Decimal("0")
                deduction_breakdown = []
                manual_deduction_total = Decimal("0")
            elif payslip_type == "thirteenth_second":
                # 2ª parcela: 50% com INSS e IRRF sobre total do 13º
                gross = (thirteenth_base * Decimal("0.5")).quantize(Decimal("0.01"))
                tributos = calcular_impostos(
                    salario_bruto=thirteenth_base,
                    dependentes=getattr(employee, "dependents_count", 0),
                )
                inss = tributos["inss"]
                irrf = tributos["irrf"]
                gross_total = gross
                deduction_breakdown = [
                    {"type": "INSS", "description": "INSS sobre 13º integral", "amount": float(inss)},
                    {"type": "IRRF", "description": "IRRF sobre 13º integral", "amount": float(irrf)},
                ]
                deduction_breakdown = [d for d in deduction_breakdown if d["amount"] > 0]
                manual_deduction_total = Decimal("0")
            else:
                # Integral: total com descontos
                gross = thirteenth_base
                tributos = calcular_impostos(
                    salario_bruto=thirteenth_base,
                    dependentes=getattr(employee, "dependents_count", 0),
                )
                inss = tributos["inss"]
                irrf = tributos["irrf"]
                gross_total = gross
                deduction_breakdown = [
                    {"type": "INSS", "description": "INSS sobre 13º", "amount": float(inss)},
                    {"type": "IRRF", "description": "IRRF sobre 13º", "amount": float(irrf)},
                ]
                deduction_breakdown = [d for d in deduction_breakdown if d["amount"] > 0]
                manual_deduction_total = Decimal("0")

            # 13º não tem bônus, vales, HE nem ponto
            bonus_total = allowance_total = Decimal("0")
            bonus_breakdown = []
            allowance_breakdown = []
            worked = {"overtime_hours": 0, "overtime_value": 0, "days": 0,
                      "total_hours": 0, "absences": 0, "late_minutes": 0}
        else:
            # ── Folha regular ────────────────────────────────────────────────────
            # Base para cálculo de impostos: salário base + HE + bônus
            # Vales (refeição/transporte) não compõem base tributável pelo art. 458 CLT
            gross = (
                employee.base_salary
                + bonus_total
                + Decimal(str(worked["overtime_value"]))
            )
            gross_total = gross + allowance_total  # total bruto incluindo vales

            # Impostos automáticos (tabela progressiva 2024/2025)
            tributos = calcular_impostos(
                salario_bruto=gross,
                dependentes=getattr(employee, "dependents_count", 0),
            )
            inss = tributos["inss"]
            irrf = tributos["irrf"]

            # Breakdown completo de descontos
            deduction_breakdown = [
                {"type": "INSS", "description": "INSS (tabela progressiva 2024)",
                 "amount": float(inss)},
                {"type": "IRRF", "description": "IRRF retido na fonte",
                 "amount": float(irrf)},
                *manual_deduction_breakdown,
            ]
            # Remove IRRF da lista se for zero (isenção)
            deduction_breakdown = [d for d in deduction_breakdown if d["amount"] > 0]

        deduction_total = inss + irrf + manual_deduction_total
        net = gross_total - deduction_total

        payslip, _ = Payslip.objects.update_or_create(
            employee=employee,
            reference_month=month_start,
            payslip_type=payslip_type,
            defaults={
                "base_salary": employee.base_salary,
                "total_bonuses": bonus_total,
                "total_allowances": allowance_total,
                "total_overtime_hours": worked["overtime_hours"],
                "total_overtime_value": worked["overtime_value"],
                "total_deductions": deduction_total,
                "gross_pay": gross,
                "net_pay": net,
                "worked_days": worked["days"],
                "worked_hours": worked["total_hours"],
                "total_absences": worked["absences"],
                "total_late_minutes": worked["late_minutes"],
                "bonus_breakdown": bonus_breakdown,
                "allowance_breakdown": allowance_breakdown,
                "deduction_breakdown": deduction_breakdown,
            },
        )
        logger.info(
            "Payslip generated: employee=%s ref=%s net=%s",
            employee_id,
            month_start,
            net,
        )
        return payslip

    @classmethod
    @transaction.atomic
    def close_payslip(cls, payslip_id: str, closed_by_id: str) -> Payslip:
        """
        Fecha contracheque — snapshot imutável + dispara geração de PDF.

        Após fechamento, nenhum campo pode ser alterado.
        Correções apenas via lançamento compensatório no mês seguinte.
        """
        payslip = Payslip.objects.select_for_update().get(id=payslip_id)
        if payslip.is_closed:
            raise serializers.ValidationError(
                {"detail": "Contracheque já está fechado."}
            )

        payslip.is_closed = True
        payslip.closed_at = timezone.now()
        payslip.closed_by_id = closed_by_id
        payslip.save(
            update_fields=["is_closed", "closed_at", "closed_by", "updated_at"]
        )

        # Gerar lançamento contábil automaticamente
        try:
            from apps.authentication.models import GlobalUser
            from apps.hr.accounting_service import HRAccountingService

            closed_by: GlobalUser | None = None
            if closed_by_id:
                try:
                    closed_by = GlobalUser.objects.get(id=closed_by_id)
                except GlobalUser.DoesNotExist:
                    pass

            HRAccountingService.post_payslip(payslip, closed_by)
        except Exception as exc:
            logger.warning(
                "Falha ao gerar lancamento contabil para payslip %s: %s",
                payslip.id,
                exc,
            )
            # Nao relanca — fechamento da folha nao pode falhar por causa da contabilidade

        # Criar titulo a pagar para o salario liquido (Contas a Pagar)
        try:
            from apps.authentication.models import GlobalUser as _GlobalUser
            from apps.accounts_payable.models import Supplier
            from apps.accounts_payable.services import PayableDocumentService

            _ap_user: _GlobalUser | None = None
            if closed_by_id:
                try:
                    _ap_user = _GlobalUser.objects.get(id=closed_by_id)
                except _GlobalUser.DoesNotExist:
                    pass

            supplier, _ = Supplier.objects.get_or_create(
                name="Colaboradores DS Car",
                defaults={"notes": "Fornecedor interno para folha de pagamento"},
            )
            ref = payslip.reference_month
            if ref.month < 12:
                pay_due = ref.replace(day=5, month=ref.month + 1)
            else:
                pay_due = ref.replace(year=ref.year + 1, month=1, day=5)
            PayableDocumentService.create_payable(
                supplier_id=str(supplier.id),
                description=(
                    f"Salario {ref.strftime('%m/%Y')} — {payslip.employee}"
                ),
                amount=payslip.net_pay,
                due_date=pay_due,
                competence_date=ref,
                origin="FOLHA",
                user=_ap_user,
            )
        except Exception as exc:
            logger.warning(
                "Falha ao criar titulo AP para payslip %s: %s", payslip.id, exc
            )

        # Disparar geração assíncrona do PDF
        try:
            from .tasks import task_generate_payslip_pdf
            task_generate_payslip_pdf.delay(str(payslip_id))
        except Exception:
            logger.warning("Could not dispatch PDF task for payslip %s", payslip_id)

        logger.info(
            "Payslip closed: %s employee=%s ref=%s net=%s",
            payslip_id,
            payslip.employee_id,
            payslip.reference_month,
            payslip.net_pay,
        )
        return payslip

    @staticmethod
    def _calculate_worked_data(
        entries: list[TimeClockEntry], employee: Employee
    ) -> dict[str, Any]:
        """Agrega dados de ponto do mês: dias, horas, overtime, faltas, atrasos."""
        from collections import defaultdict

        days_entries: dict[date, list[TimeClockEntry]] = defaultdict(list)
        for entry in entries:
            days_entries[entry.timestamp.date()].append(entry)

        total_minutes = 0
        overtime_minutes = 0
        absences = 0
        late_minutes = 0

        # Meta diária: 8h (480min) para dias úteis, 4h (240min) para sábado
        DAILY_TARGET_WEEKDAY = 480
        DAILY_TARGET_SATURDAY = 240

        for day, day_entries in days_entries.items():
            worked = TimeClockService._calculate_worked_minutes(day_entries)
            total_minutes += worked

            target = DAILY_TARGET_SATURDAY if day.weekday() == 5 else DAILY_TARGET_WEEKDAY
            if worked > target:
                overtime_minutes += worked - target

            # Atraso: entrada após 08:05 (tolerância 5min)
            clock_in = next(
                (e for e in day_entries if e.entry_type == TimeClockEntry.EntryType.CLOCK_IN),
                None,
            )
            if clock_in:
                scheduled_in = clock_in.timestamp.replace(
                    hour=8, minute=0, second=0, microsecond=0
                )
                tolerance = 5 * 60  # 5 minutos em segundos
                delta = (clock_in.timestamp - scheduled_in).total_seconds()
                if delta > tolerance:
                    late_minutes += int(delta // 60)

        total_hours = round(total_minutes / 60, 2)
        overtime_hours = round(overtime_minutes / 60, 2)

        # Valor HE: 50% do valor hora para dias úteis
        hourly_rate = float(employee.base_salary) / (float(employee.weekly_hours) * 4.33)
        overtime_value = round(overtime_hours * hourly_rate * 1.5, 2)

        return {
            "days": len(days_entries),
            "total_hours": total_hours,
            "overtime_hours": overtime_hours,
            "overtime_value": overtime_value,
            "absences": absences,
            "late_minutes": late_minutes,
        }


def calculate_termination(employee: "Employee") -> dict:
    """Calcula ferias proporcionais e 13o proporcional na rescisao."""
    from dateutil.relativedelta import relativedelta

    today = employee.termination_date or date.today()
    hire = employee.hire_date
    salary = employee.base_salary
    result: dict = {}

    # -- Ferias proporcionais --
    period_start = hire
    while period_start + relativedelta(months=12) <= today:
        period_start = period_start + relativedelta(months=12)

    months_worked = 0
    cursor = period_start
    while cursor < today:
        next_month = cursor + relativedelta(months=1)
        days_in_period = min((next_month - cursor).days, (today - cursor).days)
        if days_in_period >= 15:
            months_worked += 1
        cursor = next_month

    if months_worked > 0:
        proportional_days = round(months_worked * 30 / 12)
        daily = salary / 30
        vacation_pay = (daily * proportional_days).quantize(Decimal("0.01"))
        one_third = (vacation_pay / 3).quantize(Decimal("0.01"))

        # Ferias vencidas (periodos completos nao gozados)
        from .models import Vacation

        vencidas_days = 0
        check_start = hire
        while check_start + relativedelta(months=12) <= today:
            used = Vacation.objects.filter(
                employee=employee,
                acquisition_start=check_start,
                status__in=["scheduled", "active", "completed"],
                is_active=True,
            ).values_list("days_taken", flat=True)
            remaining = 30 - sum(used)
            if remaining > 0:
                vencidas_days += remaining
            check_start = check_start + relativedelta(months=12)

        vencidas_pay = Decimal("0")
        vencidas_third = Decimal("0")
        if vencidas_days > 0:
            vencidas_pay = (daily * vencidas_days).quantize(Decimal("0.01"))
            vencidas_third = (vencidas_pay / 3).quantize(Decimal("0.01"))

        result["ferias_proporcionais"] = {
            "months_worked": months_worked,
            "days": proportional_days,
            "vacation_pay": float(vacation_pay),
            "one_third": float(one_third),
            "total": float(vacation_pay + one_third),
        }
        if vencidas_days > 0:
            result["ferias_vencidas"] = {
                "days": vencidas_days,
                "vacation_pay": float(vencidas_pay),
                "one_third": float(vencidas_third),
                "total": float(vencidas_pay + vencidas_third),
            }

    # -- 13o proporcional --
    prop_months = PayslipService._thirteenth_proportional_months(employee, today.year)
    if prop_months > 0:
        thirteenth = (salary * prop_months / Decimal("12")).quantize(Decimal("0.01"))

        from apps.hr.tax_calculator import calcular_impostos

        tributos = calcular_impostos(
            salario_bruto=thirteenth,
            dependentes=getattr(employee, "dependents_count", 0),
        )
        net_13 = thirteenth - tributos["inss"] - tributos["irrf"]

        result["decimo_terceiro_proporcional"] = {
            "months": prop_months,
            "gross": float(thirteenth),
            "inss": float(tributos["inss"]),
            "irrf": float(tributos["irrf"]),
            "net": float(net_13),
        }

    return result


def calculate_vacation(vacation: "Vacation") -> None:
    """Calcula ferias + 1/3 + abono + descontos e salva no registro."""
    from apps.hr.tax_calculator import calcular_impostos

    emp = vacation.employee
    salary = emp.base_salary
    daily = salary / 30

    vacation_pay = (daily * vacation.days_taken).quantize(Decimal("0.01"))
    one_third = (vacation_pay / 3).quantize(Decimal("0.01"))

    sold_pay = Decimal("0")
    if vacation.days_sold > 0:
        sold_base = (daily * vacation.days_sold).quantize(Decimal("0.01"))
        sold_third = (sold_base / 3).quantize(Decimal("0.01"))
        sold_pay = sold_base + sold_third

    taxable = vacation_pay + one_third
    tributos = calcular_impostos(
        salario_bruto=taxable,
        dependentes=getattr(emp, "dependents_count", 0),
    )
    deductions_total = tributos["inss"] + tributos["irrf"]

    total = vacation_pay + one_third + sold_pay
    net = total - deductions_total

    vacation.base_salary_snapshot = salary
    vacation.vacation_pay = vacation_pay
    vacation.one_third_pay = one_third
    vacation.sold_pay = sold_pay
    vacation.total_pay = total
    vacation.deductions = deductions_total
    vacation.net_pay = net
    vacation.save(update_fields=[
        "base_salary_snapshot", "vacation_pay", "one_third_pay",
        "sold_pay", "total_pay", "deductions", "net_pay", "updated_at",
    ])


# ── PDF de Contracheque ────────────────────────────────────────────────────────


def generate_payslip_pdf(payslip: "Payslip") -> bytes:
    """
    Renderiza o template HTML do contracheque e converte para PDF via WeasyPrint.

    Args:
        payslip: Instância de Payslip com employee.user pré-carregado via select_related.

    Returns:
        Bytes do PDF gerado.
    """
    from weasyprint import HTML  # type: ignore[import-untyped]

    from django.conf import settings
    from django.template.loader import render_to_string
    from django.utils import timezone

    context = {
        "payslip": payslip,
        "cnpj": getattr(settings, "DSCAR_CNPJ", ""),
        "issue_date": timezone.localdate().strftime("%d/%m/%Y"),
    }
    html_string = render_to_string("hr/payslip.html", context)
    return HTML(string=html_string).write_pdf()  # type: ignore[return-value]


def upload_payslip_to_s3(pdf_bytes: bytes, payslip: "Payslip") -> str:
    """
    Faz upload do PDF de contracheque para S3 com criptografia AES-256 (obrigatório — LGPD).

    Args:
        pdf_bytes: Bytes do PDF gerado.
        payslip: Instância de Payslip com employee pré-carregado.

    Returns:
        S3 key onde o PDF foi armazenado.
    """
    import boto3  # type: ignore[import-untyped]

    from django.conf import settings

    key = f"payslips/{payslip.employee.id}/{payslip.reference_month}.pdf"
    s3 = boto3.client("s3")
    s3.put_object(
        Bucket=settings.AWS_S3_BUCKET,
        Key=key,
        Body=pdf_bytes,
        ContentType="application/pdf",
        ServerSideEncryption="AES256",
    )
    logger.info("[HR] PDF de contracheque enviado para S3: %s", key)
    return key
