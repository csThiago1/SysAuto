from decimal import Decimal

from django.db import models

from apps.items.mixins import ItemFieldsMixin
from apps.persons.models import Person


class Insurer(models.Model):
    """Catálogo de seguradoras reconhecidas pelo sistema."""

    IMPORT_SOURCES = [
        ("cilia_api", "Cilia API"),
        ("html_upload", "HTML Upload"),
        ("xml_upload", "XML Upload"),
    ]

    code = models.CharField(max_length=40, unique=True, db_index=True)
    name = models.CharField(max_length=120)
    cnpj = models.CharField(max_length=18, blank=True, default="")
    import_source = models.CharField(max_length=20, choices=IMPORT_SOURCES, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class ServiceOrder(models.Model):
    """OS — particular OU seguradora. Kanban 15 estados."""

    CUSTOMER_TYPES = [
        ("PARTICULAR", "Particular"),
        ("SEGURADORA", "Seguradora"),
    ]

    STATUS_CHOICES = [
        ("reception", "Recepção"),
        ("initial_survey", "Vistoria Inicial"),
        ("budget", "Orçamento (aprovação de versão)"),
        ("waiting_parts", "Aguardando Peças"),
        ("repair", "Reparo"),
        ("mechanic", "Mecânica"),
        ("bodywork", "Funilaria"),
        ("painting", "Pintura"),
        ("assembly", "Montagem"),
        ("polishing", "Polimento"),
        ("washing", "Lavagem"),
        ("final_survey", "Vistoria Final"),
        ("ready", "Pronto para Entrega"),
        ("delivered", "Entregue"),
        ("cancelled", "Cancelada"),
    ]

    os_number = models.CharField(max_length=30, unique=True, db_index=True)
    customer = models.ForeignKey(Person, on_delete=models.PROTECT, related_name="service_orders")
    customer_type = models.CharField(
        max_length=12, choices=CUSTOMER_TYPES, default="PARTICULAR", db_index=True,
    )

    vehicle_plate = models.CharField(max_length=10, db_index=True)
    vehicle_description = models.CharField(max_length=200)

    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="reception", db_index=True)
    previous_status = models.CharField(max_length=30, blank=True, default="")

    # Se particular, aponta pro Budget que originou (lazy ref — budgets app criado na Task 10)
    source_budget = models.ForeignKey(
        "budgets.Budget",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="resulting_orders",
    )

    # Se seguradora
    insurer = models.ForeignKey(Insurer, on_delete=models.PROTECT, null=True, blank=True)
    casualty_number = models.CharField(max_length=40, blank=True, default="", db_index=True)
    external_budget_number = models.CharField(max_length=40, blank=True, default="")
    policy_number = models.CharField(max_length=40, blank=True, default="")
    policy_item = models.CharField(max_length=20, blank=True, default="")
    franchise_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    total_value = models.DecimalField(  # DEPRECATED: remover no Ciclo 2
        max_digits=12, decimal_places=2, default=Decimal("0"),
    )
    notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    legacy_databox_id = models.CharField(max_length=40, blank=True, default="", db_index=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["insurer", "casualty_number"],
                condition=models.Q(casualty_number__gt=""),
                name="uq_insurer_casualty",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.os_number} - {self.vehicle_plate}"

    @property
    def active_version(self) -> "ServiceOrderVersion | None":
        return self.versions.order_by("-version_number").first()


class ServiceOrderStatusHistory(models.Model):
    service_order = models.ForeignKey(ServiceOrder, on_delete=models.CASCADE, related_name="status_history")
    from_status = models.CharField(max_length=30)
    to_status = models.CharField(max_length=30)
    changed_by = models.CharField(max_length=120, blank=True, default="Sistema")
    notes = models.TextField(blank=True, default="")
    changed_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-changed_at"]


class ServiceOrderVersion(models.Model):
    """Snapshot imutável por versão. Particular: v1, v2, v3... Seguradora: espelha 821980.1 / .2."""

    STATUS_CHOICES = [
        ("pending", "Pendente"),
        ("approved", "Aprovada"),
        ("rejected", "Rejeitada"),
        ("analisado", "Analisado"),
        ("autorizado", "Autorizado"),
        ("correcao", "Em Correção"),
        ("em_analise", "Em Análise"),
        ("negado", "Negado"),
        ("superseded", "Superada"),
    ]

    SOURCE_CHOICES = [
        ("manual", "Manual"),
        ("budget_approval", "Da aprovação de Budget"),
        ("cilia", "Cilia API"),
        ("hdi", "HDI HTML"),
        ("xml_porto", "XML Porto"),
        ("xml_azul", "XML Azul"),
        ("xml_itau", "XML Itaú"),
    ]

    service_order = models.ForeignKey(ServiceOrder, on_delete=models.CASCADE, related_name="versions")
    version_number = models.IntegerField()

    external_version = models.CharField(max_length=40, blank=True, default="")
    external_numero_vistoria = models.CharField(max_length=60, blank=True, default="")
    external_integration_id = models.CharField(max_length=40, blank=True, default="")

    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default="manual")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True)

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    discount_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    net_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    labor_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    parts_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    total_seguradora = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    total_complemento_particular = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    total_franquia = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    content_hash = models.CharField(max_length=64, blank=True, default="")
    raw_payload_s3_key = models.CharField(max_length=500, blank=True, default="")

    hourly_rates = models.JSONField(default=dict, blank=True)
    global_discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.CharField(max_length=120, blank=True, default="")
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("service_order", "version_number")]
        ordering = ["-version_number"]

    def __str__(self) -> str:
        return self.status_label

    @property
    def status_label(self) -> str:
        if self.external_version:
            return f"{self.external_version} — {self.get_status_display()}"
        return f"v{self.version_number} — {self.get_status_display()}"


class ServiceOrderVersionItem(ItemFieldsMixin):
    """Item da versão da OS. Imutável após aprovar."""

    version = models.ForeignKey(ServiceOrderVersion, on_delete=models.CASCADE, related_name="items")

    class Meta:
        ordering = ["sort_order", "id"]
