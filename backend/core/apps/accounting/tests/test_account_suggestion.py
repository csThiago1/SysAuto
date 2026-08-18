"""
Testes da sugestão de conta contábil por descrição.

O cliente LLM é sempre mockado — nenhum teste faz chamada de rede.
"""

from unittest.mock import patch

from django.test import override_settings
from django_tenants.test.cases import TenantTestCase

from apps.accounting.models.account_suggestion import AccountSuggestionRule, SuggestionSource
from apps.accounting.models.chart_of_accounts import AccountType, ChartOfAccount, NatureType
from apps.accounting.services import account_suggestion_service as svc
from apps.accounting.services.term_normalizer import normalize_term

# Atenção: @override_settings NÃO funciona como decorator de classe em
# TenantTestCase (o setUpClass do django-tenants não ativa o contexto).
# Use sempre no método.
LLM_SETTINGS = {
    "LLM_BASE_URL": "http://llm.test/v1",
    "LLM_API_KEY": "k",
    "LLM_MODEL": "test-model",
}


class AccountSuggestionServiceTest(TenantTestCase):
    """Cache, chamada à LLM, validação e aprendizado."""

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.escritorio = ChartOfAccount.objects.create(
            code="4.1.02.003",
            name="Material de Escritório",
            account_type=AccountType.EXPENSE,
            nature=NatureType.DEBIT,
            is_analytical=True,
            level=4,
        )
        cls.limpeza = ChartOfAccount.objects.create(
            code="4.1.02.004",
            name="Material de Limpeza",
            account_type=AccountType.EXPENSE,
            nature=NatureType.DEBIT,
            is_analytical=True,
            level=4,
        )
        # Sintética — nunca pode ser sugerida
        cls.sintetica = ChartOfAccount.objects.create(
            code="4.1.02",
            name="Materiais",
            account_type=AccountType.EXPENSE,
            nature=NatureType.DEBIT,
            is_analytical=False,
            level=3,
        )

    def tearDown(self) -> None:
        AccountSuggestionRule.objects.all().delete()

    # ── Normalização ──────────────────────────────────────────────────────────

    def test_normalize_term_collapses_variants(self) -> None:
        """Maiúscula, acento, pontuação e espaço extra caem no mesmo termo."""
        self.assertEqual(normalize_term("Tesoura"), "tesoura")
        self.assertEqual(normalize_term("  TESOURA  "), "tesoura")
        self.assertEqual(normalize_term("Régua!"), "regua")
        self.assertEqual(normalize_term("Papel   A4"), "papel a4")
        self.assertEqual(normalize_term(""), "")

    # ── Cache ─────────────────────────────────────────────────────────────────

    @override_settings(**LLM_SETTINGS)
    def test_cache_hit_does_not_call_llm(self) -> None:
        """Termo já conhecido responde do cache, sem tocar na LLM."""
        AccountSuggestionRule.objects.create(
            term="tesoura", account=self.escritorio, source=SuggestionSource.SEED
        )
        with patch.object(svc.llm_client, "complete") as mock_complete:
            suggestion = svc.suggest_account("Tesoura")
        mock_complete.assert_not_called()
        assert suggestion is not None
        self.assertEqual(suggestion.account, self.escritorio)

    @override_settings(**LLM_SETTINGS)
    def test_cache_hit_increments_hits(self) -> None:
        """Cada acerto de cache contabiliza um hit."""
        rule = AccountSuggestionRule.objects.create(
            term="tesoura", account=self.escritorio, source=SuggestionSource.SEED
        )
        with patch.object(svc.llm_client, "complete"):
            svc.suggest_account("tesoura")
            svc.suggest_account("TESOURA")
        rule.refresh_from_db()
        self.assertEqual(rule.hits, 2)

    # ── LLM ───────────────────────────────────────────────────────────────────

    @override_settings(**LLM_SETTINGS)
    def test_cache_miss_calls_llm_once_and_memoizes(self) -> None:
        """Termo novo chama a LLM uma vez; a segunda consulta vem do cache."""
        with patch.object(svc.llm_client, "complete", return_value="4.1.02.003") as mock:
            first = svc.suggest_account("tesoura")
            second = svc.suggest_account("tesoura")

        self.assertEqual(mock.call_count, 1)
        assert first is not None and second is not None
        self.assertEqual(first.account, self.escritorio)
        self.assertEqual(second.account, self.escritorio)
        self.assertTrue(
            AccountSuggestionRule.objects.filter(
                term="tesoura", source=SuggestionSource.LLM
            ).exists()
        )

    @override_settings(**LLM_SETTINGS)
    def test_llm_code_outside_chart_is_rejected(self) -> None:
        """Código inexistente devolvido pela LLM não vira sugestão nem regra."""
        with patch.object(svc.llm_client, "complete", return_value="9.9.99.999") as mock:
            suggestion = svc.suggest_account("item exotico")
        mock.assert_called_once()
        self.assertIsNone(suggestion)
        self.assertFalse(AccountSuggestionRule.objects.filter(term="item exotico").exists())

    @override_settings(**LLM_SETTINGS)
    def test_llm_cannot_pick_synthetic_account(self) -> None:
        """Conta sintética não é sugerível, mesmo se a LLM devolver o código."""
        with patch.object(svc.llm_client, "complete", return_value="4.1.02") as mock:
            suggestion = svc.suggest_account("material generico")
        mock.assert_called_once()
        self.assertIsNone(suggestion)
        self.assertFalse(AccountSuggestionRule.objects.filter(term="material generico").exists())

    @override_settings(**LLM_SETTINGS)
    def test_llm_answer_nenhuma_returns_none(self) -> None:
        """Resposta 'NENHUMA' não casa com nenhum código e vira ausência de sugestão."""
        with patch.object(svc.llm_client, "complete", return_value="NENHUMA"):
            self.assertIsNone(svc.suggest_account("coisa indefinida"))

    @override_settings(**LLM_SETTINGS)
    def test_llm_unavailable_returns_none(self) -> None:
        """LLM fora do ar devolve string vazia — o serviço não levanta exceção."""
        with patch.object(svc.llm_client, "complete", return_value=""):
            self.assertIsNone(svc.suggest_account("tesoura"))

    def test_without_llm_config_only_cache_is_used(self) -> None:
        """Sem configuração de LLM, o serviço funciona só com o cache."""
        AccountSuggestionRule.objects.create(
            term="tesoura", account=self.escritorio, source=SuggestionSource.SEED
        )
        self.assertIsNotNone(svc.suggest_account("tesoura"))
        self.assertIsNone(svc.suggest_account("termo nunca visto"))

    # ── Aprendizado ───────────────────────────────────────────────────────────

    def test_remember_overrides_llm_rule(self) -> None:
        """A escolha do humano sobrescreve a regra criada pela LLM."""
        AccountSuggestionRule.objects.create(
            term="tesoura", account=self.limpeza, source=SuggestionSource.LLM
        )
        svc.remember("Tesoura", self.escritorio)

        rule = AccountSuggestionRule.objects.get(term="tesoura")
        self.assertEqual(rule.account, self.escritorio)
        self.assertEqual(rule.source, SuggestionSource.HUMAN)

    @override_settings(**LLM_SETTINGS)
    def test_llm_never_overrides_human_rule(self) -> None:
        """Regra HUMAN responde do cache — a LLM nunca chega a ser consultada."""
        svc.remember("tesoura", self.escritorio)
        with patch.object(svc.llm_client, "complete", return_value="4.1.02.004") as mock:
            suggestion = svc.suggest_account("tesoura")
        mock.assert_not_called()
        assert suggestion is not None
        self.assertEqual(suggestion.account, self.escritorio)

    def test_remember_ignores_empty_description(self) -> None:
        """Descrição vazia não cria regra lixo."""
        svc.remember("   ", self.escritorio)
        self.assertEqual(AccountSuggestionRule.objects.count(), 0)
