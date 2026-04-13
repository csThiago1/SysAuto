"""
Paddock Solutions — Service Orders App
OS, Kanban, checklist de vistoria e log de transições.
"""
import uuid

from django.db import models
from django.utils import timezone

from apps.authentication.models import PaddockBaseModel


# ── Status choices ─────────────────────────────────────────────────────────────

class ServiceOrderStatus(models.TextChoices):
    RECEPTION      = "reception",      "Recepção"
    INITIAL_SURVEY = "initial_survey", "Vistoria Inicial"
    BUDGET         = "budget",         "Orçamento"
    WAITING_AUTH   = "waiting_auth",   "Aguardando Autorização"
    AUTHORIZED     = "authorized",     "Autorizada"
    WAITING_PARTS  = "waiting_parts",  "Aguardando Peças"
    REPAIR         = "repair",         "Reparo"
    MECHANIC       = "mechanic",       "Mecânica"
    BODYWORK       = "bodywork",       "Funilaria"
    PAINTING       = "painting",       "Pintura"
    ASSEMBLY       = "assembly",       "Montagem"
    POLISHING      = "polishing",      "Polimento"
    WASHING        = "washing",        "Lavagem"
    FINAL_SURVEY   = "final_survey",   "Vistoria Final"
    READY          = "ready",          "Pronto para Entrega"
    DELIVERED      = "delivered",      "Entregue"
    CANCELLED      = "cancelled",      "Cancelada"


# Transições válidas do Kanban DS Car (espelhado em packages/types/src/index.ts)
VALID_TRANSITIONS: dict[str, list[str]] = {
    ServiceOrderStatus.RECEPTION:      [ServiceOrderStatus.INITIAL_SURVEY, ServiceOrderStatus.CANCELLED],
    ServiceOrderStatus.INITIAL_SURVEY: [ServiceOrderStatus.BUDGET, ServiceOrderStatus.WAITING_AUTH],
    ServiceOrderStatus.BUDGET:         [ServiceOrderStatus.WAITING_AUTH, ServiceOrderStatus.WAITING_PARTS, ServiceOrderStatus.REPAIR],
    ServiceOrderStatus.WAITING_AUTH:   [ServiceOrderStatus.AUTHORIZED, ServiceOrderStatus.CANCELLED],
    ServiceOrderStatus.AUTHORIZED:     [ServiceOrderStatus.WAITING_PARTS, ServiceOrderStatus.REPAIR],
    ServiceOrderStatus.WAITING_PARTS:  [ServiceOrderStatus.REPAIR],
    ServiceOrderStatus.REPAIR:         [ServiceOrderStatus.MECHANIC, ServiceOrderStatus.BODYWORK, ServiceOrderStatus.POLISHING],
    ServiceOrderStatus.MECHANIC:       [ServiceOrderStatus.BODYWORK, ServiceOrderStatus.POLISHING],
    ServiceOrderStatus.BODYWORK:       [ServiceOrderStatus.PAINTING],
    ServiceOrderStatus.PAINTING:       [ServiceOrderStatus.ASSEMBLY],
    ServiceOrderStatus.ASSEMBLY:       [ServiceOrderStatus.POLISHING],
    ServiceOrderStatus.POLISHING:      [ServiceOrderStatus.WASHING],
    ServiceOrderStatus.WASHING:        [ServiceOrderStatus.FINAL_SURVEY],
    ServiceOrderStatus.FINAL_SURVEY:   [ServiceOrderStatus.READY],
    ServiceOrderStatus.READY:          [ServiceOrderStatus.DELIVERED],
    ServiceOrderStatus.DELIVERED:      [],
    ServiceOrderStatus.CANCELLED:      [],
}


class OSPhotoFolder(models.TextChoices):
    """Pastas predefinidas para organização de fotos da OS."""
    INITIAL_SURVEY  = "vistoria_inicial",  "Vistoria Inicial"
    COMPLEMENT      = "complemento",       "Complemento"
    ENTRY_CHECKLIST = "checklist_entrada", "Checklist de Entrada"
    DOCUMENTS       = "documentos",        "Documentos"
    BUDGETS         = "orcamentos",        "Orçamentos"
    REPAIR_PROGRESS = "acompanhamento",    "Acompanhamento de Reparos"
    FINAL_SURVEY    = "vistoria_final",    "Vistoria Final"


