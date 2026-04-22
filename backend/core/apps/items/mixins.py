"""
Paddock Solutions — Items App — Mixin de Campos

ItemFieldsMixin fornece todos os campos compartilhados pelos itens de linha
de OS versionada. Usado como base abstrata pelos modelos concretos de item.
"""
from __future__ import annotations

from decimal import Decimal

from django.db import models


class ItemFieldsMixin(models.Model):
    """
    Mixin abstrato com os campos canônicos de um item de linha de OS.

    Todos os modelos concretos de item (ItemOS, OrcamentoItem, etc.)
    devem herdar deste mixin para garantir consistência de estrutura.
    """

    # ── Classificação / roteamento ────────────────────────────────────────────

    class Bucket(models.TextChoices):
        IMPACTO = "IMPACTO", "Impacto"
        SEM_COBERTURA = "SEM_COBERTURA", "Sem Cobertura"
        SOB_ANALISE = "SOB_ANALISE", "Sob Análise"

    class PayerBlock(models.TextChoices):
        SEGURADORA = "SEGURADORA", "Seguradora"
        COMPLEMENTO_PARTICULAR = "COMPLEMENTO_PARTICULAR", "Complemento Particular"
        FRANQUIA = "FRANQUIA", "Franquia"
        PARTICULAR = "PARTICULAR", "Particular"

    class ItemType(models.TextChoices):
        PART = "PART", "Peça"
        SERVICE = "SERVICE", "Serviço"
        EXTERNAL_SERVICE = "EXTERNAL_SERVICE", "Serviço Externo"
        FEE = "FEE", "Taxa"
        DISCOUNT = "DISCOUNT", "Desconto"

    class PartType(models.TextChoices):
        GENUINA = "GENUINA", "Genuína"
        ORIGINAL = "ORIGINAL", "Original"
        OUTRAS_FONTES = "OUTRAS_FONTES", "Outras Fontes"
        VERDE = "VERDE", "Verde (Reciclada)"

    class Supplier(models.TextChoices):
        OFICINA = "OFICINA", "Oficina"
        SEGURADORA = "SEGURADORA", "Seguradora"

    bucket = models.CharField(
        max_length=20,
        choices=Bucket.choices,
        default=Bucket.IMPACTO,
        db_index=True,
        verbose_name="Bucket",
    )
    payer_block = models.CharField(
        max_length=30,
        choices=PayerBlock.choices,
        default=PayerBlock.PARTICULAR,
        db_index=True,
        verbose_name="Bloco Pagador",
    )
    impact_area = models.IntegerField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="Área de Impacto",
        help_text="ID da área de impacto do veículo (ex: capô, porta dianteira esquerda).",
    )

    # ── Identificação do item ─────────────────────────────────────────────────

    item_type = models.CharField(
        max_length=20,
        choices=ItemType.choices,
        default=ItemType.PART,
        verbose_name="Tipo de Item",
    )
    description = models.CharField(
        max_length=300,
        verbose_name="Descrição",
    )
    external_code = models.CharField(
        max_length=60,
        blank=True,
        default="",
        verbose_name="Código Externo",
        help_text="Código da peça/serviço no sistema da seguradora ou fornecedor.",
    )
    part_type = models.CharField(
        max_length=20,
        choices=PartType.choices,
        blank=True,
        default="",
        verbose_name="Tipo de Peça",
        help_text="Aplicável apenas quando item_type=PART.",
    )
    supplier = models.CharField(
        max_length=20,
        choices=Supplier.choices,
        default=Supplier.OFICINA,
        verbose_name="Fornecedor",
    )

    # ── Quantidades e preços ──────────────────────────────────────────────────

    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=Decimal("1"),
        verbose_name="Quantidade",
    )
    unit_price = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="Preço Unitário",
    )
    unit_cost = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Custo Unitário",
        help_text="Custo de aquisição da peça/insumo. Pode ser null para serviços.",
    )
    discount_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="Desconto (%)",
        help_text="Percentual de desconto sobre o preço unitário.",
    )
    net_price = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="Preço Líquido",
        help_text="Preço unitário após desconto × quantidade.",
    )

    # ── Flags de auditoria / divergência ─────────────────────────────────────

    flag_abaixo_padrao = models.BooleanField(
        default=False,
        verbose_name="Abaixo do Padrão",
        help_text="Item precificado abaixo da tabela de referência.",
    )
    flag_acima_padrao = models.BooleanField(
        default=False,
        verbose_name="Acima do Padrão",
        help_text="Item precificado acima da tabela de referência.",
    )
    flag_inclusao_manual = models.BooleanField(
        default=False,
        verbose_name="Inclusão Manual",
        help_text="Item incluído manualmente (não gerado pelo motor de orçamento).",
    )
    flag_codigo_diferente = models.BooleanField(
        default=False,
        verbose_name="Código Diferente",
        help_text="Código do item difere do código da seguradora.",
    )
    flag_servico_manual = models.BooleanField(
        default=False,
        verbose_name="Serviço Manual",
        help_text="Serviço inserido manualmente sem catálogo canônico.",
    )
    flag_peca_da_conta = models.BooleanField(
        default=False,
        verbose_name="Peça da Conta",
        help_text="Peça cujo custo é responsabilidade da seguradora (da conta do sinistro).",
    )

    # ── Ordenação ─────────────────────────────────────────────────────────────

    sort_order = models.IntegerField(
        default=0,
        verbose_name="Ordem de Exibição",
    )

    class Meta:
        abstract = True
