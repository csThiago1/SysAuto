from decimal import Decimal

from django.db import models


class ItemFieldsMixin(models.Model):
    """Schema comum de item (usado por BudgetVersionItem e ServiceOrderVersionItem).

    Abstract — herdar e adicionar FK `version` pro parent apropriado.
    """

    BUCKET_CHOICES = [
        ("IMPACTO", "Impacto"),
        ("SEM_COBERTURA", "Sem Cobertura"),
        ("SOB_ANALISE", "Sob Análise"),
    ]

    PAYER_BLOCK_CHOICES = [
        ("SEGURADORA", "Coberto pela Seguradora"),
        ("COMPLEMENTO_PARTICULAR", "Complemento Particular"),
        ("FRANQUIA", "Franquia"),
        ("PARTICULAR", "Particular (OS particular inteira)"),
    ]

    ITEM_TYPE_CHOICES = [
        ("PART", "Peça"),
        ("SERVICE", "Serviço interno"),
        ("EXTERNAL_SERVICE", "Serviço terceirizado"),
        ("FEE", "Taxa"),
        ("DISCOUNT", "Desconto"),
    ]

    PART_TYPE_CHOICES = [
        ("GENUINA", "Genuína"),
        ("ORIGINAL", "Original"),
        ("OUTRAS_FONTES", "Outras Fontes"),
        ("VERDE", "Verde (reuso)"),
    ]

    SUPPLIER_CHOICES = [
        ("OFICINA", "Oficina"),
        ("SEGURADORA", "Seguradora"),
    ]

    # Classificação
    bucket = models.CharField(max_length=20, choices=BUCKET_CHOICES, default="IMPACTO", db_index=True)
    payer_block = models.CharField(
        max_length=30, choices=PAYER_BLOCK_CHOICES, default="PARTICULAR", db_index=True,
    )
    impact_area = models.IntegerField(null=True, blank=True, db_index=True)
    item_type = models.CharField(max_length=20, choices=ITEM_TYPE_CHOICES, default="PART")

    # Descrição + códigos
    description = models.CharField(max_length=300)
    external_code = models.CharField(max_length=60, blank=True, default="")
    # FK `internal_part` adicionada em evolução futura (Part model fica stub no Ciclo 1)

    # Tipo de peça / fornecimento
    part_type = models.CharField(max_length=20, choices=PART_TYPE_CHOICES, blank=True, default="")
    supplier = models.CharField(max_length=12, choices=SUPPLIER_CHOICES, default="OFICINA")

    # Financeiro
    quantity = models.DecimalField(max_digits=10, decimal_places=3, default=Decimal("1"))
    unit_price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    unit_cost = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    net_price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    # Flags
    flag_abaixo_padrao = models.BooleanField(default=False)
    flag_acima_padrao = models.BooleanField(default=False)
    flag_inclusao_manual = models.BooleanField(default=False)
    flag_codigo_diferente = models.BooleanField(default=False)
    flag_servico_manual = models.BooleanField(default=False)
    flag_peca_da_conta = models.BooleanField(default=False)

    sort_order = models.IntegerField(default=0)

    class Meta:
        abstract = True
