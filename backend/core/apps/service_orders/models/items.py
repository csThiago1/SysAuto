"""
Service Orders — Parts, labor, catalog, checklist, and holidays.
"""
from __future__ import annotations

from django.db import models

from apps.authentication.models import PaddockBaseModel

from .service_order import ServiceOrder


# ─── Parts ───────────────────────────────────────────────────────────────────

class ServiceOrderPartQuerySet(models.QuerySet):
    """
    QuerySet customizado para ServiceOrderPart.

    Sobrescreve delete() para garantir que o recalculo de totais da OS
    tambem ocorra em bulk deletes via queryset (ex: .filter(...).delete()),
    pois o Django nao dispara Model.delete() nem sinais post_delete nesse caso.
    """

    def delete(self) -> tuple[int, dict[str, int]]:
        """
        Remove as pecas e recalcula os totais de todas as OS afetadas.

        Returns:
            Tupla (total_deletados, {modelo: contagem}) no padrao do Django.
        """
        so_ids = list(self.values_list("service_order_id", flat=True).distinct())
        result = super().delete()
        for so in ServiceOrder.objects.filter(id__in=so_ids):
            so.recalculate_totals()
        return result


class ServiceOrderPartManager(models.Manager):
    """Manager que usa ServiceOrderPartQuerySet."""

    def get_queryset(self) -> ServiceOrderPartQuerySet:
        """Retorna QuerySet customizado."""
        return ServiceOrderPartQuerySet(self.model, using=self._db)


class ServiceOrderPart(PaddockBaseModel):
    """
    Item de peça de uma OS.
    Pode referenciar um produto do catálogo (opcional) ou ser de texto livre.
    Ao salvar/deletar recalcula parts_total na OS.
    """

    objects = ServiceOrderPartManager()

    service_order = models.ForeignKey(
        ServiceOrder,
        on_delete=models.CASCADE,
        related_name="parts",
        verbose_name="OS",
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="os_parts",
        verbose_name="Produto do catálogo",
    )
    description = models.CharField(max_length=300, verbose_name="Descrição")
    part_number = models.CharField(max_length=100, blank=True, default="", verbose_name="Código da peça")
    ncm = models.CharField(max_length=8, blank=True, default="", verbose_name="NCM", help_text="Código NCM 8 dígitos — obrigatório para NF-e")
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1, verbose_name="Quantidade")
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Preço unitário")
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Desconto")

    # --- Campos WMS / Compras ---
    class Origem(models.TextChoices):
        ESTOQUE = "estoque", "Estoque"
        COMPRA = "compra", "Compra"
        SEGURADORA = "seguradora", "Seguradora"
        MANUAL = "manual", "Manual"

    class TipoQualidade(models.TextChoices):
        GENUINA = "genuina", "Genuína"
        REPOSICAO = "reposicao", "Reposição Original"
        SIMILAR = "similar", "Similar/Paralela"
        USADA = "usada", "Usada/Recondicionada"

    class StatusPeca(models.TextChoices):
        BLOQUEADA = "bloqueada", "Bloqueada no estoque"
        AGUARDANDO_COTACAO = "aguardando_cotacao", "Aguardando Cotação"
        EM_COTACAO = "em_cotacao", "Em Cotação"
        AGUARDANDO_APROVACAO = "aguardando_aprovacao", "Aguardando Aprovação"
        COMPRADA = "comprada", "Comprada — Aguardando Entrega"
        RECEBIDA = "recebida", "Recebida e Bloqueada"
        AGUARDANDO_SEGURADORA = "aguardando_seguradora", "Aguardando Seguradora"
        MANUAL = "manual", "Adicionada manualmente"

    origem = models.CharField(
        max_length=15,
        choices=Origem.choices,
        default=Origem.MANUAL,
    )
    tipo_qualidade = models.CharField(
        max_length=15,
        choices=TipoQualidade.choices,
        blank=True,
        default="",
    )
    status_peca = models.CharField(
        max_length=25,
        choices=StatusPeca.choices,
        default=StatusPeca.MANUAL,
    )
    unidade_fisica = models.ForeignKey(
        "inventory.UnidadeFisica",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="os_parts_wms",
    )
    pedido_compra = models.ForeignKey(
        "purchasing.PedidoCompra",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="os_parts",
        help_text="Pedido de compra quando origem=compra.",
    )
    custo_real = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Custo real (valor_nf). PC-6: só preenchido quando peça chega.",
    )

    # --- Pagador / Origem / Faturamento ---
    class Payer(models.TextChoices):
        INSURER = "insurer", "Seguradora"
        CUSTOMER = "customer", "Cliente/Particular"

    class SourceType(models.TextChoices):
        IMPORT = "import", "Importado"
        COMPLEMENT = "complement", "Complemento Particular"
        MANUAL = "manual", "Manual"

    class BillingStatus(models.TextChoices):
        PENDING = "pending", "Pendente"
        BILLED = "billed", "Faturado"

    payer = models.CharField(
        max_length=20,
        choices=Payer.choices,
        default=Payer.INSURER,
        verbose_name="Pagador",
    )
    source_type = models.CharField(
        max_length=20,
        choices=SourceType.choices,
        default=SourceType.MANUAL,
        verbose_name="Origem do item",
    )
    billing_status = models.CharField(
        max_length=20,
        choices=BillingStatus.choices,
        default=BillingStatus.PENDING,
        verbose_name="Status de faturamento",
    )
    billed_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Data do faturamento",
    )

    class Meta:
        db_table = "service_orders_part"
        ordering = ["created_at"]
        verbose_name = "Peça da OS"
        verbose_name_plural = "Peças da OS"

    def __str__(self) -> str:
        return f"{self.description} (OS #{self.service_order.number})"

    @property
    def total(self) -> float:
        from decimal import Decimal
        return float(Decimal(str(self.quantity)) * Decimal(str(self.unit_price)) - Decimal(str(self.discount)))

    def save(self, *args, **kwargs) -> None:  # type: ignore[override]
        super().save(*args, **kwargs)
        self.service_order.recalculate_totals()

    def delete(self, *args, **kwargs):  # type: ignore[override]
        order = self.service_order
        result = super().delete(*args, **kwargs)
        order.recalculate_totals()
        return result


