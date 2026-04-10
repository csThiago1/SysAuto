"""
Paddock Solutions — Accounting: Serializers de Plano de Contas
"""
import logging
from decimal import Decimal

from rest_framework import serializers

from apps.accounting.models.chart_of_accounts import ChartOfAccount
from apps.accounting.services.balance_service import AccountBalanceService

logger = logging.getLogger(__name__)


class ChartOfAccountListSerializer(serializers.ModelSerializer):
    """Serializer de listagem — dados essenciais para tabelas."""

    account_type_display = serializers.CharField(
        source="get_account_type_display", read_only=True
    )
    nature_display = serializers.CharField(
        source="get_nature_display", read_only=True
    )

    class Meta:
        model = ChartOfAccount
        fields = [
            "id",
            "code",
            "name",
            "account_type",
            "account_type_display",
            "nature",
            "nature_display",
            "is_analytical",
            "level",
            "is_active",
        ]
        read_only_fields = fields


class ChartOfAccountDetailSerializer(serializers.ModelSerializer):
    """Serializer de detalhe — todos os campos, filhos (depth=1) e saldo calculado."""

    account_type_display = serializers.CharField(
        source="get_account_type_display", read_only=True
    )
    nature_display = serializers.CharField(
        source="get_nature_display", read_only=True
    )
    parent_code = serializers.SerializerMethodField()
    children = ChartOfAccountListSerializer(many=True, read_only=True)
    balance = serializers.SerializerMethodField()
    full_path = serializers.SerializerMethodField()

    def get_parent_code(self, obj: ChartOfAccount) -> str | None:
        """Retorna o código da conta pai."""
        return obj.parent.code if obj.parent else None

    def get_balance(self, obj: ChartOfAccount) -> Decimal:
        """Saldo calculado via AccountBalanceService (sem filtro de período)."""
        return AccountBalanceService.get_balance(obj)

    def get_full_path(self, obj: ChartOfAccount) -> str:
        """Retorna o caminho completo da conta na hierarquia."""
        return obj.get_full_path()

    class Meta:
        model = ChartOfAccount
        fields = [
            "id",
            "code",
            "name",
            "parent",
            "parent_code",
            "account_type",
            "account_type_display",
            "nature",
            "nature_display",
            "is_analytical",
            "level",
            "sped_code",
            "accepts_cost_center",
            "is_active",
            "full_path",
            "children",
            "balance",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "level",
            "parent_code",
            "full_path",
            "children",
            "balance",
            "created_at",
            "updated_at",
        ]


class ChartOfAccountCreateSerializer(serializers.ModelSerializer):
    """Serializer de criação — valida código único e nível derivado do parent."""

    parent_code = serializers.CharField(
        write_only=True,
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Código da conta pai (ex: '4.1.02'). Null para contas raiz.",
    )

    def validate_code(self, value: str) -> str:
        """Valida unicidade e formato do código."""
        import re

        if not re.match(r"^\d+(\.\d+)*$", value):
            raise serializers.ValidationError(
                "Código inválido. Use a máscara: 1, 1.1, 1.1.01, 1.1.01.001"
            )
        return value

    def validate(self, data: dict) -> dict:
        """Resolve parent_code para FK e deriva o nível."""
        parent_code = data.pop("parent_code", None)
        if parent_code:
            try:
                parent = ChartOfAccount.objects.get(code=parent_code)
                data["parent"] = parent
                data["level"] = parent.level + 1
            except ChartOfAccount.DoesNotExist:
                raise serializers.ValidationError(
                    {"parent_code": f"Conta pai com código '{parent_code}' não encontrada."}
                )
        else:
            data["parent"] = None
            data["level"] = len(data.get("code", "").split("."))
        return data

    class Meta:
        model = ChartOfAccount
        fields = [
            "code",
            "name",
            "parent_code",
            "account_type",
            "nature",
            "is_analytical",
            "sped_code",
            "accepts_cost_center",
        ]


class _ChartOfAccountRecursiveSerializer(serializers.ModelSerializer):
    """Serializer recursivo interno para árvore hierárquica (depth=2)."""

    children = serializers.SerializerMethodField()

    def get_children(self, obj: ChartOfAccount) -> list:
        """Retorna filhos da conta de forma recursiva."""
        children_qs = obj.children.filter(is_active=True).order_by("code")
        return _ChartOfAccountRecursiveSerializer(
            children_qs, many=True, context=self.context
        ).data

    class Meta:
        model = ChartOfAccount
        fields = [
            "id",
            "code",
            "name",
            "account_type",
            "nature",
            "is_analytical",
            "level",
            "is_active",
            "children",
        ]


class ChartOfAccountTreeSerializer(_ChartOfAccountRecursiveSerializer):
    """Serializer para retornar a árvore hierárquica completa."""

    pass
