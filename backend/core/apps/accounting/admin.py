"""
Paddock Solutions — Accounting Admin
"""
import logging
from typing import Any

from django.contrib import admin
from django.http import HttpRequest

from .models import (
    ChartOfAccount,
    CostCenter,
    FiscalPeriod,
    FiscalYear,
    JournalEntry,
    JournalEntryLine,
    NumberSequence,
)

logger = logging.getLogger(__name__)


class JournalEntryLineInline(admin.TabularInline):
    """Inline para linhas de lancamento no admin."""

    model = JournalEntryLine
    extra = 0
    fields = ["account", "cost_center", "debit_amount", "credit_amount", "description"]
    readonly_fields = ["account", "cost_center", "debit_amount", "credit_amount", "description"]

    def has_add_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False

    def has_delete_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False


@admin.register(ChartOfAccount)
class ChartOfAccountAdmin(admin.ModelAdmin):
    """Admin do plano de contas."""

    list_display = [
        "code",
        "name",
        "account_type",
        "nature",
        "is_analytical",
        "level",
        "is_active",
    ]
    list_filter = ["account_type", "nature", "is_analytical", "is_active", "level"]
    search_fields = ["code", "name", "sped_code"]
    ordering = ["code"]
    readonly_fields = ["level", "created_at", "updated_at"]
    raw_id_fields = ["parent"]

    fieldsets = (
        (
            "Identificação",
            {
                "fields": ("code", "name", "parent", "level"),
            },
        ),
        (
            "Classificação",
            {
                "fields": (
                    "account_type",
                    "nature",
                    "is_analytical",
                    "accepts_cost_center",
                    "sped_code",
                ),
            },
        ),
        (
            "Controle",
            {
                "fields": ("is_active", "created_by", "created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )


@admin.register(CostCenter)
class CostCenterAdmin(admin.ModelAdmin):
    """Admin de centros de custo."""

    list_display = ["code", "name", "parent", "os_type_code", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["code", "name", "os_type_code"]
    ordering = ["code"]


@admin.register(FiscalYear)
class FiscalYearAdmin(admin.ModelAdmin):
    """Admin de exercicios fiscais."""

    list_display = ["year", "start_date", "end_date", "is_closed", "closed_at"]
    list_filter = ["is_closed"]
    ordering = ["-year"]
    readonly_fields = ["closed_at", "closed_by", "created_at", "updated_at"]


@admin.register(FiscalPeriod)
class FiscalPeriodAdmin(admin.ModelAdmin):
    """Admin de periodos fiscais."""

    list_display = [
        "fiscal_year",
        "number",
        "start_date",
        "end_date",
        "is_closed",
        "is_adjustment",
    ]
    list_filter = ["is_closed", "is_adjustment", "fiscal_year"]
    ordering = ["-fiscal_year__year", "number"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    """
    Admin de lancamentos contabeis.

    DELETE bloqueado — lancamentos sao imutaveis.
    """

    list_display = [
        "number",
        "description",
        "competence_date",
        "origin",
        "is_approved",
        "is_reversed",
    ]
    list_filter = ["origin", "is_approved", "is_reversed", "fiscal_period__fiscal_year"]
    search_fields = ["number", "description"]
    ordering = ["-competence_date", "-number"]
    readonly_fields = [
        "number",
        "is_reversed",
        "reversal_entry",
        "created_at",
        "updated_at",
    ]
    inlines = [JournalEntryLineInline]

    def has_delete_permission(
        self, request: HttpRequest, obj: Any = None
    ) -> bool:
        """Lancamentos contabeis nao podem ser deletados — nunca."""
        return False


@admin.register(NumberSequence)
class NumberSequenceAdmin(admin.ModelAdmin):
    """Admin de sequencias de numeracao."""

    list_display = ["key", "last_number", "updated_at"]
    readonly_fields = ["updated_at"]
