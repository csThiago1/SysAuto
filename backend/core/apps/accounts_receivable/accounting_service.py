"""
Paddock Solutions — Accounts Receivable Accounting Service

Gera lancamentos contabeis automaticos para eventos de contas a receber.

Regra: NUNCA lancar excecao que quebre o fluxo AR — logar e retornar None.

Contas do plano DS Car utilizadas:
  1.1.02.001  Clientes a Receber   (ativo — baixa ao receber)
  1.1.01.002  Banco Bradesco C/C   (ativo — entrada de caixa)
"""
import logging
from decimal import Decimal
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.accounting.models.journal_entry import JournalEntry
    from apps.authentication.models import GlobalUser

    from .models import ReceivableDocument, ReceivableReceipt

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Mapeamento semantico → codigo do plano de contas DS Car
# ---------------------------------------------------------------------------
AR_ACCOUNT_MAP: dict[str, str] = {
    "accounts_receivable": "1.1.02.001",  # Clientes a Receber
    "bank": "1.1.01.002",                 # Banco Bradesco C/C
}


def _resolve_account(key: str) -> "object | None":
    """
    Resolve um codigo semantico para o objeto ChartOfAccount.

    Busca pelo codigo no plano de contas. Se nao encontrar, loga warning
    e retorna None — nunca levanta excecao para nao quebrar o fluxo AR.

    Args:
        key: Chave semantica do AR_ACCOUNT_MAP (ex: "bank").

    Returns:
        Instancia de ChartOfAccount ou None se nao encontrada.
    """
    from apps.accounting.models.chart_of_accounts import ChartOfAccount

    code = AR_ACCOUNT_MAP.get(key)
    if not code:
        logger.warning(
            "ReceivableAccountingService: chave semantica '%s' nao encontrada no AR_ACCOUNT_MAP",
            key,
        )
        return None

    try:
        return ChartOfAccount.objects.get(code=code, is_analytical=True)
    except ChartOfAccount.DoesNotExist:
        logger.warning(
            "ReceivableAccountingService: conta '%s' (%s) nao encontrada no plano de contas. "
            "Execute setup_chart_of_accounts para popular o plano.",
            code,
            key,
        )
        return None


class ReceivableAccountingService:
    """
    Servico de integracao entre Contas a Receber e Contabilidade.

    Todos os metodos retornam JournalEntry ou None.
    Nunca lancam excecao — erros sao logados como warning.

    Responsabilidade do chamador: envolver em try/except para garantir que
    falhas contabeis nao interrompam o fluxo operacional de AR.
    """

    @classmethod
    def post_receipt(
        cls,
        receipt: "ReceivableReceipt",
        document: "ReceivableDocument",
        user: "GlobalUser | None",
    ) -> "JournalEntry | None":
        """
        Gera lancamento contabil ao registrar recebimento de titulo a receber.

        Estrutura do lancamento (partidas dobradas):
          D 1.1.01.002  Banco Bradesco C/C   (entrada de caixa)
          C 1.1.02.001  Clientes a Receber   (baixa do ativo circulante)

        Args:
            receipt: Instancia de ReceivableReceipt recem criada.
            document: Instancia de ReceivableDocument relacionada.
            user: Usuario que registrou o recebimento.

        Returns:
            JournalEntry aprovado automaticamente ou None em caso de erro.
        """
        from apps.accounting.models.journal_entry import JournalEntryOrigin
        from apps.accounting.services.journal_entry_service import JournalEntryService

        try:
            amount = Decimal(str(receipt.amount))
            if amount <= 0:
                logger.warning(
                    "ReceivableAccountingService.post_receipt: valor invalido (%s) "
                    "para receipt %s — lancamento nao gerado.",
                    amount,
                    receipt.id,
                )
                return None

            acc_bank = _resolve_account("bank")
            acc_ar = _resolve_account("accounts_receivable")

            if not acc_bank or not acc_ar:
                logger.warning(
                    "ReceivableAccountingService.post_receipt: contas criticas nao encontradas "
                    "para receipt %s — lancamento nao gerado.",
                    receipt.id,
                )
                return None

            lines: list[dict] = [
                {
                    "account_id": str(acc_bank.id),
                    "debit_amount": str(amount),
                    "credit_amount": "0.00",
                    "description": (
                        f"Recebimento: {document.description} — {document.customer_name}"
                    ),
                },
                {
                    "account_id": str(acc_ar.id),
                    "debit_amount": "0.00",
                    "credit_amount": str(amount),
                    "description": (
                        f"Baixa AR: {document.description} — {document.customer_name}"
                    ),
                },
            ]

            entry = JournalEntryService.create_entry(
                description=(
                    f"Recebimento AR: {document.description} — "
                    f"{document.customer_name} — R${amount}"
                ),
                competence_date=receipt.receipt_date,
                origin=JournalEntryOrigin.BANK_RECEIPT,
                lines=lines,
                # origin_object não passado: JournalEntry.object_id é PositiveIntegerField
                # e não suporta UUID PK. Rastreabilidade via journal_entry_id no ReceivableReceipt.
                user=user,
                auto_approve=True,
            )

            logger.info(
                "ReceivableAccountingService.post_receipt: lancamento %s gerado "
                "para receipt %s",
                entry.number,
                receipt.id,
            )
            return entry

        except Exception as exc:
            logger.warning(
                "ReceivableAccountingService.post_receipt: erro ao gerar lancamento "
                "para receipt %s: %s",
                receipt.id,
                exc,
                exc_info=True,
            )
            return None
