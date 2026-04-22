import pytest

from apps.service_orders.kanban import (
    STATES_WITH_BUDGET_REENTRY,
    VALID_TRANSITIONS,
    allowed_transitions,
    is_valid_transition,
)


class TestValidTransitions:

    def test_reception_goes_to_initial_survey(self):
        assert is_valid_transition("reception", "initial_survey")

    def test_reception_can_cancel(self):
        assert is_valid_transition("reception", "cancelled")

    def test_budget_goes_to_repair_or_waiting_parts(self):
        assert is_valid_transition("budget", "waiting_parts")
        assert is_valid_transition("budget", "repair")

    def test_repair_reenters_budget(self):
        """Re-entrada: novo complemento/importação precisa pausar reparo."""
        assert is_valid_transition("repair", "budget")

    def test_all_repair_states_can_reenter_budget(self):
        """Todos os estados de reparo (bodywork, painting, etc) permitem voltar pra budget."""
        repair_states = ["repair", "mechanic", "bodywork", "painting",
                         "assembly", "polishing", "washing"]
        for state in repair_states:
            assert is_valid_transition(state, "budget"), (
                f"{state} deveria permitir voltar para budget"
            )

    def test_final_survey_cannot_reenter_budget(self):
        """Pós-vistoria final, complementos viram nova OS."""
        assert not is_valid_transition("final_survey", "budget")

    def test_delivered_is_terminal(self):
        assert allowed_transitions("delivered") == []

    def test_cancelled_is_terminal(self):
        assert allowed_transitions("cancelled") == []

    def test_invalid_state_returns_empty(self):
        assert allowed_transitions("XXX_UNKNOWN") == []

    def test_ready_goes_only_to_delivered(self):
        assert allowed_transitions("ready") == ["delivered"]


class TestBudgetReentryStates:

    def test_contains_expected_states(self):
        expected = {"repair", "mechanic", "bodywork", "painting",
                    "assembly", "polishing", "washing"}
        assert STATES_WITH_BUDGET_REENTRY == expected

    def test_final_survey_not_reentry(self):
        assert "final_survey" not in STATES_WITH_BUDGET_REENTRY
