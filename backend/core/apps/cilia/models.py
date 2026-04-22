"""
Paddock Solutions — Cilia Integration App
Módulo responsável por importar ordens de serviço (orçamentos) do Cilia Web Service.
"""
from django.db import models
from django.utils import timezone
from apps.authentication.models import PaddockBaseModel

class OrcamentoCilia(PaddockBaseModel):
    """
    Orçamento espelhado da Cilia API.
    Guarda uma cópia local (inclusive payload completo) para histórico,
    sem perda de dados e evitando excesso de consultas externas.
    """
    
    # Identificadores Cilia
    budget_id = models.BigIntegerField()
    budget_version_id = models.BigIntegerField(unique=True)
    casualty_number = models.CharField(max_length=50, verbose_name="Número do sinistro")
    budget_number = models.IntegerField(verbose_name="Número do Orçamento")
    version_number = models.IntegerField(default=1, verbose_name="Versão do Orçamento")
    status = models.CharField(max_length=50)

    # Veículo
    license_plate = models.CharField(max_length=10)
    vehicle_model = models.CharField(max_length=200)
    vehicle_brand = models.CharField(max_length=100)
    vehicle_year = models.IntegerField(null=True)
    vehicle_chassi = models.CharField(max_length=50, blank=True)
    vehicle_color = models.CharField(max_length=50, blank=True)

    # Cliente
    client_name = models.CharField(max_length=200)
    client_document = models.CharField(max_length=20, blank=True)
    client_phone = models.CharField(max_length=30, blank=True)

    # Seguradora
    insurer_name = models.CharField(max_length=200)
    insurer_cnpj = models.CharField(max_length=20, blank=True)

    # Parecer (Conclusion)
    conclusion_key = models.CharField(max_length=50, blank=True)
    conclusion_title = models.CharField(max_length=200, blank=True)
    conclusion_at = models.DateTimeField(null=True)

    # Totais financeiros e horas
    total_liquid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_pieces = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_workforce = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    franchise = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Datas originais
    budget_created_at = models.DateTimeField(null=True)
    version_created_at = models.DateTimeField(null=True)
    
    # Payload completo (raw JSON retornado pela API da Cilia)
    raw_data = models.JSONField(default=dict)

    class Meta:
        ordering = ["-version_created_at"]
        verbose_name = "Orçamento Cilia"
        verbose_name_plural = "Orçamentos Cilia"
        indexes = [
            models.Index(fields=["casualty_number", "budget_number"]),
        ]

    def __str__(self):
        return f"Sinistro {self.casualty_number} / Orçamento {self.budget_number}.{self.version_number} - {self.license_plate}"


class ImportAttempt(models.Model):
    """Tentativa de importação — auditoria completa.

    Cada chamada à API/upload de arquivo gera um ImportAttempt, sucesso ou falha.
    Usado para debug, rate limiting e histórico.
    """

    SOURCE_CHOICES = [
        ("cilia", "Cilia API"),
        ("hdi", "HDI HTML"),
        ("xml_porto", "XML Porto"),
        ("xml_azul", "XML Azul"),
        ("xml_itau", "XML Itaú"),
    ]

    TRIGGER_CHOICES = [
        ("polling", "Polling Automático"),
        ("upload_manual", "Upload Manual"),
        ("user_requested", "Solicitado pelo Usuário"),
    ]

    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, db_index=True)
    trigger = models.CharField(max_length=30, choices=TRIGGER_CHOICES)

    # Input que motivou a tentativa
    casualty_number = models.CharField(max_length=40, blank=True, default="", db_index=True)
    budget_number = models.CharField(max_length=40, blank=True, default="")
    version_number = models.IntegerField(null=True, blank=True)

    # Resultado
    http_status = models.IntegerField(null=True, blank=True)
    parsed_ok = models.BooleanField(default=False)
    error_message = models.TextField(blank=True, default="")
    error_type = models.CharField(max_length=60, blank=True, default="")

    # Payload bruto
    raw_payload = models.JSONField(null=True, blank=True)
    raw_hash = models.CharField(max_length=64, blank=True, default="", db_index=True)

    # Vínculo com OS criada/atualizada
    service_order = models.ForeignKey(
        "service_orders.ServiceOrder",
        on_delete=models.SET_NULL, null=True, blank=True, related_name="import_attempts",
    )
    # Vínculo com Orçamento importado (quando disponível)
    orcamento = models.ForeignKey(
        "quotes.Orcamento",
        on_delete=models.SET_NULL, null=True, blank=True, related_name="import_attempts",
    )
    duplicate_of = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="duplicates",
    )

    # Auditoria
    created_at = models.DateTimeField(default=timezone.now, db_index=True, editable=False)
    created_by = models.CharField(max_length=120, blank=True, default="Sistema")

    # Timing
    duration_ms = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["source", "-created_at"], name="ia_source_created_idx"),
            models.Index(
                fields=["casualty_number", "budget_number", "-created_at"],
                name="ia_casualty_budget_idx",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"{self.source} {self.casualty_number}/{self.budget_number}"
            f" v{self.version_number or '?'} @ {self.created_at:%Y-%m-%d %H:%M}"
        )
