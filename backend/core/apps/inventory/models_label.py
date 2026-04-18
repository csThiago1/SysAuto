"""
Paddock Solutions — Inventory App — Etiquetagem ZPL
Motor de Orçamentos (MO) — Sprint MO-5: Estoque Físico + NF-e Entrada

ImpressoraEtiqueta: config de impressora ZPL (Zebra/Argox/Elgin).
EtiquetaImpressa: log imutável de cada etiqueta enviada.
"""
from django.db import models
from django.db.models import Q

from apps.authentication.models import PaddockBaseModel
from apps.inventory.models_physical import LoteInsumo, UnidadeFisica


class ImpressoraEtiqueta(PaddockBaseModel):
    """
    Configuração de impressora ZPL.
    P6: impressão sempre via Celery (ZPLService.imprimir é síncrono/HTTP).
    P9: endpoint pode ser IP interno da LAN da oficina.
    """

    MODELO_CHOICES = [
        ("zebra_gk420", "Zebra GK420t"),
        ("zebra_zd220", "Zebra ZD220"),
        ("argox_os214", "Argox OS-214"),
        ("elgin_l42", "Elgin L42"),
        ("outro", "Outro"),
    ]

    nome = models.CharField(max_length=50)
    modelo = models.CharField(max_length=20, choices=MODELO_CHOICES, default="zebra_gk420")
    endpoint = models.CharField(
        max_length=200,
        help_text="Ex: http://10.0.0.15:9100 (Zebra direct print).",
    )
    largura_mm = models.PositiveIntegerField(default=50)
    altura_mm = models.PositiveIntegerField(default=30)

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_impressora_etiqueta"
        verbose_name = "Impressora de Etiqueta"
        verbose_name_plural = "Impressoras de Etiqueta"

    def __str__(self) -> str:
        return f"{self.nome} ({self.get_modelo_display()}) — {self.endpoint}"


class EtiquetaImpressa(PaddockBaseModel):
    """
    Log imutável de impressão — auditoria.
    XOR: unidade_fisica OU lote_insumo (nunca ambos, nunca nenhum).
    """

    unidade_fisica = models.ForeignKey(
        UnidadeFisica, null=True, blank=True,
        on_delete=models.CASCADE,
        related_name="etiquetas",
    )
    lote_insumo = models.ForeignKey(
        LoteInsumo, null=True, blank=True,
        on_delete=models.CASCADE,
        related_name="etiquetas",
    )
    impressora = models.ForeignKey(
        ImpressoraEtiqueta, on_delete=models.PROTECT,
        related_name="etiquetas",
    )
    zpl_payload = models.TextField()
    impressa_por = models.ForeignKey(
        "authentication.GlobalUser", null=True, on_delete=models.SET_NULL,
    )

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_etiqueta_impressa"
        verbose_name = "Etiqueta Impressa"
        verbose_name_plural = "Etiquetas Impressas"
        constraints = [
            models.CheckConstraint(
                check=(
                    Q(unidade_fisica__isnull=False, lote_insumo__isnull=True)
                    | Q(unidade_fisica__isnull=True, lote_insumo__isnull=False)
                ),
                name="etiqueta_xor_unidade_lote",
            )
        ]

    def __str__(self) -> str:
        ref = self.unidade_fisica or self.lote_insumo
        return f"Etiqueta {ref} — {self.created_at}"
