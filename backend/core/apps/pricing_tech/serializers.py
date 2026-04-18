"""
Paddock Solutions — Pricing Tech — Serializers
Motor de Orçamentos (MO) — Sprint MO-4: Ficha Técnica Versionada

Serializers com RBAC e validações:
- FichaTecnicaMaoObraSerializer: somente leitura/criação (sem PATCH — Armadilha P1)
- FichaTecnicaInsumoSerializer: somente leitura/criação (sem PATCH — Armadilha P1)
- FichaTecnicaServicoListSerializer: campos resumidos para list
- FichaTecnicaServicoDetailSerializer: inclui maos_obra e insumos nested (read-only)
- NovaVersaoInputSerializer: input para criar nova versão via endpoint
  - Valida que só existe uma ficha ativa com tipo_pintura=NULL por serviço (Armadilha P3)
- ResolverInputSerializer: input para resolver ficha por servico+tipo_pintura
"""
from decimal import Decimal

from rest_framework import serializers

from apps.pricing_tech.models import (
    FichaTecnicaInsumo,
    FichaTecnicaMaoObra,
    FichaTecnicaServico,
)


# ────────────────────────────────────────────────────────────────────────────
# Nested read-only: Mão de Obra
# ────────────────────────────────────────────────────────────────────────────


class FichaTecnicaMaoObraSerializer(serializers.ModelSerializer):
    """Serializer de FichaTecnicaMaoObra — somente leitura e criação.

    Armadilha P1: sem PATCH/PUT — os itens são imutáveis por design.
    Mudanças devem criar nova versão da FichaTecnicaServico.
    """

    categoria_codigo = serializers.CharField(source="categoria.codigo", read_only=True)
    categoria_nome = serializers.CharField(source="categoria.nome", read_only=True)

    class Meta:
        model = FichaTecnicaMaoObra
        fields = [
            "id",
            "categoria",
            "categoria_codigo",
            "categoria_nome",
            "horas",
            "afetada_por_tamanho",
            "observacao",
        ]
        read_only_fields = ["id", "categoria_codigo", "categoria_nome"]


# ────────────────────────────────────────────────────────────────────────────
# Nested read-only: Insumo
# ────────────────────────────────────────────────────────────────────────────


class FichaTecnicaInsumoSerializer(serializers.ModelSerializer):
    """Serializer de FichaTecnicaInsumo — somente leitura e criação.

    Armadilha P1: sem PATCH/PUT — os itens são imutáveis por design.
    Mudanças devem criar nova versão da FichaTecnicaServico.
    """

    material_codigo = serializers.CharField(source="material_canonico.codigo", read_only=True)
    material_nome = serializers.CharField(source="material_canonico.nome", read_only=True)

    class Meta:
        model = FichaTecnicaInsumo
        fields = [
            "id",
            "material_canonico",
            "material_codigo",
            "material_nome",
            "quantidade",
            "unidade",
            "afetado_por_tamanho",
            "observacao",
        ]
        read_only_fields = ["id", "material_codigo", "material_nome"]


# ────────────────────────────────────────────────────────────────────────────
# FichaTecnicaServico — List
# ────────────────────────────────────────────────────────────────────────────


class FichaTecnicaServicoListSerializer(serializers.ModelSerializer):
    """Serializer resumido para listagem de FichaTecnicaServico."""

    servico_nome = serializers.CharField(source="servico.nome", read_only=True)
    servico_codigo = serializers.CharField(source="servico.codigo", read_only=True)
    tipo_pintura_nome = serializers.CharField(
        source="tipo_pintura.nome", read_only=True, default=None
    )
    tipo_pintura_codigo = serializers.CharField(
        source="tipo_pintura.codigo", read_only=True, default=None
    )
    criada_por_email = serializers.CharField(
        source="criada_por.email", read_only=True, default=None
    )

    class Meta:
        model = FichaTecnicaServico
        fields = [
            "id",
            "servico",
            "servico_nome",
            "servico_codigo",
            "versao",
            "tipo_pintura",
            "tipo_pintura_nome",
            "tipo_pintura_codigo",
            "is_active",
            "criada_em",
            "criada_por",
            "criada_por_email",
            "motivo_nova_versao",
        ]
        read_only_fields = fields


# ────────────────────────────────────────────────────────────────────────────
# FichaTecnicaServico — Detail
# ────────────────────────────────────────────────────────────────────────────


class FichaTecnicaServicoDetailSerializer(serializers.ModelSerializer):
    """Serializer detalhado para FichaTecnicaServico, com maos_obra e insumos nested.

    Todos os campos são read-only — fichas são imutáveis após criação.
    Para criar nova versão, use o endpoint nova-versao/.
    """

    servico_nome = serializers.CharField(source="servico.nome", read_only=True)
    servico_codigo = serializers.CharField(source="servico.codigo", read_only=True)
    tipo_pintura_nome = serializers.CharField(
        source="tipo_pintura.nome", read_only=True, default=None
    )
    tipo_pintura_codigo = serializers.CharField(
        source="tipo_pintura.codigo", read_only=True, default=None
    )
    criada_por_email = serializers.CharField(
        source="criada_por.email", read_only=True, default=None
    )
    maos_obra = FichaTecnicaMaoObraSerializer(many=True, read_only=True)
    insumos = FichaTecnicaInsumoSerializer(many=True, read_only=True)

    class Meta:
        model = FichaTecnicaServico
        fields = [
            "id",
            "servico",
            "servico_nome",
            "servico_codigo",
            "versao",
            "tipo_pintura",
            "tipo_pintura_nome",
            "tipo_pintura_codigo",
            "is_active",
            "criada_em",
            "criada_por",
            "criada_por_email",
            "observacoes",
            "motivo_nova_versao",
            "maos_obra",
            "insumos",
        ]
        read_only_fields = fields


