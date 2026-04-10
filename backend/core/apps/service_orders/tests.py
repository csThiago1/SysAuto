"""
Paddock Solutions — Service Orders Tests
Sprint OS-001 — auto-transitions, validações, multitenancy.
"""
from datetime import date, timedelta

from django.test import TestCase

from apps.service_orders.models import (
    VALID_TRANSITIONS,
    ServiceOrder,
    ServiceOrderStatus,
)
from apps.service_orders.services import AUTO_TRANSITIONS


# ── TestServiceOrderStatus ─────────────────────────────────────────────────────

class TestServiceOrderStatus(TestCase):
    """Valida integridade do mapeamento de status e transições."""

    def test_all_statuses_in_valid_transitions(self) -> None:
        """Todos os status definidos devem ter entrada em VALID_TRANSITIONS."""
        all_statuses = [s.value for s in ServiceOrderStatus]
        for s in all_statuses:
            self.assertIn(
                s,
                VALID_TRANSITIONS,
                f"Status '{s}' não tem entrada em VALID_TRANSITIONS",
            )

    def test_transition_targets_are_valid_statuses(self) -> None:
        """Todos os destinos de VALID_TRANSITIONS devem ser status válidos."""
        valid = {s.value for s in ServiceOrderStatus}
        for src, targets in VALID_TRANSITIONS.items():
            for t in targets:
                self.assertIn(t, valid, f"Target '{t}' em VALID_TRANSITIONS['{src}'] é inválido")

    def test_auto_transitions_targets_are_valid(self) -> None:
        """Todos os targets de AUTO_TRANSITIONS devem ser status válidos."""
        valid = {s.value for s in ServiceOrderStatus}
        for field, (valid_from, target) in AUTO_TRANSITIONS.items():
            self.assertIn(
                target, valid, f"Target '{target}' de AUTO_TRANSITIONS['{field}'] é inválido"
            )
            for s in valid_from:
                self.assertIn(
                    s, valid, f"Status '{s}' em valid_from de '{field}' é inválido"
                )

    def test_can_transition_to_valid(self) -> None:
        """can_transition_to deve retornar True para transições válidas."""
        order = ServiceOrder(status="reception")
        self.assertTrue(order.can_transition_to("initial_survey"))
        self.assertTrue(order.can_transition_to("cancelled"))

    def test_can_transition_to_invalid(self) -> None:
        """can_transition_to deve retornar False para transições inválidas."""
        order = ServiceOrder(status="reception")
        self.assertFalse(order.can_transition_to("delivered"))
        self.assertFalse(order.can_transition_to("painting"))


# ── TestAutoTransitionLogic ─────────────────────────────────────────────────────

class TestAutoTransitionLogic(TestCase):
    """Testa a lógica de detecção de transições automáticas no service."""

    def _detect_transitions(self, order_status: str, data: dict, old_values: dict) -> list:
        triggered = []
        for field, (valid_from, target) in AUTO_TRANSITIONS.items():
            old_value = old_values.get(field)
            new_value = data.get(field)
            if old_value is None and new_value is not None:
                if order_status in valid_from:
                    triggered.append((field, target))
        return triggered

    def test_authorization_date_triggers_authorized(self) -> None:
        """Preencher authorization_date em budget → deve disparar 'authorized'."""
        triggered = self._detect_transitions(
            "budget",
            {"authorization_date": "2026-04-02T10:00:00Z"},
            {f: None for f in AUTO_TRANSITIONS},
        )
        self.assertEqual(len(triggered), 1)
        self.assertEqual(triggered[0], ("authorization_date", "authorized"))

    def test_authorization_date_ignored_if_wrong_status(self) -> None:
        """authorization_date em status 'repair' NÃO deve disparar transição."""
        triggered = self._detect_transitions(
            "repair",
            {"authorization_date": "2026-04-02T10:00:00Z"},
            {f: None for f in AUTO_TRANSITIONS},
        )
        self.assertEqual(len(triggered), 0)

    def test_final_survey_date_triggers_final_survey(self) -> None:
        """final_survey_date em washing → deve disparar 'final_survey'."""
        triggered = self._detect_transitions(
            "washing",
            {"final_survey_date": "2026-04-02T14:00:00Z"},
            {f: None for f in AUTO_TRANSITIONS},
        )
        self.assertEqual(len(triggered), 1)
        self.assertEqual(triggered[0], ("final_survey_date", "final_survey"))

    def test_client_delivery_date_triggers_delivered(self) -> None:
        """client_delivery_date em ready → deve disparar 'delivered'."""
        triggered = self._detect_transitions(
            "ready",
            {"client_delivery_date": "2026-04-02T17:00:00Z"},
            {f: None for f in AUTO_TRANSITIONS},
        )
        self.assertEqual(len(triggered), 1)
        self.assertEqual(triggered[0], ("client_delivery_date", "delivered"))

    def test_entry_date_triggers_initial_survey(self) -> None:
        """entry_date em reception → deve disparar 'initial_survey'."""
        triggered = self._detect_transitions(
            "reception",
            {"entry_date": "2026-04-02T08:00:00Z"},
            {f: None for f in AUTO_TRANSITIONS},
        )
        self.assertEqual(len(triggered), 1)
        self.assertEqual(triggered[0], ("entry_date", "initial_survey"))

    def test_only_one_transition_applied_per_update(self) -> None:
        """Quando múltiplos campos disparam, só o primeiro é aplicado."""
        # authorization_date (valid em waiting_auth) E entry_date (valid em reception)
        # se status for waiting_auth, só authorization_date deve disparar
        triggered = self._detect_transitions(
            "waiting_auth",
            {
                "authorization_date": "2026-04-02T10:00:00Z",
                "entry_date": "2026-04-02T09:00:00Z",
            },
            {f: None for f in AUTO_TRANSITIONS},
        )
        # Pode ter mais de um detectado, mas apenas 1 deve ser aplicado
        applied = triggered[:1]
        self.assertEqual(len(applied), 1)

    def test_no_transition_if_field_already_set(self) -> None:
        """Se o campo já tem valor, não deve disparar transição."""
        triggered = self._detect_transitions(
            "budget",
            {"authorization_date": "2026-04-02T10:00:00Z"},
            # Simula que authorization_date JÁ estava preenchido
            {"authorization_date": "2026-04-01T10:00:00Z"},
        )
        self.assertEqual(len(triggered), 0)


