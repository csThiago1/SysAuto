"""
Paddock Solutions — Accounting: Serializers de Lancamento Contabil
"""
import logging
from decimal import Decimal

from rest_framework import serializers

from apps.accounting.models.journal_entry import (
    JournalEntry,
    JournalEntryLine,
    JournalEntryOrigin,
)
from apps.accounting.services.journal_entry_service import JournalEntryService

from .chart_of_accounts import ChartOfAccountListSerializer
from .cost_center import CostCenterListSerializer

logger = logging.getLogger(__name__)


class JournalEntryLineSerializer(serializers.ModelSerializer):
    """Serializer de leitura de linha de lancamento — com dados da conta e CC."""

    account = ChartOfAccountListSerializer(read_only=True)
    cost_center = CostCenterListSerializer(read_only=True)

    class Meta:
        model = JournalEntryLine
        fields = [
            "id",
            "account",
            "cost_center",
            "debit_amount",
            "credit_amount",
            "description",
            "document_number",
        ]
        read_only_fields = fields


class JournalEntryLineCreateSerializer(serializers.Serializer):
    """Serializer de criacao de linha — aceita UUIDs para FK."""

    account_id = serializers.UUIDField(
        help_text="UUID da conta analítica (ChartOfAccount)."
    )
    cost_center_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="UUID do centro de custo (opcional).",
    )
    debit_amount = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        min_value=Decimal("0.00"),
    )
    credit_amount = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        min_value=Decimal("0.00"),
    )
    description = serializers.CharField(
        max_length=300, required=False, allow_blank=True, default=""
    )
    document_number = serializers.CharField(
        max_length=100, required=False, allow_blank=True, default=""
    )

    def validate(self, data: dict) -> dict:
        debit = data.get("debit_amount", Decimal("0.00"))
        credit = data.get("credit_amount", Decimal("0.00"))
        if debit > 0 and credit > 0:
            raise serializers.ValidationError(
                "Linha não pode ter débito e crédito simultaneamente."
            )
        if debit == 0 and credit == 0:
            raise serializers.ValidationError(
                "Linha deve ter débito OU crédito com valor positivo."
            )
        return data


class JournalEntryListSerializer(serializers.ModelSerializer):
    """Serializer de listagem de lancamentos contabeis."""

    origin_display = serializers.CharField(
        source="get_origin_display", read_only=True
    )
    total_debit = serializers.DecimalField(
        max_digits=18, decimal_places=2, read_only=True
    )
    total_credit = serializers.DecimalField(
        max_digits=18, decimal_places=2, read_only=True
    )
    fiscal_period_label = serializers.SerializerMethodField()

    def get_fiscal_period_label(self, obj: JournalEntry) -> str:
        return str(obj.fiscal_period)

    class Meta:
        model = JournalEntry
        fields = [
            "id",
            "number",
            "description",
            "competence_date",
            "origin",
            "origin_display",
            "is_approved",
            "is_reversed",
            "fiscal_period",
            "fiscal_period_label",
            "total_debit",
            "total_credit",
            "created_at",
        ]
        read_only_fields = fields


class JournalEntryDetailSerializer(serializers.ModelSerializer):
    """Serializer de detalhe com linhas, aprovador e status de balanceamento."""

    origin_display = serializers.CharField(
        source="get_origin_display", read_only=True
    )
    lines = JournalEntryLineSerializer(many=True, read_only=True)
    total_debit = serializers.DecimalField(
        max_digits=18, decimal_places=2, read_only=True
    )
    total_credit = serializers.DecimalField(
        max_digits=18, decimal_places=2, read_only=True
    )
    is_balanced = serializers.BooleanField(read_only=True)
    approved_by_name = serializers.SerializerMethodField()
    fiscal_period_label = serializers.SerializerMethodField()

    def get_approved_by_name(self, obj: JournalEntry) -> str:
        if obj.approved_by:
            return obj.approved_by.get_full_name()
        return ""

    def get_fiscal_period_label(self, obj: JournalEntry) -> str:
        return str(obj.fiscal_period)

    class Meta:
        model = JournalEntry
        fields = [
            "id",
            "number",
            "description",
            "competence_date",
            "document_date",
            "origin",
            "origin_display",
            "is_approved",
            "is_reversed",
            "reversal_entry",
            "fiscal_period",
            "fiscal_period_label",
            "approved_by",
            "approved_by_name",
            "total_debit",
            "total_credit",
            "is_balanced",
            "lines",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class JournalEntryCreateSerializer(serializers.Serializer):
    """
    Serializer de criacao de lancamento.

    Delega para JournalEntryService.create_entry() — nunca salva direto.
    """

    description = serializers.CharField(max_length=500)
    competence_date = serializers.DateField()
    document_date = serializers.DateField(required=False, allow_null=True)
    origin = serializers.ChoiceField(choices=JournalEntryOrigin.choices)
    lines = JournalEntryLineCreateSerializer(many=True)

    def validate_lines(self, value: list) -> list:
        if not value:
            raise serializers.ValidationError(
                "O lançamento deve ter pelo menos uma linha."
            )
        return value

    def create(self, validated_data: dict) -> JournalEntry:
        """Cria lançamento via JournalEntryService."""
        user = self.context["request"].user
        lines = [dict(line) for line in validated_data.pop("lines")]
        # Converte UUIDs para string para compatibilidade com o service
        for line in lines:
            if "account_id" in line:
                line["account_id"] = str(line["account_id"])
            if line.get("cost_center_id"):
                line["cost_center_id"] = str(line["cost_center_id"])

        entry = JournalEntryService.create_entry(
            description=validated_data["description"],
            competence_date=validated_data["competence_date"],
            origin=validated_data["origin"],
            lines=lines,
            user=user,
            auto_approve=False,
        )
        return entry
