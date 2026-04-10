"""
Paddock Solutions — Accounting: Filtros django-filters
"""
import logging

import django_filters

from apps.accounting.models.chart_of_accounts import AccountType, ChartOfAccount
from apps.accounting.models.fiscal_period import FiscalPeriod
from apps.accounting.models.journal_entry import JournalEntry, JournalEntryOrigin

logger = logging.getLogger(__name__)


class ChartOfAccountFilter(django_filters.FilterSet):
    """Filtros para o plano de contas."""

    account_type = django_filters.ChoiceFilter(choices=AccountType.choices)
    is_analytical = django_filters.BooleanFilter()
    is_active = django_filters.BooleanFilter()
    code_startswith = django_filters.CharFilter(
        field_name="code",
        lookup_expr="startswith",
        label="Código começa com",
    )
    level = django_filters.NumberFilter()
    level_lte = django_filters.NumberFilter(field_name="level", lookup_expr="lte")

    class Meta:
        model = ChartOfAccount
        fields = ["account_type", "is_analytical", "is_active", "code_startswith", "level"]


class FiscalPeriodFilter(django_filters.FilterSet):
    """Filtros para períodos fiscais."""

    is_closed = django_filters.BooleanFilter()
    fiscal_year = django_filters.NumberFilter(field_name="fiscal_year__year")

    class Meta:
        model = FiscalPeriod
        fields = ["is_closed", "fiscal_year"]


class JournalEntryFilter(django_filters.FilterSet):
    """Filtros para lançamentos contábeis."""

    origin = django_filters.ChoiceFilter(choices=JournalEntryOrigin.choices)
    is_approved = django_filters.BooleanFilter()
    is_reversed = django_filters.BooleanFilter()
    competence_date_gte = django_filters.DateFilter(
        field_name="competence_date",
        lookup_expr="gte",
        label="Competência a partir de",
    )
    competence_date_lte = django_filters.DateFilter(
        field_name="competence_date",
        lookup_expr="lte",
        label="Competência até",
    )
    fiscal_period = django_filters.UUIDFilter(
        field_name="fiscal_period__id",
        label="Período Fiscal (UUID)",
    )
    number = django_filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = JournalEntry
        fields = [
            "origin",
            "is_approved",
            "is_reversed",
            "competence_date_gte",
            "competence_date_lte",
            "fiscal_period",
            "number",
        ]
