"""
Paddock Solutions — HR Accounting Service

Ponte entre o modulo de RH e o modulo de Contabilidade.
Gera lancamentos contabeis automaticos para eventos de folha de pagamento.

Regra: NUNCA lancar excecao que quebre o fluxo HR — logar e retornar None.

Contas do plano DS Car utilizadas (todos ja existem no fixture):
  1.1.01.002  Banco Bradesco C/C                    (ativo — saida de caixa)
  1.1.05.002  Adiantamentos a Colaboradores          (ativo — adiantamentos)
  2.1.03.001  Salarios e Ordenados a Pagar           (passivo trabalhista)
  2.1.03.002  FGTS a Recolher                        (passivo trabalhista)
  2.1.03.003  INSS a Recolher                        (passivo trabalhista)
  2.1.03.006  IRRF a Recolher                        (passivo trabalhista — adicionado Sprint 13)
  6.1.01.001  Salarios e Ordenados (bruto)            (despesa pessoal)
  6.1.01.002  FGTS (despesa patronal)                 (despesa pessoal)
  6.1.01.003  INSS Patronal                           (despesa pessoal)
  6.1.01.006  Vales Alimentacao e Refeicao            (despesa pessoal)
  6.1.01.007  Vale Transporte                         (despesa pessoal)
  6.1.01.008  Bonificacoes e Comissoes                (despesa pessoal)
"""
import logging
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.accounting.models.journal_entry import JournalEntry
    from apps.authentication.models import GlobalUser
    from apps.hr.models import Allowance, Bonus, Payslip

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Mapeamento semantico → codigo do plano de contas DS Car
# Todos os codigos abaixo existem no fixture chart_of_accounts_dscar.py
# ---------------------------------------------------------------------------
HR_ACCOUNT_MAP: dict[str, str] = {
    # Despesas com pessoal
    "salary_gross":        "6.1.01.001",  # Salarios e Ordenados (bruto)
    "fgts_expense":        "6.1.01.002",  # FGTS (despesa patronal 8%)
    "inss_expense":        "6.1.01.003",  # INSS Patronal (despesa 20%)
    "allowance_meal":      "6.1.01.006",  # Vales Alimentacao e Refeicao
    "allowance_transport": "6.1.01.007",  # Vale Transporte
    "bonus":               "6.1.01.008",  # Bonificacoes e Comissoes
    # Passivos trabalhistas
    "payable_net":         "2.1.03.001",  # Salarios e Ordenados a Pagar
    "fgts_payable":        "2.1.03.002",  # FGTS a Recolher
    "inss_payable":        "2.1.03.003",  # INSS a Recolher (retencao colaborador)
    "irrf_payable":        "2.1.03.006",  # IRRF a Recolher
    # Ativos
    "advance":             "1.1.05.002",  # Adiantamentos a Colaboradores
    "bank":                "1.1.01.002",  # Banco Bradesco C/C (saida de caixa)
}

# Taxas patronais — constantes para calculo automatico
_FGTS_RATE = Decimal("0.08")    # 8% sobre salario bruto
_INSS_PATRONAL_RATE = Decimal("0.20")  # 20% sobre salario bruto (simplificado)


def _resolve_account(key: str) -> "object | None":
    """
    Resolve um codigo semantico para o objeto ChartOfAccount.

    Busca pelo codigo no plano de contas. Se nao encontrar, loga warning
    e retorna None — nunca levanta excecao para nao quebrar o fluxo HR.

    Args:
        key: Chave semantica do HR_ACCOUNT_MAP (ex: "salary_gross").

    Returns:
        Instancia de ChartOfAccount ou None se nao encontrada.
    """
    from apps.accounting.models.chart_of_accounts import ChartOfAccount

    code = HR_ACCOUNT_MAP.get(key)
    if not code:
        logger.warning(
            "HRAccountingService: chave semantica '%s' nao encontrada no HR_ACCOUNT_MAP",
            key,
        )
        return None

    try:
        return ChartOfAccount.objects.get(code=code, is_analytical=True)
    except ChartOfAccount.DoesNotExist:
        logger.warning(
            "HRAccountingService: conta '%s' (%s) nao encontrada no plano de contas. "
            "Execute setup_chart_of_accounts para popular o plano.",
            code,
            key,
        )
        return None


