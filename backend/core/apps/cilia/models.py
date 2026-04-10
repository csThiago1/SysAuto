"""
Paddock Solutions — Cilia Integration App
Módulo responsável por importar ordens de serviço (orçamentos) do Cilia Web Service.
"""
from django.db import models
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
