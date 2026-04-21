from django.db import models


class ItemOperationType(models.Model):
    """Tipo de operação aplicada a um item: TROCA / RECUPERACAO / OVERLAP / PINTURA / R_I / MONTAGEM_DESMONTAGEM / DNC.

    Extensível via admin sem migration.
    """

    code = models.CharField(max_length=40, unique=True, db_index=True)
    label = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "code"]
        verbose_name = "Tipo de Operação"
        verbose_name_plural = "Tipos de Operação"

    def __str__(self) -> str:
        return f"{self.code} — {self.label}"


class LaborCategory(models.Model):
    """Categoria de mão-de-obra: FUNILARIA / PINTURA / MECANICA / ELETRICA / TAPECARIA / ACABAMENTO / VIDRACARIA / REPARACAO / SERVICOS.

    Extensível via admin sem migration.
    """

    code = models.CharField(max_length=40, unique=True, db_index=True)
    label = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "code"]
        verbose_name = "Categoria de MO"
        verbose_name_plural = "Categorias de MO"

    def __str__(self) -> str:
        return f"{self.code} — {self.label}"