# ────────────────────────────────────────────────────────────────────────────
# Input: Mão de Obra para criação de nova versão
# ────────────────────────────────────────────────────────────────────────────


class MaoObraInputSerializer(serializers.Serializer):
    """Input de uma linha de mão de obra na criação de nova versão."""

    categoria = serializers.UUIDField(help_text="UUID da CategoriaMaoObra.")
    horas = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        min_value=Decimal("0.01"),
        help_text="Horas de mão de obra para esta categoria.",
    )
    afetada_por_tamanho = serializers.BooleanField(default=True)
    observacao = serializers.CharField(max_length=200, allow_blank=True, default="")


# ────────────────────────────────────────────────────────────────────────────
# Input: Insumo para criação de nova versão
# ────────────────────────────────────────────────────────────────────────────


class InsumoInputSerializer(serializers.Serializer):
    """Input de uma linha de insumo na criação de nova versão."""

    material_canonico = serializers.UUIDField(help_text="UUID do MaterialCanonico.")
    quantidade = serializers.DecimalField(
        max_digits=9,
        decimal_places=4,
        min_value=Decimal("0.0001"),
        help_text="Quantidade do material necessária.",
    )
    unidade = serializers.CharField(
        max_length=20,
        help_text="Deve corresponder à unidade_base do material canônico.",
    )
    afetado_por_tamanho = serializers.BooleanField(default=True)
    observacao = serializers.CharField(max_length=200, allow_blank=True, default="")


# ────────────────────────────────────────────────────────────────────────────
# Input: Nova Versão
# ────────────────────────────────────────────────────────────────────────────


class NovaVersaoInputSerializer(serializers.Serializer):
    """Input para criação de nova versão de ficha técnica.

    Armadilha P3: valida que só existe uma ficha ativa com tipo_pintura=NULL
    por serviço. PostgreSQL permite múltiplas rows com NULL em unique_together,
    portanto a unicidade deve ser aplicada aqui no serializer.

    O campo servico_id é opcional quando o endpoint é usado como action
    detail (o servico_id vem do objeto — ver views.py). Quando presente
    no body, é validado normalmente.
    """

    servico_id = serializers.UUIDField(
        required=False,
        help_text="UUID do ServicoCanonico. Obrigatório na action de lista; inferido na action detail.",
    )
    tipo_pintura_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        default=None,
        help_text="UUID do TipoPintura. NULL = ficha genérica (Armadilha P3: só uma ativa por serviço).",
    )
    maos_obra = MaoObraInputSerializer(
        many=True,
        help_text="Lista de mãos de obra da nova versão.",
    )
    insumos = InsumoInputSerializer(
        many=True,
        help_text="Lista de insumos da nova versão.",
    )
    motivo = serializers.CharField(
        min_length=10,
        max_length=300,
        help_text="Motivo da nova versão (mín. 10 caracteres).",
    )

    def validate(self, data: dict) -> dict:
        """Valida unicidade de ficha genérica ativa por serviço (Armadilha P3).

        Só executa quando tipo_pintura_id é None (ficha genérica).
        O servico_id pode vir do body ou do contexto (view passa via context).
        """
        servico_id = data.get("servico_id") or self.context.get("servico_id")
        tipo_pintura_id = data.get("tipo_pintura_id")

        # Só valida unicidade de genérica quando tipo_pintura_id=None
        if tipo_pintura_id is None and servico_id:
            # Recupera o ID da ficha atual (para excluí-la da checagem quando for nova-versao em cima de uma existente)
            ficha_atual_id = self.context.get("ficha_atual_id")

            qs = FichaTecnicaServico.objects.filter(
                servico_id=servico_id,
                tipo_pintura__isnull=True,
                is_active=True,
            )
            if ficha_atual_id:
                qs = qs.exclude(pk=ficha_atual_id)

            if qs.exists():
                raise serializers.ValidationError(
                    {
                        "tipo_pintura_id": (
                            "Já existe uma ficha técnica genérica ativa para este serviço. "
                            "Use o endpoint nova-versao/ para substituí-la."
                        )
                    }
                )

        return data


# ────────────────────────────────────────────────────────────────────────────
# Input: Resolver ficha
# ────────────────────────────────────────────────────────────────────────────


class ResolverInputSerializer(serializers.Serializer):
    """Input para resolver a ficha técnica ativa de um serviço.

    Retorna a FichaResolvida com mãos de obra e insumos,
    já com fallback para ficha genérica quando tipo_pintura não encontrado.
    """

    servico_id = serializers.UUIDField(
        help_text="UUID do ServicoCanonico.",
    )
    tipo_pintura_codigo = serializers.CharField(
        required=False,
        allow_null=True,
        default=None,
        max_length=50,
        help_text="Código do TipoPintura (ex: 'SOLIDA'). Omitir para ficha genérica.",
    )
