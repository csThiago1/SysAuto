"""
Paddock Solutions — Fiscal — Serializers DRF
Motor de Orçamentos (MO) — Sprint MO-5: NF-e Entrada
Ciclo 06C: ManualNfseInputSerializer, FiscalDocumentSerializer

Serializers para NFeEntrada, NFeEntradaItem, FiscalDocument e emissão manual NFS-e.
"""

from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from apps.fiscal.models import FiscalDocument, NFeEntrada, NFeEntradaItem


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


# ── Ciclo 06C: emissão manual NFS-e ──────────────────────────────────────────


class ManualItemInputSerializer(serializers.Serializer):
    """Item individual de uma NFS-e manual."""

    descricao = serializers.CharField(min_length=3, max_length=500)
    quantidade = serializers.DecimalField(max_digits=12, decimal_places=4, default=1)
    valor_unitario = serializers.DecimalField(max_digits=14, decimal_places=4)
    valor_desconto = serializers.DecimalField(max_digits=14, decimal_places=2, default=0)


class ManualNfseInputSerializer(serializers.Serializer):
    """Entrada de emissão NFS-e manual (sem OS vinculada).

    Requer permissão ADMIN+ (fiscal_admin / OWNER).
    manual_reason é obrigatório — justificativa auditável.
    """

    destinatario_id = serializers.IntegerField()
    itens = ManualItemInputSerializer(many=True, min_length=1)
    discriminacao = serializers.CharField(max_length=2000)
    codigo_servico_lc116 = serializers.CharField(default="14.01", max_length=10)
    aliquota_iss = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, allow_null=True
    )
    iss_retido = serializers.BooleanField(default=False)
    data_emissao = serializers.DateTimeField(
        required=False,
        allow_null=True,
        help_text="None = agora. Se informada, deve ser ≤ 30 dias no passado.",
    )
    observacoes_contribuinte = serializers.CharField(
        default="", max_length=2000, required=False, allow_blank=True
    )
    manual_reason = serializers.CharField(min_length=5, max_length=255)

    def validate_destinatario_id(self, value: int) -> int:
        from apps.persons.models import Person

        try:
            person = Person.objects.prefetch_related("documents", "addresses").get(pk=value)
        except Person.DoesNotExist:
            raise serializers.ValidationError(f"Person pk={value} não encontrada.")

        has_doc = person.documents.filter(
            doc_type__in=["CPF", "CNPJ"]
        ).exists()
        if not has_doc:
            raise serializers.ValidationError(
                f"Person pk={value} não tem CPF ou CNPJ cadastrado."
            )

        has_address = person.addresses.filter(municipio_ibge__gt="").exists()
        if not has_address:
            raise serializers.ValidationError(
                f"Person pk={value} não tem endereço com municipio_ibge preenchido."
            )

        return value

    def validate_data_emissao(self, value):
        if value is None:
            return value
        now = timezone.now()
        if value > now:
            raise serializers.ValidationError("data_emissao não pode ser no futuro.")
        if value < now - timedelta(days=30):
            raise serializers.ValidationError(
                "data_emissao não pode ser mais de 30 dias no passado (spec §8.5)."
            )
        return value


# ── NF-e de Produto (Ciclo 07A) ──────────────────────────────────────────────


class ManualNfeItemInputSerializer(serializers.Serializer):
    """Item de NF-e de produto para emissão manual."""

    codigo_produto = serializers.CharField(max_length=60, required=False, default="")
    descricao = serializers.CharField(min_length=2, max_length=120)
    ncm = serializers.CharField(min_length=8, max_length=10)
    unidade = serializers.CharField(max_length=6, default="UN")
    quantidade = serializers.DecimalField(max_digits=12, decimal_places=4)
    valor_unitario = serializers.DecimalField(max_digits=14, decimal_places=4)
    valor_desconto = serializers.DecimalField(
        max_digits=14, decimal_places=2, default=0, required=False
    )

    def validate_ncm(self, value: str) -> str:
        digits = value.replace(".", "").strip()
        if len(digits) < 8:
            raise serializers.ValidationError(
                "NCM deve ter 8 dígitos numéricos. Ex: 87089990."
            )
        return digits


class ManualNfeInputSerializer(serializers.Serializer):
    """Payload de emissão manual de NF-e de produto (ADMIN+)."""

    destinatario_id = serializers.IntegerField()
    itens = ManualNfeItemInputSerializer(many=True, allow_empty=False)
    forma_pagamento = serializers.ChoiceField(
        choices=["01", "03", "04", "99"], default="01",
        help_text="01=dinheiro, 03=crédito, 04=débito, 99=outros.",
    )
    observacoes = serializers.CharField(
        max_length=2000, default="", required=False, allow_blank=True
    )
    manual_reason = serializers.CharField(min_length=5, max_length=255)
    # Override opcional de alíquotas (se não informado, usa defaults do FiscalConfigModel)
    cst_icms = serializers.CharField(max_length=3, required=False, default="")
    icms_aliquota = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, allow_null=True, default=None
    )

    def validate_destinatario_id(self, value: int) -> int:
        from apps.persons.models import Person, PersonDocument

        try:
            person = Person.objects.prefetch_related("addresses").get(pk=value)
        except Person.DoesNotExist:
            raise serializers.ValidationError(f"Person pk={value} não encontrada.")

        has_doc = PersonDocument.objects.filter(person=person, is_primary=True).exists()
        if not has_doc:
            raise serializers.ValidationError(
                f"Person pk={value} sem documento primário (CPF/CNPJ)."
            )

        has_address = person.addresses.filter(is_primary=True).exists()
        if not has_address:
            raise serializers.ValidationError(
                f"Person pk={value} sem endereço primário."
            )

        return value


# ── Ciclo 06C: FiscalDocument output serializers ─────────────────────────────


class FiscalDocumentListSerializer(serializers.ModelSerializer):
    """Serializer enxuto para listagem de documentos fiscais."""

    amount = serializers.DecimalField(source="total_value", max_digits=12, decimal_places=2, read_only=True)
    numero = serializers.CharField(source="number", read_only=True)
    service_order_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = FiscalDocument
        fields = [
            "id",
            "document_type",
            "status",
            "ref",
            "environment",
            "service_order_id",
            "amount",
            "valor_impostos",
            "key",
            "numero",
            "caminho_xml",
            "caminho_pdf",
            "mensagem_sefaz",
            "natureza_rejeicao",
            "created_at",
            "authorized_at",
            "cancelled_at",
        ]
        read_only_fields = fields


class FiscalDocumentSerializer(serializers.ModelSerializer):
    """Serializer completo para detalhe de documento fiscal."""

    class Meta:
        model = FiscalDocument
        fields = [
            "id",
            "document_type",
            "status",
            "ref",
            "service_order",
            "destinatario",
            "total_value",
            "valor_impostos",
            "key",
            "number",
            "caminho_xml",
            "caminho_pdf",
            "manual_reason",
            "created_at",
            "authorized_at",
            "cancelled_at",
            "mensagem_sefaz",
            "natureza_rejeicao",
        ]
        read_only_fields = fields