# ─── Catálogo de Serviços ─────────────────────────────────────────────────────

class ServiceCatalogCategory(models.TextChoices):
    FUNILARIA   = "funilaria",   "Funilaria / Chapeação"
    PINTURA     = "pintura",     "Pintura"
    MECANICA    = "mecanica",    "Mecânica"
    ELETRICA    = "eletrica",    "Elétrica"
    ESTETICA    = "estetica",    "Estética"
    ALINHAMENTO = "alinhamento", "Alinhamento / Balanceamento"
    REVISAO     = "revisao",     "Revisão"
    LAVAGEM     = "lavagem",     "Lavagem / Higienização"
    OUTROS      = "outros",      "Outros"


class ServiceCatalog(PaddockBaseModel):
    """
    Catálogo de serviços reutilizáveis.
    Preço sugerido pré-preenche ServiceOrderLabor mas é sempre editável.
    """

    name = models.CharField(max_length=200, verbose_name="Nome do serviço")
    description = models.TextField(blank=True, default="", verbose_name="Descrição / observação")
    category = models.CharField(
        max_length=20,
        choices=ServiceCatalogCategory.choices,
        default=ServiceCatalogCategory.OUTROS,
        verbose_name="Categoria",
    )
    suggested_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name="Preço sugerido",
    )
    is_active = models.BooleanField(default=True, verbose_name="Ativo")

    class Meta:
        db_table = "service_catalog"
        ordering = ["category", "name"]
        verbose_name = "Serviço do catálogo"
        verbose_name_plural = "Catálogo de serviços"

    def __str__(self) -> str:
        return f"{self.name} ({self.get_category_display()})"


# ─── Labor ───────────────────────────────────────────────────────────────────

class ServiceOrderLaborQuerySet(models.QuerySet):
    """
    QuerySet customizado para ServiceOrderLabor.

    Sobrescreve delete() para garantir que o recalculo de totais da OS
    tambem ocorra em bulk deletes via queryset (ex: .filter(...).delete()),
    pois o Django nao dispara Model.delete() nem sinais post_delete nesse caso.
    """

    def delete(self) -> tuple[int, dict[str, int]]:
        """
        Remove os servicos e recalcula os totais de todas as OS afetadas.

        Returns:
            Tupla (total_deletados, {modelo: contagem}) no padrao do Django.
        """
        so_ids = list(self.values_list("service_order_id", flat=True).distinct())
        result = super().delete()
        for so in ServiceOrder.objects.filter(id__in=so_ids):
            so.recalculate_totals()
        return result


class ServiceOrderLaborManager(models.Manager):
    """Manager que usa ServiceOrderLaborQuerySet."""

    def get_queryset(self) -> ServiceOrderLaborQuerySet:
        """Retorna QuerySet customizado."""
        return ServiceOrderLaborQuerySet(self.model, using=self._db)


