"""
Paddock Solutions — Fiscal App
NF-e, NFC-e e NFS-e: registro e status de emissões
"""
from django.db import models

from apps.authentication.models import PaddockBaseModel


class FiscalDocument(PaddockBaseModel):
    """
    Documento fiscal emitido — NF-e, NFC-e ou NFS-e.
    XMLs autorizados SEMPRE salvos no S3.
    Cancelamento: prazo máximo 24h após emissão.
    """

    class DocumentType(models.TextChoices):
        NFE = "nfe", "NF-e (produto B2B)"
        NFCE = "nfce", "NFC-e (consumidor)"
        NFSE = "nfse", "NFS-e (serviço)"

    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        AUTHORIZED = "authorized", "Autorizada"
        CANCELLED = "cancelled", "Cancelada"
        REJECTED = "rejected", "Rejeitada"

    document_type = models.CharField(max_length=10, choices=DocumentType.choices)
    status = models.CharField(
        max_length=15, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    # Referência da transação (OS ou venda)
    reference_id = models.UUIDField(db_index=True)
    reference_type = models.CharField(max_length=50)  # 'service_order', 'sale'
    # Dados do documento
    key = models.CharField(max_length=44, blank=True, default="", db_index=True)
    number = models.CharField(max_length=20, blank=True, default="")
    series = models.CharField(max_length=5, blank=True, default="")
    xml_s3_key = models.CharField(max_length=500, blank=True, default="")
    total_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # Ambiente SEFAZ
    environment = models.CharField(
        max_length=15, choices=[("homologation", "Homologação"), ("production", "Produção")]
    )
    authorized_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default="")

    class Meta(PaddockBaseModel.Meta):
        db_table = "fiscal_document"
        verbose_name = "Documento Fiscal"
        verbose_name_plural = "Documentos Fiscais"

    def __str__(self) -> str:
        return f"{self.document_type.upper()} #{self.number} — {self.status}"


# ─── NFe de Entrada ────────────────────────────────────────────────────────────


class NFeEntrada(PaddockBaseModel):
    """
    NF-e de entrada (compra de peças/insumos).
    Ao ser validada, gera UnidadeFisica (peças) e LoteInsumo (materiais).
    P10: estoque_gerado garante idempotência — nunca duplicar.
    """

    class Status(models.TextChoices):
        IMPORTADA = "importada", "Importada"
        VALIDADA = "validada", "Validada"
        ESTOQUE_GERADO = "estoque_gerado", "Estoque Gerado"

    chave_acesso = models.CharField(
        max_length=44, blank=True, default="", db_index=True,
        help_text="Chave de 44 dígitos SEFAZ.",
    )
    numero = models.CharField(max_length=20, blank=True, default="")
    serie = models.CharField(max_length=5, blank=True, default="")
    emitente_cnpj = models.CharField(max_length=18, blank=True, default="")
    emitente_nome = models.CharField(max_length=200, blank=True, default="")
    data_emissao = models.DateField(null=True, blank=True)
    valor_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.IMPORTADA, db_index=True
    )
    # P10: flag de idempotência — nunca chamar criar_registros_estoque se já True
    estoque_gerado = models.BooleanField(default=False)
    xml_s3_key = models.CharField(max_length=500, blank=True, default="")
    observacoes = models.TextField(blank=True, default="")

    class Meta(PaddockBaseModel.Meta):
        db_table = "fiscal_nfe_entrada"
        verbose_name = "NF-e de Entrada"
        verbose_name_plural = "NF-es de Entrada"
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["chave_acesso"]),
        ]

    def __str__(self) -> str:
        return f"NF-e Entrada #{self.numero}/{self.serie} — {self.emitente_nome or self.emitente_cnpj}"


class NFeEntradaItem(PaddockBaseModel):
    """
    Item de uma NF-e de entrada. Após reconciliação com o catálogo,
    gera UnidadeFisica (se peca_canonica) ou LoteInsumo (se material_canonico).
    """

    class StatusReconciliacao(models.TextChoices):
        PENDENTE = "pendente", "Aguardando reconciliação"
        PECA = "peca", "Mapeado: Peça"
        INSUMO = "insumo", "Mapeado: Insumo"
        IGNORADO = "ignorado", "Ignorado"

    nfe_entrada = models.ForeignKey(
        NFeEntrada, on_delete=models.CASCADE, related_name="itens"
    )
    numero_item = models.PositiveSmallIntegerField()
    descricao_original = models.CharField(max_length=300)
    codigo_produto_nf = models.CharField(max_length=60, blank=True, default="")
    ncm = models.CharField(max_length=8, blank=True, default="")
    unidade_compra = models.CharField(max_length=20)
    quantidade = models.DecimalField(max_digits=12, decimal_places=4)
    valor_unitario_bruto = models.DecimalField(max_digits=12, decimal_places=4)
    # P1: SEMPRE usar com tributação — nunca valor_unitario_bruto no motor
    valor_unitario_com_tributos = models.DecimalField(max_digits=12, decimal_places=4)
    valor_total_com_tributos = models.DecimalField(max_digits=12, decimal_places=2)
    # Fator de conversão: unidade_compra → unidade_base do MaterialCanonico
    # A5: obrigatório para insumos; 1 para peças
    fator_conversao = models.DecimalField(
        max_digits=10, decimal_places=4, default=1,
        help_text="Quantas unidades_base cabem em 1 unidade_compra.",
    )
    # Reconciliação com catálogo
    peca_canonica = models.ForeignKey(
        "pricing_catalog.PecaCanonica",
        null=True, blank=True, on_delete=models.SET_NULL,
        related_name="nfe_itens",
    )
    material_canonico = models.ForeignKey(
        "pricing_catalog.MaterialCanonico",
        null=True, blank=True, on_delete=models.SET_NULL,
        related_name="nfe_itens",
    )
    codigo_fornecedor = models.ForeignKey(
        "pricing_catalog.CodigoFornecedorPeca",
        null=True, blank=True, on_delete=models.SET_NULL,
        related_name="nfe_itens",
    )
    status_reconciliacao = models.CharField(
        max_length=20,
        choices=StatusReconciliacao.choices,
        default=StatusReconciliacao.PENDENTE,
    )

    class Meta(PaddockBaseModel.Meta):
        db_table = "fiscal_nfe_entrada_item"
        verbose_name = "Item de NF-e Entrada"
        verbose_name_plural = "Itens de NF-e Entrada"
        unique_together = [("nfe_entrada", "numero_item")]

    def __str__(self) -> str:
        return f"Item {self.numero_item} — {self.descricao_original[:40]}"