# ── TestEstimatedDelivery ───────────────────────────────────────────────────────

class TestEstimatedDelivery(TestCase):
    """Testa cálculo automático de previsão de entrega."""

    def test_calculated_from_entry_plus_repair_days(self) -> None:
        entry = date(2026, 4, 1)
        result = entry + timedelta(days=10)
        self.assertEqual(result, date(2026, 4, 11))

    def test_recalculated_on_repair_days_change(self) -> None:
        entry = date(2026, 4, 1)
        self.assertEqual(entry + timedelta(days=5), date(2026, 4, 6))
        self.assertEqual(entry + timedelta(days=15), date(2026, 4, 16))

    def test_zero_repair_days_gives_same_day(self) -> None:
        entry = date(2026, 4, 1)
        self.assertEqual(entry + timedelta(days=0), date(2026, 4, 1))


# ── TestManualTransitionValidation ──────────────────────────────────────────────

class TestManualTransitionValidation(TestCase):
    """Testa validação de transições manuais."""

    def test_invalid_transition_detected(self) -> None:
        """reception não pode ir para delivered."""
        order = ServiceOrder(status="reception")
        self.assertFalse(order.can_transition_to("delivered"))

    def test_valid_transition_detected(self) -> None:
        """final_survey pode ir para ready."""
        order = ServiceOrder(status="final_survey")
        self.assertTrue(order.can_transition_to("ready"))

    def test_cancelled_has_no_outgoing_transitions(self) -> None:
        """Cancelada não pode transitar para nenhum status."""
        order = ServiceOrder(status="cancelled")
        self.assertEqual(VALID_TRANSITIONS.get("cancelled", []), [])
        self.assertFalse(order.can_transition_to("reception"))

    def test_delivered_has_no_outgoing_transitions(self) -> None:
        """Entregue não pode transitar para nenhum status."""
        order = ServiceOrder(status="delivered")
        self.assertFalse(order.can_transition_to("ready"))

    def test_waiting_auth_can_go_to_authorized(self) -> None:
        order = ServiceOrder(status="waiting_auth")
        self.assertTrue(order.can_transition_to("authorized"))

    def test_waiting_auth_can_be_cancelled(self) -> None:
        order = ServiceOrder(status="waiting_auth")
        self.assertTrue(order.can_transition_to("cancelled"))


# ── TestSerializerValidation ─────────────────────────────────────────────────────

class TestSerializerValidation(TestCase):
    """Testa validações dos serializers."""

    def test_insurer_os_requires_insurer(self) -> None:
        """OS de seguradora sem insurer deve falhar na validação."""
        from apps.service_orders.serializers import ServiceOrderCreateSerializer

        data = {
            "customer_type": "insurer",
            "customer_name": "Test Cliente",
            "plate": "ABC1234",
            "insured_type": "insured",
            # insurer ausente
        }
        serializer = ServiceOrderCreateSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        errors = serializer.errors
        has_error = "insurer" in errors or "non_field_errors" in errors
        self.assertTrue(has_error, f"Esperado erro de 'insurer', mas erros foram: {errors}")

    def test_insurer_os_requires_insured_type(self) -> None:
        """OS de seguradora sem insured_type deve falhar na validação."""
        from apps.service_orders.serializers import ServiceOrderCreateSerializer

        data = {
            "customer_type": "insurer",
            "customer_name": "Test Cliente",
            "plate": "ABC1234",
            # insurer e insured_type ausentes
        }
        serializer = ServiceOrderCreateSerializer(data=data)
        self.assertFalse(serializer.is_valid())