class ServiceOrderLabor(PaddockBaseModel):
    """
    Item de mão-de-obra / serviço de uma OS.
    Ao salvar/deletar recalcula services_total na OS.
    """

    objects = ServiceOrderLaborManager()

    service_order = models.ForeignKey(
        ServiceOrder,
        on_delete=models.CASCADE,
        related_name="labor_items",
        verbose_name="OS",
    )
    service_catalog = models.ForeignKey(
        "ServiceCatalog",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="labor_items",
        verbose_name="Serviço do catálogo",
    )
    description = models.CharField(max_length=300, verbose_name="Descrição do serviço")
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=1,
        verbose_name="Quantidade / Horas",
    )
    unit_price = models.DecimalField(
        max_digits=12, decimal_places=2, verbose_name="Valor unitário / Hora"
    )
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Desconto")

    # --- Pagador / Origem / Faturamento ---
    class Payer(models.TextChoices):
        INSURER = "insurer", "Seguradora"
        CUSTOMER = "customer", "Cliente/Particular"

    class SourceType(models.TextChoices):
        IMPORT = "import", "Importado"
        COMPLEMENT = "complement", "Complemento Particular"
        MANUAL = "manual", "Manual"

    class BillingStatus(models.TextChoices):
        PENDING = "pending", "Pendente"
        BILLED = "billed", "Faturado"

    payer = models.CharField(
        max_length=20,
        choices=Payer.choices,
        default=Payer.INSURER,
        verbose_name="Pagador",
    )
    source_type = models.CharField(
        max_length=20,
        choices=SourceType.choices,
        default=SourceType.MANUAL,
        verbose_name="Origem do item",
    )
    billing_status = models.CharField(
        max_length=20,
        choices=BillingStatus.choices,
        default=BillingStatus.PENDING,
        verbose_name="Status de faturamento",
    )
    billed_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Data do faturamento",
    )

    class Meta:
        db_table = "service_orders_labor"
        ordering = ["created_at"]
        verbose_name = "Serviço da OS"
        verbose_name_plural = "Serviços da OS"

    def __str__(self) -> str:
        return f"{self.description} (OS #{self.service_order.number})"

    @property
    def total(self) -> float:
        from decimal import Decimal
        return float(Decimal(str(self.quantity)) * Decimal(str(self.unit_price)) - Decimal(str(self.discount)))

    def save(self, *args, **kwargs) -> None:  # type: ignore[override]
        super().save(*args, **kwargs)
        self.service_order.recalculate_totals()

    def delete(self, *args, **kwargs):  # type: ignore[override]
        order = self.service_order
        result = super().delete(*args, **kwargs)
        order.recalculate_totals()
        return result


# ─── Checklist Item ──────────────────────────────────────────────────────────

class ChecklistItemStatus(models.TextChoices):
    OK = "ok", "OK"
    ATTENTION = "attention", "Atenção"
    CRITICAL = "critical", "Crítico"
    PENDING = "pending", "Pendente"


class ChecklistItem(PaddockBaseModel):
    """Item individual do checklist textual de vistoria (não-fotográfico)."""

    CATEGORY_CHOICES = [
        ("bodywork", "Lataria / Pintura"),
        ("glass", "Vidros"),
        ("lighting", "Iluminação"),
        ("tires", "Pneus"),
        ("interior", "Interior"),
        ("accessories", "Acessórios"),
        ("mechanical", "Mecânico Visual"),
    ]

    CHECKLIST_TYPE_CHOICES = [
        ("entrada", "Entrada"),
        ("acompanhamento", "Acompanhamento"),
        ("saida", "Saída"),
    ]

    service_order = models.ForeignKey(
        ServiceOrder,
        on_delete=models.CASCADE,
        related_name="checklist_items",
        verbose_name="Ordem de Serviço",
    )
    checklist_type = models.CharField(
        max_length=20,
        choices=CHECKLIST_TYPE_CHOICES,
        default="entrada",
        verbose_name="Tipo de Checklist",
    )
    category = models.CharField(
        max_length=30,
        choices=CATEGORY_CHOICES,
        verbose_name="Categoria",
    )
    item_key = models.CharField(
        max_length=60,
        verbose_name="Chave do Item",
        help_text="Identificador único do item dentro da categoria (ex: arranhoes)",
    )
    status = models.CharField(
        max_length=10,
        choices=ChecklistItemStatus.choices,
        default=ChecklistItemStatus.PENDING,
        verbose_name="Status",
    )
    notes = models.TextField(
        blank=True,
        default="",
        verbose_name="Observações",
    )

    class Meta:
        db_table = "service_orders_checklist_item"
        unique_together = [("service_order", "checklist_type", "category", "item_key")]
        ordering = ["category", "item_key"]
        verbose_name = "Item de Checklist"
        verbose_name_plural = "Itens de Checklist"

    def __str__(self) -> str:
        return f"OS #{self.service_order.number} — {self.category}/{self.item_key}: {self.status}"


class Holiday(PaddockBaseModel):
    """Feriado cadastrado pela oficina — impacta a agenda."""

    date = models.DateField(unique=True, verbose_name="Data")
    name = models.CharField(max_length=200, verbose_name="Nome")

    class Meta(PaddockBaseModel.Meta):
        ordering = ["date"]
        verbose_name = "Feriado"
        verbose_name_plural = "Feriados"

    def __str__(self) -> str:
        return f"{self.name} ({self.date})"
