"""
Paddock Solutions — Fiscal — Serializers DRF
Motor de Orçamentos (MO) — Sprint MO-5: NF-e Entrada
Ciclo 06C: ManualNfseInputSerializer para emissão manual de NFS-e

Serializers para NFeEntrada, NFeEntradaItem e emissão manual de NFS-e.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from rest_framework import serializers

from apps.fiscal.models import NFeEntrada, NFeEntradaItem

# Module-level imports required for testability with unittest.mock.patch.
# Lazy imports inside functions block @patch — see CLAUDE.md armadilha MO-6.
from apps.persons.models import Person  # noqa: E402


class NFeEntradaItemSerializer(serializers.ModelSerializer):
    peca_nome = serializers.CharField(source="peca_canonica.nome", read_only=True, default=None)
    material_nome = serializers.CharField(
        source="material_canonico.nome", read_only=True, default=None
    )

    class Meta:
        model = NFeEntradaItem
        fields = [
            "id",
            "numero_item",
            "descricao_original",
            "codigo_produto_nf",
            "ncm",
            "unidade_compra",
            "quantidade",
            "valor_unitario_bruto",
            "valor_unitario_com_tributos",
            "valor_total_com_tributos",
            "fator_conversao",
            "peca_canonica_id",
            "peca_nome",
            "material_canonico_id",
            "material_nome",
            "codigo_fornecedor_id",
            "status_reconciliacao",
        ]
        read_only_fields = fields


class NFeEntradaItemReconciliarSerializer(serializers.Serializer):
    """Input para reconciliar um item com peça ou material canônico."""

    peca_canonica_id = serializers.UUIDField(required=False, allow_null=True)
    material_canonico_id = serializers.UUIDField(required=False, allow_null=True)
    codigo_fornecedor_id = serializers.UUIDField(required=False, allow_null=True)
    status_reconciliacao = serializers.ChoiceField(
        choices=NFeEntradaItem.StatusReconciliacao.choices
    )

    def validate(self, data: dict) -> dict:
        status = data.get("status_reconciliacao")
        if status == NFeEntradaItem.StatusReconciliacao.PECA and not data.get("peca_canonica_id"):
            raise serializers.ValidationError("peca_canonica_id obrigatório para status PECA.")
        if status == NFeEntradaItem.StatusReconciliacao.INSUMO and not data.get(
            "material_canonico_id"
        ):
            raise serializers.ValidationError(
                "material_canonico_id obrigatório para status INSUMO."
            )
        return data


class NFeEntradaListSerializer(serializers.ModelSerializer):
    total_itens = serializers.SerializerMethodField()

    class Meta:
        model = NFeEntrada
        fields = [
            "id",
            "chave_acesso",
            "numero",
            "serie",
            "emitente_cnpj",
            "emitente_nome",
            "data_emissao",
            "valor_total",
            "status",
            "estoque_gerado",
            "total_itens",
            "created_at",
        ]
        read_only_fields = fields

    def get_total_itens(self, obj: NFeEntrada) -> int:
        return obj.itens.count()


class NFeEntradaDetailSerializer(serializers.ModelSerializer):
    itens = NFeEntradaItemSerializer(many=True, read_only=True)

    class Meta:
        model = NFeEntrada
        fields = [
            "id",
            "chave_acesso",
            "numero",
            "serie",
            "emitente_cnpj",
            "emitente_nome",
            "data_emissao",
            "valor_total",
            "status",
            "estoque_gerado",
            "xml_s3_key",
            "observacoes",
            "itens",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class NFeEntradaCreateSerializer(serializers.ModelSerializer):
    """Criação manual de NF-e de entrada (sem XML — para importação simplificada)."""

    class Meta:
        model = NFeEntrada
        fields = [
            "chave_acesso",
            "numero",
            "serie",
            "emitente_cnpj",
            "emitente_nome",
            "data_emissao",
            "valor_total",
            "observacoes",
        ]

    def validate_chave_acesso(self, value: str) -> str:
        if value and len(value) not in (0, 44):
            raise serializers.ValidationError("Chave de acesso deve ter 44 dígitos.")
        return value


# ─── Ciclo 06C: Emissão Manual NFS-e ──────────────────────────────────────────


class ManualItemInputSerializer(serializers.Serializer):
    """Item de serviço para emissão manual de NFS-e."""

    descricao = serializers.CharField(min_length=3, max_length=500)
    quantidade = serializers.DecimalField(max_digits=12, decimal_places=4, default=1)
    valor_unitario = serializers.DecimalField(max_digits=14, decimal_places=4)
    valor_desconto = serializers.DecimalField(max_digits=14, decimal_places=2, default=0)


class ManualNfseInputSerializer(serializers.Serializer):
    """Input para emissão manual de NFS-e (sem OS de origem).

    Usado quando um gestor precisa emitir uma NFS-e avulsa para um serviço
    que não está registrado como Ordem de Serviço no sistema.
    """

    destinatario_id = serializers.IntegerField()
    itens = ManualItemInputSerializer(many=True)
    discriminacao = serializers.CharField(max_length=2000)
    codigo_servico_lc116 = serializers.CharField(default="14.01", max_length=10)
    aliquota_iss = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, allow_null=True
    )
    iss_retido = serializers.BooleanField(default=False)
    data_emissao = serializers.DateTimeField(required=False, allow_null=True)
    observacoes_contribuinte = serializers.CharField(
        default="", max_length=2000, allow_blank=True
    )
    manual_reason = serializers.CharField(min_length=5, max_length=255)

    def validate_destinatario_id(self, value: int) -> int:
        """Verifica que Person existe, tem PersonDocument primário e PersonAddress com municipio_ibge."""
        try:
            person = Person.objects.prefetch_related("documents", "addresses").get(pk=value)
        except Person.DoesNotExist:
            raise serializers.ValidationError(f"Person {value} não encontrado.")

        if not person.documents.filter(is_primary=True).exists():
            raise serializers.ValidationError(
                f"Person {value} não tem documento primário cadastrado."
            )
        has_address = person.addresses.filter(
            is_primary=True
        ).exclude(municipio_ibge="").exists() or person.addresses.exclude(
            municipio_ibge=""
        ).exists()
        if not has_address:
            raise serializers.ValidationError(
                f"Person {value} não tem endereço com municipio_ibge."
            )
        return value

    def validate_data_emissao(self, value: datetime | None) -> datetime | None:
        """Validar que data_emissao não é mais de 30 dias no passado."""
        if value is None:
            return value
        now = datetime.now(tz=timezone.utc)
        if hasattr(value, "tzinfo") and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        if value < now - timedelta(days=30):
            raise serializers.ValidationError(
                "data_emissao não pode ser mais de 30 dias no passado."
            )
        return value

    def validate_itens(self, value: list) -> list:
        """Pelo menos 1 item é obrigatório."""
        if not value:
            raise serializers.ValidationError("Pelo menos 1 item é obrigatório.")
        return value