class HRAccountingService:
    """
    Servico de integracao entre RH e Contabilidade.

    Todos os metodos retornam JournalEntry ou None.
    Nunca lancam excecao — erros sao logados como warning.

    Responsabilidade do chamador: envolver em try/except para garantir que
    falhas contabeis nao interrompam o fluxo operacional de RH.
    """

    @classmethod
    def post_payslip(
        cls,
        payslip: "Payslip",
        user: "GlobalUser | None",
    ) -> "JournalEntry | None":
        """
        Gera lancamento contabil ao fechar uma folha de pagamento.

        Estrutura do lancamento (partidas dobradas):

        Debitos (despesas incorridas no mes):
          D 6.1.01.001  Salarios e Ordenados (bruto)
          D 6.1.01.002  FGTS (8% patronal)
          D 6.1.01.003  INSS Patronal (20%)
          D 6.1.01.008  Bonificacoes e Comissoes (se houver)

        Creditos (obrigacoes a pagar):
          C 6.1.01.002  FGTS a Recolher (8%)          — passivo 2.1.03.002
          C 2.1.03.003  INSS a Recolher (retencao)    — se houver no deduction_breakdown
          C 2.1.03.006  IRRF a Recolher               — se houver no deduction_breakdown
          C 2.1.03.001  Salarios e Ordenados a Pagar  — liquido (variavel de fechamento)

        Balanceamento: ajuste via payable_net para garantir Σdebitos == Σcreditos.

        Args:
            payslip: Instancia de Payslip fechado.
            user: Usuario que fechou a folha (propagado para created_by).

        Returns:
            JournalEntry aprovado automaticamente ou None em caso de erro.
        """
        from apps.accounting.models.journal_entry import JournalEntryOrigin
        from apps.accounting.services.journal_entry_service import JournalEntryService

        try:
            gross = Decimal(str(payslip.gross_pay))
            net = Decimal(str(payslip.net_pay))
            total_bonuses = Decimal(str(payslip.total_bonuses))

            fgts_amount = (gross * _FGTS_RATE).quantize(Decimal("0.01"))
            inss_patronal = (gross * _INSS_PATRONAL_RATE).quantize(Decimal("0.01"))

            # Extrair retencoes do deduction_breakdown (snapshot JSON)
            inss_retido = Decimal("0.00")
            irrf_retido = Decimal("0.00")
            for item in payslip.deduction_breakdown or []:
                dtype = item.get("type", "")
                amount = Decimal(str(item.get("amount", "0")))
                if dtype == "inss":
                    inss_retido += amount
                elif dtype == "irrf":
                    irrf_retido += amount

            # Resolver contas necessarias
            acc_salary_gross = _resolve_account("salary_gross")
            acc_fgts_expense = _resolve_account("fgts_expense")
            acc_inss_expense = _resolve_account("inss_expense")
            acc_bonus = _resolve_account("bonus") if total_bonuses > 0 else None
            acc_payable_net = _resolve_account("payable_net")
            acc_fgts_payable = _resolve_account("fgts_payable")
            acc_inss_payable = _resolve_account("inss_payable") if inss_retido > 0 else None
            acc_irrf_payable = _resolve_account("irrf_payable") if irrf_retido > 0 else None

            # Contas criticas — sem elas nao ha lancamento valido
            if not acc_salary_gross or not acc_payable_net or not acc_fgts_expense or not acc_fgts_payable:
                logger.warning(
                    "HRAccountingService.post_payslip: contas criticas nao encontradas "
                    "para payslip %s — lancamento nao gerado.",
                    payslip.id,
                )
                return None

            lines: list[dict] = []

            # ── Debitos ───────────────────────────────────────────────────────
            # D: Salarios Brutos
            lines.append({
                "account_id": str(acc_salary_gross.id),
                "debit_amount": str(gross),
                "credit_amount": "0.00",
                "description": f"Folha {payslip.reference_month} — salario bruto",
            })

            # D: Bonificacoes (se houver)
            if total_bonuses > 0 and acc_bonus:
                lines.append({
                    "account_id": str(acc_bonus.id),
                    "debit_amount": str(total_bonuses),
                    "credit_amount": "0.00",
                    "description": f"Folha {payslip.reference_month} — bonificacoes",
                })

            # D: FGTS patronal
            lines.append({
                "account_id": str(acc_fgts_expense.id),
                "debit_amount": str(fgts_amount),
                "credit_amount": "0.00",
                "description": f"Folha {payslip.reference_month} — FGTS patronal (8%)",
            })

            # D: INSS patronal (somente se conta disponivel)
            if acc_inss_expense := _resolve_account("inss_expense"):
                lines.append({
                    "account_id": str(acc_inss_expense.id),
                    "debit_amount": str(inss_patronal),
                    "credit_amount": "0.00",
                    "description": f"Folha {payslip.reference_month} — INSS patronal (20%)",
                })
            else:
                # Se nao tem conta de INSS patronal, absorve no salario bruto
                # para manter balanceamento (nao inclui linha)
                inss_patronal = Decimal("0.00")

            # ── Creditos ──────────────────────────────────────────────────────
            # C: FGTS a Recolher
            lines.append({
                "account_id": str(acc_fgts_payable.id),
                "debit_amount": "0.00",
                "credit_amount": str(fgts_amount),
                "description": f"Folha {payslip.reference_month} — FGTS a recolher",
            })

            # C: INSS retido (se houver)
            if inss_retido > 0 and acc_inss_payable:
                lines.append({
                    "account_id": str(acc_inss_payable.id),
                    "debit_amount": "0.00",
                    "credit_amount": str(inss_retido),
                    "description": f"Folha {payslip.reference_month} — INSS retido",
                })

            # C: IRRF retido (se houver)
            if irrf_retido > 0 and acc_irrf_payable:
                lines.append({
                    "account_id": str(acc_irrf_payable.id),
                    "debit_amount": "0.00",
                    "credit_amount": str(irrf_retido),
                    "description": f"Folha {payslip.reference_month} — IRRF retido",
                })

            # C: Salarios a Pagar — variavel de fechamento para balancear
            # total_debitos = gross + bonuses + fgts_patronal + inss_patronal
            # total_creditos_ate_aqui = fgts + inss_retido + irrf_retido
            # payable_liquido = total_debitos - total_creditos_ate_aqui
            total_debit = gross + (total_bonuses if (total_bonuses > 0 and acc_bonus) else Decimal("0.00")) + fgts_amount + inss_patronal
            total_credit_so_far = fgts_amount + inss_retido + irrf_retido
            payable_liquido = total_debit - total_credit_so_far

            if payable_liquido <= 0:
                logger.warning(
                    "HRAccountingService.post_payslip: payable_liquido <= 0 para payslip %s "
                    "(%s). Lancamento nao gerado — verifique as retencoes.",
                    payslip.id,
                    payable_liquido,
                )
                return None

            lines.append({
                "account_id": str(acc_payable_net.id),
                "debit_amount": "0.00",
                "credit_amount": str(payable_liquido),
                "description": f"Folha {payslip.reference_month} — salario liquido a pagar",
            })

            competence_date: date = payslip.reference_month.replace(day=1) if hasattr(payslip.reference_month, "replace") else payslip.reference_month

            entry = JournalEntryService.create_entry(
                description=(
                    f"Folha de Pagamento {payslip.reference_month} — "
                    f"{payslip.employee}"
                ),
                competence_date=competence_date,
                origin=JournalEntryOrigin.PAYROLL,
                lines=lines,
                origin_object=payslip,
                user=user,
                auto_approve=True,
            )

            logger.info(
                "HRAccountingService.post_payslip: lancamento %s gerado para payslip %s",
                entry.number,
                payslip.id,
            )
            return entry

        except Exception as exc:
            logger.warning(
                "HRAccountingService.post_payslip: erro ao gerar lancamento para payslip %s: %s",
                payslip.id,
                exc,
                exc_info=True,
            )
            return None

    @classmethod
    def post_allowance_payment(
        cls,
        allowance: "Allowance",
        user: "GlobalUser | None",
    ) -> "JournalEntry | None":
        """
        Gera lancamento contabil ao pagar um vale pontual.

        Estrutura:
          D: conta de despesa do tipo de vale
          C: Banco Bradesco C/C (saida de caixa)

        Mapeamento de tipo:
          meal / food  → 6.1.01.006 Vales Alimentacao e Refeicao
          transport    → 6.1.01.007 Vale Transporte
          outros       → 6.1.01.001 Salarios e Ordenados (generico)

        Args:
            allowance: Instancia de Allowance com status=PAID.
            user: Usuario que marcou como pago.

        Returns:
            JournalEntry aprovado automaticamente ou None em caso de erro.
        """
        from apps.accounting.models.journal_entry import JournalEntryOrigin
        from apps.accounting.services.journal_entry_service import JournalEntryService
        from apps.hr.models import Allowance as AllowanceModel

        try:
            amount = Decimal(str(allowance.amount))
            if amount <= 0:
                logger.warning(
                    "HRAccountingService.post_allowance_payment: valor invalido (%s) "
                    "para allowance %s — lancamento nao gerado.",
                    amount,
                    allowance.id,
                )
                return None

            # Selecionar conta de despesa pelo tipo de vale
            atype = allowance.allowance_type
            if atype in (AllowanceModel.AllowanceType.MEAL, AllowanceModel.AllowanceType.FOOD):
                expense_key = "allowance_meal"
            elif atype == AllowanceModel.AllowanceType.TRANSPORT:
                expense_key = "allowance_transport"
            else:
                expense_key = "salary_gross"

            acc_expense = _resolve_account(expense_key)
            acc_bank = _resolve_account("bank")

            if not acc_expense or not acc_bank:
                logger.warning(
                    "HRAccountingService.post_allowance_payment: contas nao encontradas "
                    "para allowance %s — lancamento nao gerado.",
                    allowance.id,
                )
                return None

            competence_date: date = (
                allowance.paid_at.date()
                if allowance.paid_at
                else allowance.reference_month.replace(day=1)
            )

            lines: list[dict] = [
                {
                    "account_id": str(acc_expense.id),
                    "debit_amount": str(amount),
                    "credit_amount": "0.00",
                    "description": (
                        f"Vale {allowance.get_allowance_type_display()} — "
                        f"{allowance.employee}"
                    ),
                },
                {
                    "account_id": str(acc_bank.id),
                    "debit_amount": "0.00",
                    "credit_amount": str(amount),
                    "description": (
                        f"Pagamento vale {allowance.get_allowance_type_display()} — "
                        f"{allowance.employee}"
                    ),
                },
            ]

            entry = JournalEntryService.create_entry(
                description=(
                    f"Pagamento de Vale — {allowance.get_allowance_type_display()} — "
                    f"{allowance.employee} — {allowance.reference_month}"
                ),
                competence_date=competence_date,
                origin=JournalEntryOrigin.MANUAL,
                lines=lines,
                origin_object=allowance,
                user=user,
                auto_approve=True,
            )

            logger.info(
                "HRAccountingService.post_allowance_payment: lancamento %s gerado "
                "para allowance %s",
                entry.number,
                allowance.id,
            )
            return entry

        except Exception as exc:
            logger.warning(
                "HRAccountingService.post_allowance_payment: erro ao gerar lancamento "
                "para allowance %s: %s",
                allowance.id,
                exc,
                exc_info=True,
            )
            return None

    @classmethod
    def post_bonus(
        cls,
        bonus: "Bonus",
        user: "GlobalUser | None",
    ) -> "JournalEntry | None":
        """
        Gera lancamento contabil ao confirmar um bonus.

        Estrutura:
          D: 6.1.01.008 Bonificacoes e Comissoes (despesa)
          C: 2.1.03.001 Salarios e Ordenados a Pagar (passivo)

        Args:
            bonus: Instancia de Bonus confirmado.
            user: Usuario que confirmou o bonus.

        Returns:
            JournalEntry aprovado automaticamente ou None em caso de erro.
        """
        from apps.accounting.models.journal_entry import JournalEntryOrigin
        from apps.accounting.services.journal_entry_service import JournalEntryService

        try:
            amount = Decimal(str(bonus.amount))
            if amount <= 0:
                logger.warning(
                    "HRAccountingService.post_bonus: valor invalido (%s) "
                    "para bonus %s — lancamento nao gerado.",
                    amount,
                    bonus.id,
                )
                return None

            acc_bonus = _resolve_account("bonus")
            acc_payable = _resolve_account("payable_net")

            if not acc_bonus or not acc_payable:
                logger.warning(
                    "HRAccountingService.post_bonus: contas nao encontradas "
                    "para bonus %s — lancamento nao gerado.",
                    bonus.id,
                )
                return None

            competence_date: date = bonus.reference_month.replace(day=1)

            lines: list[dict] = [
                {
                    "account_id": str(acc_bonus.id),
                    "debit_amount": str(amount),
                    "credit_amount": "0.00",
                    "description": f"Bonus {bonus.get_bonus_type_display()} — {bonus.employee}",
                },
                {
                    "account_id": str(acc_payable.id),
                    "debit_amount": "0.00",
                    "credit_amount": str(amount),
                    "description": f"Bonus a pagar — {bonus.employee}",
                },
            ]

            entry = JournalEntryService.create_entry(
                description=(
                    f"Bonus — {bonus.get_bonus_type_display()} — "
                    f"{bonus.employee} — {bonus.reference_month}"
                ),
                competence_date=competence_date,
                origin=JournalEntryOrigin.PAYROLL,
                lines=lines,
                origin_object=bonus,
                user=user,
                auto_approve=True,
            )

            logger.info(
                "HRAccountingService.post_bonus: lancamento %s gerado para bonus %s",
                entry.number,
                bonus.id,
            )
            return entry

        except Exception as exc:
            logger.warning(
                "HRAccountingService.post_bonus: erro ao gerar lancamento "
                "para bonus %s: %s",
                bonus.id,
                exc,
                exc_info=True,
            )
            return None
