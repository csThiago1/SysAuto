"""
Paddock Solutions — Accounts Payable Accounting Service

Gera lancamentos contabeis automaticos para eventos de contas a pagar.

Regra: NUNCA lancar excecao que quebre o fluxo AP — logar e retornar None.

Contas do plano DS Car utilizadas:
  2.1.04.001  Fornecedores a Pagar          (passivo — baixa ao pagar)
  1.1.01.002  Banco Bradesco C/C             (ativo — saida de caixa)
  2.1.03.001  Salarios e Ordenados a Pagar   (passivo — usado quando origin=FOLHA)
"""
import logging
from decimal import Decimal
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.accounting.models.journal_entry import JournalEntry
    from apps.authentication.models import GlobalUser

    from .models import PayableDocument, PayablePayment

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Mapeamento semantico → codigo do plano de contas DS Car
# ---------------------------------------------------------------------------
AP_ACCOUNT_MAP: dict[str, str] = {
    "suppliers_payable": "2.1.04.001",  # Fornecedores a Pagar
    "bank": "1.1.01.002",               # Banco Bradesco C/C
    "payroll_payable": "2.1.03.001",    # Salarios a Pagar (origin=FOLHA)
}


def _resolve_account(key: str) -> "object | None":
    """
    Resolve um codigo semantico para o objeto ChartOfAccount.

    Busca pelo codigo no plano de contas. Se nao encontrar, loga warning
    e retorna None — nunca levanta excecao para nao quebrar o fluxo AP.

    Args:
        key: Chave semantica do AP_ACCOUNT_MAP (ex: "bank").

    Returns:
        Instancia de ChartOfAccount ou None se nao encontrada.
    """
    from apps.accounting.models.chart_of_accounts import ChartOfAccount

    code = AP_ACCOUNT_MAP.get(key)
    if not code:
        logger.warning(
            "PayableAccountingService: chave semantica '%s' nao encontrada no AP_ACCOUNT_MAP",
            key,
        )
        return None

    try:
        return ChartOfAccount.objects.get(code=code, is_analytical=True)
    except ChartOfAccount.DoesNotExist:
        logger.warning(
            "PayableAccountingService: conta '%s' (%s) nao encontrada no plano de contas. "
            "Execute setup_chart_of_accounts para popular o plano.",
            code,
            key,
        )
        return None


class PayableAccountingService:
    """
    Servico de integracao entre Contas a Pagar e Contabilidade.

    Todos os metodos retornam JournalEntry ou None.
    Nunca lancam excecao — erros sao logados como warning.

    Responsabilidade do chamador: envolver em try/except para garantir que
    falhas contabeis nao interrompam o fluxo operacional de AP.
    """

    @classmethod
    def post_payment(
        cls,
        payment: "PayablePayment",
        document: "PayableDocument",
        user: "GlobalUser | None",
    ) -> "JournalEntry | None":
        """
        Gera lancamento contabil ao registrar pagamento de titulo a pagar.

        Estrutura do lancamento (partidas dobradas):

        Quando origin == 'FOLHA' (folha de pagamento):
          D 2.1.03.001  Salarios e Ordenados a Pagar (baixa do passivo)
          C 1.1.01.002  Banco Bradesco C/C            (saida de caixa)

        Para demais origens (fornecedores):
          D 2.1.04.001  Fornecedores a Pagar          (baixa do passivo)
          C 1.1.01.002  Banco Bradesco C/C             (saida de caixa)

        Args:
            payment: Instancia de PayablePayment recem criada.
            document: Instancia de PayableDocument relacionada.
            user: Usuario que registrou o pagamento.

        Returns:
            JournalEntry aprovado automaticamente ou None em caso de erro.
        """
        from apps.accounting.models.journal_entry import JournalEntryOrigin
        from apps.accounting.services.journal_entry_service import JournalEntryService

        try:
            amount = Decimal(str(payment.amount))
            if amount <= 0:
                logger.warning(
                    "PayableAccountingService.post_payment: valor invalido (%s) "
                    "para payment %s — lancamento nao gerado.",
                    amount,
                    payment.id,
                )
                return None

            # Selecionar conta devedora conforme a origem do documento
            is_payroll = document.origin == "FOLHA"
            debit_key = "payroll_payable" if is_payroll else "suppliers_payable"

            acc_debit = _resolve_account(debit_key)
            acc_bank = _resolve_account("bank")

            if not acc_debit or not acc_bank:
                logger.warning(
                    "PayableAccountingService.post_payment: contas criticas nao encontradas "
                    "para payment %s — lancamento nao gerado.",
                    payment.id,
                )
                return None

            lines: list[dict] = [
                {
                    "account_id": str(acc_debit.id),
                    "debit_amount": str(amount),
                    "credit_amount": "0.00",
                    "description": (
                        f"Pagamento: {document.description} — {document.supplier.name}"
                    ),
                },
                {
                    "account_id": str(acc_bank.id),
                    "debit_amount": "0.00",
                    "credit_amount": str(amount),
                    "description": (
                        f"Saida bancaria: {document.description} — {document.supplier.name}"
                    ),
                },
            ]

            entry = JournalEntryService.create_entry(
                description=(
                    f"Pagamento AP: {document.description} — "
                    f"{document.supplier.name} — R${amount}"
                ),
                competence_date=payment.payment_date,
                origin=JournalEntryOrigin.BANK_PAYMENT,
                lines=lines,
                # origin_object não passado: JournalEntry.object_id é PositiveIntegerField
                # e não suporta UUID PK. Rastreabilidade via journal_entry_id no PayablePayment.
                user=user,
                auto_approve=True,
            )

            logger.info(
                "PayableAccountingService.post_payment: lancamento %s gerado "
                "para payment %s",
                entry.number,
                payment.id,
            )
            return entry

        except Exception as exc:
            logger.warning(
                "PayableAccountingService.post_payment: erro ao gerar lancamento "
                "para payment %s: %s",
                payment.id,
                exc,
                exc_info=True,
            )
            return None
