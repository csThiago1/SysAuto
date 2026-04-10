"""
Paddock Solutions — Accounting: Serializers de Período Fiscal
"""
import logging

from rest_framework import serializers

from apps.accounting.models.fiscal_period import FiscalPeriod, FiscalYear

logger = logging.getLogger(__name__)


class FiscalYearSerializer(serializers.ModelSerializer):
    """Serializer de exercício fiscal."""

    closed_by_name = serializers.SerializerMethodField()

    def get_closed_by_name(self, obj: FiscalYear) -> str:
        if obj.closed_by:
            return obj.closed_by.get_full_name()
        return ""

    class Meta:
        model = FiscalYear
        fields = [
            "id",
            "year",
            "start_date",
            "end_date",
            "is_closed",
            "closed_at",
            "closed_by",
            "closed_by_name",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "is_closed",
            "closed_at",
            "closed_by",
            "closed_by_name",
            "is_active",
            "created_at",
            "updated_at",
        ]


class FiscalPeriodListSerializer(serializers.ModelSerializer):
    """Serializer de listagem de períodos fiscais."""

    fiscal_year_label = serializers.SerializerMethodField()
    can_post = serializers.SerializerMethodField()

    def get_fiscal_year_label(self, obj: FiscalPeriod) -> str:
        return str(obj.fiscal_year.year)

    def get_can_post(self, obj: FiscalPeriod) -> bool:
        return obj.can_post()

    class Meta:
        model = FiscalPeriod
        fields = [
            "id",
            "fiscal_year",
            "fiscal_year_label",
            "number",
            "start_date",
            "end_date",
            "is_closed",
            "is_adjustment",
            "can_post",
            "is_active",
        ]
        read_only_fields = fields


class FiscalPeriodDetailSerializer(serializers.ModelSerializer):
    """Serializer de detalhe de período fiscal."""

    fiscal_year_detail = FiscalYearSerializer(source="fiscal_year", read_only=True)
    can_post = serializers.SerializerMethodField()
    label = serializers.SerializerMethodField()

    def get_can_post(self, obj: FiscalPeriod) -> bool:
        return obj.can_post()

    def get_label(self, obj: FiscalPeriod) -> str:
        return str(obj)

    class Meta:
        model = FiscalPeriod
        fields = [
            "id",
            "fiscal_year",
            "fiscal_year_detail",
            "number",
            "start_date",
            "end_date",
            "is_closed",
            "is_adjustment",
            "can_post",
            "label",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "fiscal_year_detail",
            "can_post",
            "label",
            "is_active",
            "created_at",
            "updated_at",
        ]
