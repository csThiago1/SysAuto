"""
Paddock Solutions — Fiscal App
NF-e, NFC-e e NFS-e: registro e status de emissões

MO-5: FiscalDocument (stub), NFeEntrada, NFeEntradaItem
06B:  FiscalConfigModel, FiscalDocumentItem, FiscalEvent
06C:  FiscalDocument spec §5.2 (campos additive), FiscalDocumentItem spec §5.3
"""

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.authentication.models import PaddockBaseModel


class FiscalDocument(PaddockBaseModel):
    """
    Documento fiscal emitido — NF-e, NFC-e ou NFS-e.
    XMLs autorizados SEMPRE salvos no S3.
    Cancelamento: prazo máximo 24h após emissão.

    06C: campos additive (todos null/blank compatíveis com registros MO-5).
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
    # Referência legada (MO-5) — deprecated, mantidos para retrocompatibilidade até 06D
    reference_id = models.UUIDField(db_index=True, null=True, blank=True)
    reference_type = models.CharField(max_length=50, blank=True, default="")  # 'service_order', 'sale'
    # Dados do documento
    key = models.CharField(max_length=44, blank=True, default="", db_index=True)
    number = models.CharField(max_length=20, blank=True, default="")
    series = models.CharField(max_length=5, blank=True, default="")
    xml_s3_key = models.CharField(max_length=500, blank=True, default="")
    total_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # Ambiente SEFAZ
    environment = models.CharField(
        max_length=15,
        choices=[("homologation", "Homologação"), ("production", "Produção")],
        blank=True,
        default="homologacao",
    )
    authorized_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default="")

    # ── 06C: spec §5.2 — campos additive ────────────────────────────────────
    # ref: identificador de idempotência Focus (ex: "12345678-NFSE-20260424-000001")
    ref = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        unique=True,
        db_index=True,
        help_text="Ref de idempotência enviada à Focus.",
    )
    config = models.ForeignKey(
        "fiscal.FiscalConfigModel",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="documents",
    )
    service_order = models.ForeignKey(
        "service_orders.ServiceOrder",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="fiscal_documents",
    )
    destinatario = models.ForeignKey(
        "persons.Person",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="fiscal_received",
    )
    protocolo = models.CharField(max_length=50, blank=True, default="")
    caminho_xml = models.CharField(max_length=500, blank=True, default="")
    caminho_pdf = models.CharField(max_length=500, blank=True, default="")
    caminho_xml_cancelamento = models.CharField(max_length=500, blank=True, default="")
    payload_enviado = models.JSONField(
        default=dict, blank=True, help_text="Snapshot do payload enviado à Focus."
    )
    ultima_resposta = models.JSONField(
        default=dict, blank=True, help_text="Snapshot da última resposta da Focus."
    )
    mensagem_sefaz = models.TextField(blank=True, default="")
    natureza_rejeicao = models.CharField(max_length=255, blank=True, default="")
    valor_impostos = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    documento_referenciado = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="devolucoes_complementares",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    manual_reason = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Justificativa obrigatória para NFS-e manual (sem OS).",
    )

    class Meta(PaddockBaseModel.Meta):
        db_table = "fiscal_document"
        verbose_name = "Documento Fiscal"
        verbose_name_plural = "Documentos Fiscais"
        constraints = [
            models.CheckConstraint(
                name="fiscal_doc_manual_needs_reason",
                check=Q(service_order__isnull=False) | ~Q(manual_reason=""),
            ),
        ]
        indexes = [
            models.Index(fields=["status", "document_type"], name="fiscal_doc_status_type_idx"),
            models.Index(fields=["service_order", "document_type"], name="fiscal_doc_os_type_idx"),
        ]

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
        max_length=44,
        blank=True,
        default="",
        db_index=True,
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
        return (
            f"NF-e Entrada #{self.numero}/{self.serie} — {self.emitente_nome or self.emitente_cnpj}"
        )


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

    nfe_entrada = models.ForeignKey(NFeEntrada, on_delete=models.CASCADE, related_name="itens")
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
        max_digits=10,
        decimal_places=4,
        default=1,
        help_text="Quantas unidades_base cabem em 1 unidade_compra.",
    )
    # Reconciliação com catálogo
    peca_canonica = models.ForeignKey(
        "pricing_catalog.PecaCanonica",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="nfe_itens",
    )
    material_canonico = models.ForeignKey(
        "pricing_catalog.MaterialCanonico",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="nfe_itens",
    )
    codigo_fornecedor = models.ForeignKey(
        "pricing_catalog.CodigoFornecedorPeca",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
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


# ─── 06B: Emissor + Itens + Auditoria ─────────────────────────────────────────


class FiscalConfigModel(models.Model):
    """
    Configuração do emissor fiscal (CNPJ, sequenciadores, token Focus).

    Nome: FiscalConfigModel para evitar conflito com FiscalAppConfig (AppConfig).
    seq_* são incrementados atomicamente via select_for_update — nunca editar
    manualmente pelo admin.

    db_table: "fiscal_config" (nome limpo sem o sufixo "model").
    """

    cnpj = models.CharField(
        max_length=14, unique=True, help_text="CNPJ sem formatação (14 dígitos)."
    )
    inscricao_estadual = models.CharField(max_length=20, blank=True, default="")
    inscricao_municipal = models.CharField(max_length=20, blank=True, default="")
    razao_social = models.CharField(max_length=200)
    nome_fantasia = models.CharField(max_length=200, blank=True, default="")
    regime_tributario = models.PositiveSmallIntegerField(
        default=1,
        help_text="1=Simples Nacional, 2=Simples Nacional Excesso, 3=Normal",
    )
    endereco = models.JSONField(default=dict, blank=True, help_text="Endereço completo do emissor.")
    # Token Focus: plain text aqui — EncryptedField no Ciclo 06C
    focus_token = models.CharField(max_length=255, blank=True, default="")
    aliquota_iss_default = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=2,
        help_text="Alíquota ISS padrão (%). Manaus: 2%.",
    )
    # Sequenciadores atômicos — NUNCA editar manualmente
    seq_nfse = models.PositiveIntegerField(default=1)
    seq_nfe = models.PositiveIntegerField(default=1)
    seq_nfce = models.PositiveIntegerField(default=1)
    serie_rps = models.CharField(max_length=5, default="1")
    environment = models.CharField(
        max_length=15,
        choices=[("homologacao", "Homologação"), ("producao", "Produção")],
        default="homologacao",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fiscal_config"
        verbose_name = "Configuração Fiscal"
        verbose_name_plural = "Configurações Fiscais"

    def __str__(self) -> str:
        return f"{self.razao_social} — CNPJ {self.cnpj}"


class FiscalDocumentItem(models.Model):
    """
    Item fiscal de um FiscalDocument (linha de NF-e/NFC-e/NFS-e).

    source_budget_item e source_os_item usam db_constraint=False para permitir
    audit trail mesmo após deleção dos documentos originais (padrão MO-6).
    """

    document = models.ForeignKey(
        FiscalDocument,
        on_delete=models.CASCADE,
        related_name="itens",
    )
    numero_item = models.PositiveSmallIntegerField()
    descricao = models.CharField(max_length=500)
    ncm = models.CharField(max_length=8, blank=True, default="")
    cfop = models.CharField(max_length=5, blank=True, default="")
    unidade = models.CharField(max_length=6, blank=True, default="")
    quantidade = models.DecimalField(max_digits=12, decimal_places=4, default=1)
    valor_unitario = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    valor_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    valor_desconto = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # Alíquotas (%)
    aliquota_iss = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    aliquota_icms = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    aliquota_pis = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    aliquota_cofins = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    # Rastreabilidade — UUIDs sem FK: audit trail após deleção de documentos originais
    source_budget_item = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text="UUID do OrcamentoIntervencao de origem (sem FK forçada).",
    )
    source_os_item = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text="UUID do OSIntervencao de origem (sem FK forçada).",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    # ── 06C: spec §5.3 — campos additive ────────────────────────────────────
    codigo_servico_lc116 = models.CharField(
        max_length=10, blank=True, default="", help_text="Item LC 116 para NFS-e (ex: '14.01')."
    )
    valor_bruto = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    valor_liquido = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    # ISS
    valor_iss = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    iss_retido = models.BooleanField(default=False)
    # ICMS (campos para NF-e produto)
    icms_cst = models.CharField(max_length=5, blank=True, default="")
    icms_aliquota = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    icms_valor = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # PIS / COFINS
    pis_cst = models.CharField(max_length=5, blank=True, default="")
    pis_valor = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cofins_cst = models.CharField(max_length=5, blank=True, default="")
    cofins_valor = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        db_table = "fiscal_document_item"
        verbose_name = "Item de Documento Fiscal"
        verbose_name_plural = "Itens de Documentos Fiscais"
        unique_together = [("document", "numero_item")]

    def __str__(self) -> str:
        return f"Item {self.numero_item} — {self.descricao[:50]}"


class FiscalEvent(models.Model):
    """
    Log de auditoria imutável de todas as chamadas HTTP e webhooks fiscais.

    Cada POST/GET/DELETE para a API Focus gera um FiscalEvent.
    Webhooks recebidos também geram FiscalEvent.
    document pode ser NULL em webhooks de documentos desconhecidos.

    Regra: NUNCA deletar FiscalEvent — log é evidência fiscal.
    """

    class EventType(models.TextChoices):
        EMIT_REQUEST = "EMIT_REQUEST", "Requisição de Emissão"
        EMIT_RESPONSE = "EMIT_RESPONSE", "Resposta de Emissão"
        CONSULT = "CONSULT", "Consulta de Status"
        CANCEL_REQUEST = "CANCEL_REQUEST", "Requisição de Cancelamento"
        WEBHOOK = "WEBHOOK", "Webhook Recebido"
        CCE = "CCE", "Carta de Correção"
        INUTILIZACAO = "INUTILIZACAO", "Inutilização"

    class TriggeredBy(models.TextChoices):
        USER = "USER", "Usuário (automatizado)"
        USER_MANUAL = "USER_MANUAL", "Usuário (manual ad-hoc)"
        CELERY = "CELERY", "Tarefa Celery"
        WEBHOOK = "WEBHOOK", "Webhook Focus"

    # FK nullable — webhooks orphan não têm document
    document = models.ForeignKey(
        FiscalDocument,
        on_delete=models.CASCADE,
        related_name="events",
        null=True,
        blank=True,
    )
    event_type = models.CharField(max_length=20, choices=EventType.choices, db_index=True)
    http_status = models.PositiveSmallIntegerField(null=True, blank=True)
    payload = models.JSONField(default=dict, blank=True, help_text="Payload enviado ou recebido.")
    response = models.JSONField(default=dict, blank=True, help_text="Resposta da API Focus.")
    duration_ms = models.PositiveIntegerField(null=True, blank=True)
    error_type = models.CharField(max_length=60, blank=True, default="")
    error_message = models.TextField(blank=True, default="")
    triggered_by = models.CharField(
        max_length=15,
        choices=TriggeredBy.choices,
        default=TriggeredBy.USER,
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "fiscal_event"
        verbose_name = "Evento Fiscal"
        verbose_name_plural = "Eventos Fiscais"
        indexes = [
            models.Index(fields=["document", "event_type"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self) -> str:
        doc_ref = f" [{self.document_id}]" if self.document_id else " [orphan]"
        return f"{self.event_type}{doc_ref} @ {self.created_at}"
