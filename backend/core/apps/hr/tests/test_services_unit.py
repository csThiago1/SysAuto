"""
Paddock Solutions — HR Service Unit Tests — Sprint 6
Testa TimeClockService._validate_sequence sem DB.
"""
from datetime import datetime, timezone
from unittest.mock import MagicMock

from django.test import SimpleTestCase
from rest_framework import serializers as drf_serializers

from apps.hr.models import TimeClockEntry
from apps.hr.services import TimeClockService


class TestTimeClockSequenceUnit(SimpleTestCase):
    """Testa _validate_sequence sem acesso a banco."""

    def _mock_entry(self, entry_type: str) -> MagicMock:
        entry = MagicMock()
        entry.entry_type = entry_type
        return entry

    def test_first_entry_must_be_clock_in(self) -> None:
        """Sem registro anterior, única opção válida é clock_in."""
        TimeClockService._validate_sequence(None, "clock_in")  # deve passar

    def test_break_start_not_allowed_as_first_entry(self) -> None:
        with self.assertRaises(drf_serializers.ValidationError):
            TimeClockService._validate_sequence(None, "break_start")

    def test_clock_out_not_allowed_as_first_entry(self) -> None:
        with self.assertRaises(drf_serializers.ValidationError):
            TimeClockService._validate_sequence(None, "clock_out")

    def test_after_clock_in_can_break_or_clock_out(self) -> None:
        last = self._mock_entry("clock_in")
        TimeClockService._validate_sequence(last, "break_start")  # ok
        TimeClockService._validate_sequence(last, "clock_out")    # ok

    def test_after_clock_in_cannot_clock_in_again(self) -> None:
        last = self._mock_entry("clock_in")
        with self.assertRaises(drf_serializers.ValidationError):
            TimeClockService._validate_sequence(last, "clock_in")

    def test_after_break_start_must_break_end(self) -> None:
        last = self._mock_entry("break_start")
        TimeClockService._validate_sequence(last, "break_end")  # ok

    def test_after_break_start_cannot_clock_out(self) -> None:
        last = self._mock_entry("break_start")
        with self.assertRaises(drf_serializers.ValidationError):
            TimeClockService._validate_sequence(last, "clock_out")

    def test_after_break_end_can_break_or_clock_out(self) -> None:
        last = self._mock_entry("break_end")
        TimeClockService._validate_sequence(last, "break_start")  # ok
        TimeClockService._validate_sequence(last, "clock_out")    # ok

    def test_after_clock_out_can_only_clock_in(self) -> None:
        last = self._mock_entry("clock_out")
        TimeClockService._validate_sequence(last, "clock_in")  # ok

    def test_after_clock_out_cannot_break_start(self) -> None:
        last = self._mock_entry("clock_out")
        with self.assertRaises(drf_serializers.ValidationError):
            TimeClockService._validate_sequence(last, "break_start")


class TestTimeClockWorkedMinutesUnit(SimpleTestCase):
    """Testa _calculate_worked_minutes sem acesso a banco."""

    def _entry(self, entry_type: str, hour: int, minute: int) -> MagicMock:
        entry = MagicMock()
        entry.entry_type = entry_type
        entry.timestamp = datetime(2026, 4, 1, hour, minute, 0, tzinfo=timezone.utc)
        return entry

    def test_simple_workday_8h(self) -> None:
        """08:00 entrada → 12:00 intervalo → 13:00 volta → 17:00 saída = 480 min."""
        entries = [
            self._entry("clock_in", 8, 0),
            self._entry("break_start", 12, 0),
            self._entry("break_end", 13, 0),
            self._entry("clock_out", 17, 0),
        ]
        minutes = TimeClockService._calculate_worked_minutes(entries)
        self.assertEqual(minutes, 480)

    def test_no_entries_returns_zero(self) -> None:
        self.assertEqual(TimeClockService._calculate_worked_minutes([]), 0)

    def test_half_day_saturday_4h(self) -> None:
        """08:00 entrada → 12:00 saída = 240 min."""
        entries = [
            self._entry("clock_in", 8, 0),
            self._entry("clock_out", 12, 0),
        ]
        minutes = TimeClockService._calculate_worked_minutes(entries)
        self.assertEqual(minutes, 240)

    def test_overtime_9h(self) -> None:
        """08:00 entrada → sem intervalo → 17:00 saída = 540 min."""
        entries = [
            self._entry("clock_in", 8, 0),
            self._entry("clock_out", 17, 0),
        ]
        minutes = TimeClockService._calculate_worked_minutes(entries)
        self.assertEqual(minutes, 540)
