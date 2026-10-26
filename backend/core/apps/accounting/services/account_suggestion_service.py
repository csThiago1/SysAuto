"""
Paddock Solutions — Accounting: sugestão de conta contábil por descrição.

Fluxo: cache exato → LLM → validação → grava regra. A LLM é chamada no máximo
uma vez por termo novo; a confirmação humana no salvamento vira regra HUMAN e
nunca mais é reconsultada.
"""

import logging
from dataclasses import dataclass

from django.db.models import F, QuerySet

from apps.accounting.models.account_suggestion import AccountSuggestionRule, SuggestionSource
from apps.accounting.models.chart_of_accounts import AccountType, ChartOfAccount
from apps.accounting.services import llm_client
from apps.accounting.services.term_normalizer import normalize_term

logger = logging.getLogger(__name__)

# Só faz sentido sugerir conta de custo ou despesa para um lançamento de saída.
_SUGGESTABLE_TYPES = (AccountType.COST, AccountType.EXPENSE)

_PROMPT = """Classifique a despesa abaixo em UMA das contas contábeis listadas.

Descrição da despesa: "{description}"

Contas disponíveis:
{accounts}

Responda APENAS com o código da conta, sem nenhum outro texto.
Se nenhuma conta servir, responda exatamente: NENHUMA"""


@dataclass(frozen=True)
class AccountSuggestion:
    """Sugestão resolvida — sempre aponta para uma conta válida e ativa."""

    account: ChartOfAccount
    source: str


def suggestable_accounts() -> QuerySet[ChartOfAccount]:
    """Contas analíticas ativas de custo/despesa — as únicas sugeríveis."""
    return ChartOfAccount.objects.filter(
        is_active=True,
        is_analytical=True,
        account_type__in=_SUGGESTABLE_TYPES,
    ).order_by("code")


def suggest_account(description: str) -> AccountSuggestion | None:
    """
    Sugere a conta contábil para uma descrição de despesa.

    Args:
        description: Texto livre digitado pelo usuário (ex: "tesoura").

    Returns:
        AccountSuggestion, ou None quando não há sugestão confiável.
    """
    term = normalize_term(description)
    if not term:
        return None

    cached = _from_cache(term)
    if cached is not None:
        return cached

    # Descrição real é frase ("mascara n95 caixa c 50"), não o item puro.
    # Sem este passo o cache só acerta quando a descrição bate inteira.
    by_word = _from_words(term)
    if by_word is not None:
        return by_word

    return _from_llm(term)


def remember(description: str, account: ChartOfAccount) -> None:
    """
    Grava a escolha confirmada por um humano como regra permanente.

    Chamado ao salvar um documento de despesa. Sobrescreve regras LLM e SEED —
    a correção do usuário é a última palavra.

    Args:
        description: Descrição do documento salvo.
        account: Conta que o usuário efetivamente escolheu.
    """
    term = normalize_term(description)
    if not term:
        return

    AccountSuggestionRule.objects.update_or_create(
        term=term,
        defaults={
            "account": account,
            "source": SuggestionSource.HUMAN,
            "is_active": True,
        },
    )


# ── Internos ─────────────────────────────────────────────────────────────────


def _from_cache(term: str) -> AccountSuggestion | None:
    """Busca regra existente e contabiliza o acerto."""
    rule = (
        AccountSuggestionRule.objects.filter(term=term, is_active=True)
        .select_related("account")
        .first()
    )
    if rule is None:
        return None

    if not rule.account.is_active:
        return None

    AccountSuggestionRule.objects.filter(pk=rule.pk).update(hits=F("hits") + 1)
    return AccountSuggestion(account=rule.account, source=rule.source)


def _from_words(term: str) -> AccountSuggestion | None:
    """
    Procura uma regra cujo termo apareça como palavra dentro da descrição.

    Casa por token e por bigrama ("papel a4", "taxa de cartao" são termos de
    duas/três palavras), tudo num único filtro indexado — nada de varrer a
    tabela inteira.

    Desempate: regra confirmada por humano ganha da carga inicial, e termo
    mais específico (mais longo) ganha do mais genérico.
    """
    words = term.split()
    if len(words) < 2:
        # Descrição de uma palavra já foi tentada no match exato.
        return None

    candidates = set(words)
    candidates.update(" ".join(words[i : i + 2]) for i in range(len(words) - 1))
    candidates.update(" ".join(words[i : i + 3]) for i in range(len(words) - 2))

    rules = (
        AccountSuggestionRule.objects.filter(term__in=candidates, is_active=True)
        .select_related("account")
        .filter(account__is_active=True)
    )

    priority = {SuggestionSource.HUMAN: 0, SuggestionSource.SEED: 1, SuggestionSource.LLM: 2}
    best = min(
        rules,
        key=lambda r: (priority.get(r.source, 3), -len(r.term)),
        default=None,
    )
    if best is None:
        return None

    AccountSuggestionRule.objects.filter(pk=best.pk).update(hits=F("hits") + 1)
    return AccountSuggestion(account=best.account, source=best.source)


def _from_llm(term: str) -> AccountSuggestion | None:
    """Classifica via LLM, valida o código devolvido e memoriza o resultado."""
    if not llm_client.is_configured():
        return None

    accounts = list(suggestable_accounts())
    if not accounts:
        return None

    catalog = "\n".join(f"{acc.code} — {acc.name}" for acc in accounts)
    answer = llm_client.complete(_PROMPT.format(description=term, accounts=catalog))
    if not answer:
        return None

    code = answer.strip().split()[0].strip().rstrip(".,;:")
    account = next((acc for acc in accounts if acc.code == code), None)
    if account is None:
        # A LLM não escolhe fora do plano de contas — resposta inválida é descartada.
        logger.warning("LLM devolveu código fora do plano de contas para termo '%s'.", term)
        return None

    AccountSuggestionRule.objects.update_or_create(
        term=term,
        defaults={
            "account": account,
            "source": SuggestionSource.LLM,
            # Ressuscita regra soft-deletada; sem isso o cache nunca acerta e a
            # LLM é chamada para sempre no mesmo termo.
            "is_active": True,
        },
    )
    return AccountSuggestion(account=account, source=SuggestionSource.LLM)
