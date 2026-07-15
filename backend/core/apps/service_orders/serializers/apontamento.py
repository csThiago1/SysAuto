"""Apontamento de Horas — Serializers."""

from __future__ import annotations

from rest_framework import serializers

from apps.authentication.models import GlobalUser
from apps.service_orders.models.capacity import ApontamentoHoras


class TecnicoMiniSerializer(serializers.ModelSerializer):
    """Snapshot minimo do tecnico para listagem de apontamentos."""

    class Meta:
        model = GlobalUser
        fields = ["id", "name"]
        read_only_fields = ["id", "name"]


class ApontamentoSerializer(serializers.ModelSerializer):
    """Serializer para leitura de apontamentos."""

    tecnico = TecnicoMiniSerializer(read_only=True)

    class Meta:
        model = ApontamentoHoras
        fields = [
            "id",
            "tecnico",
            "iniciado_em",
            "encerrado_em",
            "horas_apontadas",
            "observacao",
            "status",
            "created_at",
        ]
        read_only_fields = fields


class ApontamentoGlobalSerializer(ApontamentoSerializer):
    """Apontamento com snapshot da OS — usado na listagem global (tela mobile)."""

    os_id = serializers.UUIDField(source="service_order_id", read_only=True)
    os_numero = serializers.IntegerField(source="service_order.number", read_only=True)
    os_plate = serializers.CharField(source="service_order.plate", read_only=True)
    os_model = serializers.CharField(source="service_order.model", read_only=True)

    class Meta(ApontamentoSerializer.Meta):
        fields = ApontamentoSerializer.Meta.fields + [
            "os_id",
            "os_numero",
            "os_plate",
            "os_model",
        ]
        read_only_fields = fields


class ApontamentoCreateSerializer(serializers.Serializer):
    """Serializer para criacao de apontamentos (timer ou manual)."""

    tecnico_id = serializers.UUIDField()
    iniciado_em = serializers.DateTimeField(required=False)
    encerrado_em = serializers.DateTimeField(required=False)
    observacao = serializers.CharField(required=False, default="", allow_blank=True)

    def validate_tecnico_id(self, value: str) -> str:
        if not GlobalUser.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError("Tecnico nao encontrado.")
        return value

    def validate(self, attrs: dict) -> dict:
        iniciado = attrs.get("iniciado_em")
        encerrado = attrs.get("encerrado_em")
        if encerrado and not iniciado:
            raise serializers.ValidationError(
                {"iniciado_em": "Obrigatorio quando encerrado_em e informado."}
            )
        if encerrado and iniciado and encerrado <= iniciado:
            raise serializers.ValidationError({"encerrado_em": "Deve ser posterior ao inicio."})
        return attrs