class ServiceOrder(PaddockBaseModel):
    """
    Ordem de Serviço — entidade central do ERP DS Car.
    Reside no schema do tenant.

    Fotos são imutáveis — evidência de sinistro para seguradoras.
    OS de cliente particular exige NF-e/NFS-e ao fechar.
    """

    number = models.PositiveIntegerField(db_index=True, verbose_name="Número da OS")

    # ── Informações de abertura ──────────────────────────────────────────────
    consultant = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.PROTECT,
        related_name="service_orders_as_consultant",
        null=True,
        blank=True,
        verbose_name="Consultor",
    )

    class CustomerType(models.TextChoices):
        INSURER = "insurer", "Seguradora"
        PRIVATE = "private", "Particular"

    customer_type = models.CharField(
        max_length=10,
        choices=CustomerType.choices,
        null=True,
        blank=True,
        verbose_name="Tipo de atendimento",
    )

    class OSType(models.TextChoices):
        BODYWORK   = "bodywork",   "Chapeação"
        WARRANTY   = "warranty",   "Garantia"
        REWORK     = "rework",     "Retrabalho"
        MECHANICAL = "mechanical", "Mecânica"
        AESTHETIC  = "aesthetic",  "Estética"

    os_type = models.CharField(
        max_length=20,
        choices=OSType.choices,
        null=True,
        blank=True,
        verbose_name="Tipo de OS",
    )

    # ── Seguradora (customer_type = 'insurer') ────────────────────────────────
    insurer = models.ForeignKey(
        "insurers.Insurer",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="service_orders",
        verbose_name="Seguradora",
    )

    class InsuredType(models.TextChoices):
        INSURED = "insured", "Segurado"
        THIRD   = "third",   "Terceiro"

    insured_type = models.CharField(
        max_length=10,
        choices=InsuredType.choices,
        null=True,
        blank=True,
        help_text="Segurado ou Terceiro — só quando customer_type='insurer'",
        verbose_name="Tipo de segurado",
    )
    casualty_number = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Número do sinistro",
        verbose_name="Número do sinistro",
    )
    deductible_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Valor da franquia — só quando insured_type='insured'",
        verbose_name="Franquia",
    )
    broker_name = models.CharField(
        max_length=200,
        blank=True,
        default="",
        help_text="Nome do corretor (opcional)",
        verbose_name="Corretor",
    )
    expert = models.ForeignKey(
        "experts.Expert",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="service_orders",
        verbose_name="Perito",
    )
    expert_date = models.DateField(
        null=True, blank=True, help_text="Data de visita do perito", verbose_name="Data do perito"
    )
    survey_date = models.DateField(
        null=True, blank=True, help_text="Data da vistoria (seguradora)", verbose_name="Data da vistoria"
    )
    authorization_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Data/hora de autorização — ALTERA STATUS automaticamente",
        verbose_name="Data de autorização",
    )

    # ── Particular (customer_type = 'private') ────────────────────────────────
    quotation_date = models.DateField(
        null=True, blank=True, help_text="Data de orçamentação (particular)", verbose_name="Data do orçamento"
    )

    # ── Dados do cliente ──────────────────────────────────────────────────────
    customer = models.ForeignKey(
        "persons.Person",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="service_orders",
        verbose_name="Cliente",
    )
    # UUID do UnifiedCustomer (schema público) — não é FK, usado para lookup de detalhes
    customer_uuid = models.UUIDField(
        null=True, blank=True, db_index=True, verbose_name="UUID do cliente"
    )
    customer_name = models.CharField(
        max_length=200, verbose_name="Nome do cliente"
    )  # desnormalizado

    # ── Dados do veículo ──────────────────────────────────────────────────────
    plate = models.CharField(max_length=10, db_index=True, verbose_name="Placa")
    make = models.CharField(max_length=100, default="", verbose_name="Marca")
    model = models.CharField(max_length=100, default="", verbose_name="Modelo")
    vehicle_version = models.CharField(
        max_length=50, blank=True, default="", verbose_name="Versão"
    )
    year = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name="Ano")
    color = models.CharField(max_length=50, default="", verbose_name="Cor")
    chassis = models.CharField(max_length=17, blank=True, default="", verbose_name="Chassi")
    fuel_type = models.CharField(max_length=30, blank=True, default="", verbose_name="Combustível")
    fipe_value = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True, verbose_name="Valor FIPE"
    )
    mileage_in = models.PositiveIntegerField(null=True, blank=True, verbose_name="KM entrada")
    mileage_out = models.PositiveIntegerField(null=True, blank=True, verbose_name="KM saída")

    # ── Entrada do veículo ────────────────────────────────────────────────────
    class VehicleLocation(models.TextChoices):
        IN_TRANSIT = "in_transit", "Em Trânsito"
        WORKSHOP   = "workshop",   "Na Oficina"

    vehicle_location = models.CharField(
        max_length=15,
        choices=VehicleLocation.choices,
        default=VehicleLocation.WORKSHOP,
        verbose_name="Local do veículo",
    )
    entry_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Data/hora de entrada do veículo na oficina",
        verbose_name="Data de entrada",
    )
    service_authorization_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Data/hora de autorização do serviço",
        verbose_name="Autorização do serviço",
    )

    # ── Agendamento e previsão ────────────────────────────────────────────────
    scheduling_date = models.DateTimeField(
        null=True, blank=True, verbose_name="Data de agendamento"
    )
    repair_days = models.PositiveSmallIntegerField(
        null=True, blank=True, help_text="Dias estimados de reparo", verbose_name="Dias de reparo"
    )
    estimated_delivery_date = models.DateField(
        null=True,
        blank=True,
        help_text="Previsão de entrega (calculada: entry + repair_days)",
        verbose_name="Previsão de entrega",
    )
    delivery_date = models.DateTimeField(
        null=True, blank=True, help_text="Data/hora real de entrega", verbose_name="Data de entrega"
    )

    # ── Vistoria final e entrega ──────────────────────────────────────────────
    final_survey_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Data/hora da vistoria final — ALTERA STATUS automaticamente",
        verbose_name="Vistoria final",
    )
    client_delivery_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Data/hora de entrega ao cliente — ALTERA STATUS automaticamente",
        verbose_name="Entrega ao cliente",
    )

    # ── Status Kanban ─────────────────────────────────────────────────────────
    status = models.CharField(
        max_length=20,
        choices=ServiceOrderStatus.choices,
        default=ServiceOrderStatus.RECEPTION,
        db_index=True,
        verbose_name="Status",
    )

    # ── Datas legadas (compatibilidade) ───────────────────────────────────────
    opened_at = models.DateTimeField(auto_now_add=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    estimated_delivery = models.DateTimeField(null=True, blank=True)

    # ── Valores ───────────────────────────────────────────────────────────────
    parts_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    services_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    @property
    def total(self) -> float:
        """Total da OS = peças + serviços - descontos."""
        return float(self.parts_total + self.services_total - self.discount_total)

    # ── NF-e ──────────────────────────────────────────────────────────────────
    nfe_key = models.CharField(max_length=44, blank=True, default="", verbose_name="Chave NF-e")
    nfse_number = models.CharField(
        max_length=20, blank=True, default="", verbose_name="Número NFS-e"
    )

    # ── Financeiro ────────────────────────────────────────────────────────────
    invoice_issued = models.BooleanField(default=False, verbose_name="NF emitida")

    # ── IA ────────────────────────────────────────────────────────────────────
    ai_recommendations = models.JSONField(default=list, blank=True)

    # ── Observações gerais ────────────────────────────────────────────────────
    notes = models.TextField(blank=True, default="", verbose_name="Observações gerais")

    class Meta(PaddockBaseModel.Meta):
        db_table = "service_orders_order"
        unique_together = [("number",)]
        verbose_name = "Ordem de Serviço"
        verbose_name_plural = "Ordens de Serviço"
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["customer_type"]),
            models.Index(fields=["number"]),
            models.Index(fields=["insurer", "casualty_number"]),
            models.Index(fields=["consultant"], name="so_consultant_idx"),
            models.Index(fields=["estimated_delivery_date"], name="so_est_delivery_idx"),
        ]

    def __str__(self) -> str:
        return f"OS #{self.number} — {self.plate} ({self.status})"

    def can_transition_to(self, new_status: str) -> bool:
        """Verifica se a transição de status é válida."""
        allowed = VALID_TRANSITIONS.get(self.status, [])
        return new_status in allowed

    def recalculate_totals(self) -> None:
        """Recalcula parts_total e services_total a partir dos itens da OS."""
        from decimal import Decimal
        from django.db.models import Sum, F, ExpressionWrapper
        from django.db.models import DecimalField as DjDecimalField

        parts_sum = self.parts.aggregate(
            total=Sum(
                ExpressionWrapper(
                    F("quantity") * F("unit_price") - F("discount"),
                    output_field=DjDecimalField(max_digits=14, decimal_places=2),
                )
            )
        )["total"] or Decimal("0.00")

        labor_sum = self.labor_items.aggregate(
            total=Sum(
                ExpressionWrapper(
                    F("quantity") * F("unit_price") - F("discount"),
                    output_field=DjDecimalField(max_digits=14, decimal_places=2),
                )
            )
        )["total"] or Decimal("0.00")

        ServiceOrder.objects.filter(pk=self.pk).update(
            parts_total=parts_sum,
            services_total=labor_sum,
            updated_at=timezone.now(),
        )


class StatusTransitionLog(PaddockBaseModel):
    """Log imutável de transições de status da OS."""

    service_order = models.ForeignKey(
        ServiceOrder,
        on_delete=models.CASCADE,
        related_name="transition_logs",
        verbose_name="OS",
    )
    from_status = models.CharField(max_length=20, verbose_name="Status anterior")
    to_status = models.CharField(max_length=20, verbose_name="Novo status")
    triggered_by_field = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Campo que disparou a transição automática (vazio = manual)",
        verbose_name="Campo gatilho",
    )
    changed_by = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.PROTECT,
        verbose_name="Alterado por",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Log de transição"
        verbose_name_plural = "Logs de transição"

    def __str__(self) -> str:
        return f"OS #{self.service_order.number}: {self.from_status} → {self.to_status}"


class ServiceOrderPhoto(models.Model):
    """
    Foto de OS — imutável após upload.
    Soft delete apenas (is_active=False) — S3 key NUNCA é apagado.
    Fotos são evidência de sinistro para seguradoras.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.CASCADE, related_name="photos"
    )
    folder = models.CharField(
        max_length=30,
        choices=OSPhotoFolder.choices,
        default=OSPhotoFolder.INITIAL_SURVEY,
        verbose_name="Pasta",
    )
    slot = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Slot de vistoria (ex: frente, traseira, lateral_esq)",
        verbose_name="Slot",
    )
    checklist_type = models.CharField(
        max_length=20,
        blank=True,
        default="",
        help_text="Tipo de checklist: entrada, saida ou acompanhamento",
        verbose_name="Tipo de checklist",
    )
    original_stage = models.CharField(
        max_length=30,
        blank=True,
        default="",
        help_text="Valor original do campo stage (legado, para retrocompatibilidade)",
        verbose_name="Stage original",
    )
    caption = models.CharField(
        max_length=200,
        blank=True,
        default="",
        verbose_name="Legenda",
    )
    s3_key = models.CharField(max_length=500, verbose_name="S3 Key")  # imutável
    uploaded_by_id = models.UUIDField()
    uploaded_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)  # soft delete apenas

    class Meta:
        db_table = "service_orders_photo"
        ordering = ["uploaded_at"]
        verbose_name = "Foto de OS"
        verbose_name_plural = "Fotos de OS"
        indexes = [
            models.Index(fields=["service_order", "folder"]),
        ]

    def __str__(self) -> str:
        return f"Foto OS #{self.service_order.number} — {self.folder}"


class ActivityType(models.TextChoices):
    CREATED          = "created",          "OS Aberta"
    STATUS_CHANGED   = "status_changed",   "Status Alterado"
    UPDATED          = "updated",          "Informação Atualizada"
    CUSTOMER_UPDATED = "customer_updated", "Cliente Atualizado"
    VEHICLE_UPDATED  = "vehicle_updated",  "Veículo Atualizado"
    SCHEDULE_UPDATED = "schedule_updated", "Datas/Prazo Atualizados"
    INSURER_UPDATED  = "insurer_updated",  "Seguradora Atualizada"
    REMINDER         = "reminder",         "Lembrete Adicionado"
    FILE_UPLOAD      = "file_upload",      "Arquivo Anexado"
    NOTE_ADDED       = "note_added",       "Nota Adicionada"
    BUDGET_SNAPSHOT  = "budget_snapshot",  "Snapshot de Orçamento"
    CILIA_IMPORT     = "cilia_import",     "Importação Cilia"
    DELIVERY         = "delivery",         "Entrega ao Cliente"
    PART_ADDED       = "part_added",       "Peça Adicionada"
    PART_REMOVED     = "part_removed",     "Peça Removida"
    PART_UPDATED     = "part_updated",     "Peça Editada"
    LABOR_ADDED      = "labor_added",      "Serviço Adicionado"
    LABOR_REMOVED    = "labor_removed",    "Serviço Removido"
    LABOR_UPDATED    = "labor_updated",    "Serviço Editado"
    INVOICE_ISSUED   = "invoice_issued",   "NF Emitida"

class ServiceOrderActivityLog(PaddockBaseModel):
    """Log descritivo e minucioso do histórico da OS."""
    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.CASCADE, related_name="activities"
    )
    user = models.ForeignKey(
        "authentication.GlobalUser", on_delete=models.PROTECT
    )
    activity_type = models.CharField(max_length=30, choices=ActivityType.choices)
    description = models.TextField(help_text="Descrição minuciosa (ex: Thiago mudou X para Y)")
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "service_orders_activity_log"
        ordering = ["-created_at"]
        verbose_name = "Histórico de Atividade"
        verbose_name_plural = "Históricos de Atividade"

    def __str__(self) -> str:
        return f"[{self.created_at.strftime('%d/%m/%Y %H:%M')}] OS #{self.service_order.number} - {self.description}"


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
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1, verbose_name="Quantidade")
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Preço unitário")
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Desconto")

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


class BudgetSnapshot(PaddockBaseModel):
    """
    Snapshot imutável do orçamento da OS em um momento específico.
    Criado automaticamente ao importar via Cilia, ao entregar, ou
    manualmente ao salvar peças/serviços.
    Nunca deve ser editado ou deletado — é histórico auditável.
    """

    class TriggerType(models.TextChoices):
        CILIA_IMPORT  = "cilia_import",  "Importação Cilia"
        MANUAL_SAVE   = "manual_save",   "Salvo Manualmente"
        DELIVERY      = "delivery",      "Entrega"
        PART_CHANGE   = "part_change",   "Alteração de Peças/Serviços"

    service_order = models.ForeignKey(
        ServiceOrder,
        on_delete=models.CASCADE,
        related_name="budget_snapshots",
        verbose_name="OS",
    )
    version = models.PositiveSmallIntegerField(verbose_name="Versão")
    trigger = models.CharField(
        max_length=20,
        choices=TriggerType.choices,
        verbose_name="Gatilho",
    )
    parts_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    services_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    items_snapshot = models.JSONField(
        default=list,
        help_text="Lista serializada de peças e serviços no momento do snapshot",
    )

    class Meta:
        db_table = "service_orders_budget_snapshot"
        unique_together = [("service_order", "version")]
        ordering = ["-version"]
        verbose_name = "Snapshot de Orçamento"
        verbose_name_plural = "Snapshots de Orçamento"

    def __str__(self) -> str:
        return f"OS #{self.service_order.number} — Orçamento v{self.version} ({self.trigger})"

    @property
    def grand_total(self) -> float:
        """Total = peças + serviços - descontos."""
        return float(self.parts_total + self.services_total - self.discount_total)


# ─── Checklist Item (Sprint M4) ───────────────────────────────────────────────

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
