"""
Paddock Solutions — Pricing Tech — Fichas Técnicas de Serviços
Motor de Orçamentos (MO) — Sprint MO-4: Ficha Técnica Versionada

Modelos para fichas técnicas versionadas de serviços canônicos.
Cada versão define a mão de obra e insumos necessários para executar
um serviço, opcionalmente especializada por tipo de pintura.

Armadilhas:
- A1: Fichas não são imutáveis, mas mudanças criam nova versão.
      Nunca atualizar FichaTecnicaServico existente via UPDATE.
- P3: tipo_pintura=NULL significa "genérica". PostgreSQL permite múltiplas
      rows com NULL em unique_together — validar no serializer que só existe
      uma ficha ativa com tipo_pintura=NULL por serviço.
- P1: Sem PATCH/PUT em FichaTecnicaMaoObra e FichaTecnicaInsumo
      (imutáveis por design — pertencem a uma versão da ficha).
"""
import logging
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models

from apps.authentication.models import PaddockBaseModel

logger = logging.getLogger(__name__)


class FichaTecnicaServico(PaddockBaseModel):
    """
    Versão de ficha técnica de um serviço canônico.

    Cada mudança nos tempos ou insumos de um serviço deve criar uma nova
    versão (versao + 1) em vez de atualizar a ficha existente. A ficha
    ativa é aquela com is_active=True e versao mais alta para o par
    (servico, tipo_pintura).

    tipo_pintura=NULL representa a ficha genérica, aplicada quando não
    há variação específica por tipo de pintura. PostgreSQL permite múltiplos
    NULLs em colunas únicas — a unicidade de ficha ativa genérica deve ser
    validada no serializer.
    """

    servico = models.ForeignKey(
        "pricing_catalog.ServicoCanonico",
        on_delete=models.PROTECT,
        related_name="fichas",
        verbose_name="Serviço canônico",
    )
    versao = models.PositiveIntegerField(
        verbose_name="Versão",
        help_text="Incrementado a cada revisão da ficha. Nunca reutilizar.",
    )
    tipo_pintura = models.ForeignKey(
        "pricing_profile.TipoPintura",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="fichas_tecnicas",
        verbose_name="Tipo de pintura",
        help_text="Opcional — ficha distinta por tipo de pintura. NULL = genérica.",
    )
    # is_active herdado de PaddockBaseModel
    criada_em = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Criada em",
    )
    criada_por = models.ForeignKey(
        "authentication.GlobalUser",
        null=True,
        on_delete=models.SET_NULL,
        related_name="fichas_tecnicas_criadas",
        verbose_name="Criada por",
    )
    observacoes = models.TextField(
        blank=True,
        verbose_name="Observações",
    )
    motivo_nova_versao = models.CharField(
        max_length=300,
        blank=True,
        verbose_name="Motivo da nova versão",
        help_text="Descreve por que esta versão foi criada (ex: 'ajuste de tempo após treinamento').",
    )

    class Meta:
        verbose_name = "Ficha Técnica de Serviço"
        verbose_name_plural = "Fichas Técnicas de Serviços"
        unique_together = [("servico", "versao", "tipo_pintura")]
        indexes = [
            models.Index(
                fields=["servico", "is_active", "tipo_pintura"],
                name="pt_ficha_servico_ativo_idx",
            ),
        ]

    def __str__(self) -> str:
        tipo = self.tipo_pintura.nome if self.tipo_pintura_id else "Genérica"
        return f"Ficha {self.servico} v{self.versao} [{tipo}]"


class FichaTecnicaMaoObra(PaddockBaseModel):
    """
    Linha de mão de obra de uma versão de ficha técnica.

    Define a quantidade de horas de uma categoria de mão de obra necessárias
    para executar o serviço da ficha. Imutável por design — mudanças devem
    criar nova versão da FichaTecnicaServico.

    afetada_por_tamanho=True indica que o tempo varia com o porte do veículo
    (ex: pintura de capô de SUV ≠ de hatch). O motor de precificação aplica
    o multiplicador de tamanho apenas nesses itens.
    """

    ficha = models.ForeignKey(
        FichaTecnicaServico,
        on_delete=models.CASCADE,
        related_name="maos_obra",
        verbose_name="Ficha técnica",
    )
    categoria = models.ForeignKey(
        "pricing_catalog.CategoriaMaoObra",
        on_delete=models.PROTECT,
        related_name="fichas_mao_obra",
        verbose_name="Categoria de mão de obra",
    )
    horas = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        verbose_name="Horas",
        help_text="Horas de mão de obra desta categoria para executar o serviço.",
    )
    afetada_por_tamanho = models.BooleanField(
        default=True,
        verbose_name="Afetada por tamanho",
        help_text=(
            "TRUE para mão de obra que varia com porte (pintura, funilaria). "
            "FALSE para elétrica/diagnóstico/configuração."
        ),
    )
    observacao = models.CharField(
        max_length=200,
        blank=True,
        verbose_name="Observação",
    )

    class Meta:
        verbose_name = "Mão de Obra da Ficha Técnica"
        verbose_name_plural = "Mãos de Obra das Fichas Técnicas"

    def __str__(self) -> str:
        return f"{self.categoria} {self.horas}h (ficha {self.ficha_id})"


class FichaTecnicaInsumo(PaddockBaseModel):
    """
    Linha de insumo de uma versão de ficha técnica.

    Define a quantidade de um material canônico necessária para executar
    o serviço da ficha. Imutável por design — mudanças devem criar nova
    versão da FichaTecnicaServico.

    A unidade informada deve coincidir com a unidade_base do material
    canônico — validado em clean() para garantir consistência.

    afetado_por_tamanho=True indica que a quantidade varia com o porte
    do veículo (ex: ml de tinta para SUV > hatch).
    """

    ficha = models.ForeignKey(
        FichaTecnicaServico,
        on_delete=models.CASCADE,
        related_name="insumos",
        verbose_name="Ficha técnica",
    )
    material_canonico = models.ForeignKey(
        "pricing_catalog.MaterialCanonico",
        on_delete=models.PROTECT,
        related_name="fichas_insumo",
        verbose_name="Material canônico",
    )
    quantidade = models.DecimalField(
        max_digits=9,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        verbose_name="Quantidade",
        help_text="Quantidade do material necessária para executar o serviço.",
    )
    unidade = models.CharField(
        max_length=20,
        verbose_name="Unidade",
        help_text="Deve corresponder à unidade_base do material canônico.",
    )
    afetado_por_tamanho = models.BooleanField(
        default=True,
        verbose_name="Afetado por tamanho",
        help_text=(
            "TRUE para insumos que variam com porte (tinta, massa). "
            "FALSE para itens fixos (esponja, lixa)."
        ),
    )
    observacao = models.CharField(
        max_length=200,
        blank=True,
        verbose_name="Observação",
    )

    class Meta:
        verbose_name = "Insumo da Ficha Técnica"
        verbose_name_plural = "Insumos das Fichas Técnicas"

    def clean(self) -> None:
        """Valida que a unidade coincide com unidade_base do material canônico."""
        super().clean()
        if self.material_canonico_id and self.unidade:
            try:
                material = self.material_canonico
                if self.unidade != material.unidade_base:
                    raise ValidationError(
                        {
                            "unidade": (
                                f"Deve ser '{material.unidade_base}' "
                                f"para casar com o material canônico."
                            )
                        }
                    )
            except ValidationError:
                raise
            except Exception as exc:
                # Material não carregado ainda (ex: instância nova sem select_related)
                # A validação definitiva é feita no serializer.
                logger.debug(
                    "FichaTecnicaInsumo.clean: material não carregado, skip: %s", exc
                )

    def __str__(self) -> str:
        return (
            f"{self.material_canonico} "
            f"{self.quantidade}{self.unidade} (ficha {self.ficha_id})"
        )


# ── MO-9: Variâncias ──────────────────────────────────────────────────────────


class VarianciaFicha(PaddockBaseModel):
    """
    Variância entre tempo/insumo estimado (ficha técnica) e realizado (apontamento).
    Gerada mensalmente por task Celery para alimentar o feedback loop.
    """

    servico_canonico_id = models.UUIDField(
        db_index=True,
        verbose_name="ID Serviço Canônico",
        help_text="UUID do ServicoCanonico (sem FK para suportar mudanças de catálogo).",
    )
    mes_referencia = models.DateField(
        verbose_name="Mês de referência",
        help_text="Primeiro dia do mês ao qual a variância se refere.",
    )
    qtd_os = models.IntegerField(default=0, verbose_name="Qtd OS amostradas")
    horas_estimadas_total = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, verbose_name="Horas estimadas (total)"
    )
    horas_realizadas_total = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, verbose_name="Horas realizadas (total)"
    )
    variancia_horas_pct = models.DecimalField(
        max_digits=7,
        decimal_places=4,
        default=0,
        verbose_name="Variância horas (%)",
        help_text="(realizadas - estimadas) / estimadas. Negativo = mais rápido que o estimado.",
    )
    custo_insumo_estimado = models.DecimalField(
        max_digits=14, decimal_places=2, default=0, verbose_name="Custo insumo estimado"
    )
    custo_insumo_realizado = models.DecimalField(
        max_digits=14, decimal_places=2, default=0, verbose_name="Custo insumo realizado"
    )
    variancia_insumo_pct = models.DecimalField(
        max_digits=7, decimal_places=4, default=0, verbose_name="Variância insumo (%)"
    )

    class Meta:
        verbose_name = "Variância de Ficha Técnica"
        verbose_name_plural = "Variâncias de Ficha Técnica"
        unique_together = [("servico_canonico_id", "mes_referencia")]
        indexes = [
            models.Index(fields=["mes_referencia"]),
            models.Index(fields=["variancia_horas_pct"]),
        ]

    def __str__(self) -> str:
        return (
            f"VarianciaFicha {self.servico_canonico_id} "
            f"{self.mes_referencia.strftime('%Y-%m')} "
            f"({self.variancia_horas_pct:+.1%})"
        )


class VarianciaPecaCusto(PaddockBaseModel):
    """
    Variância entre custo previsto de peça (snapshot do motor) e custo real (NF-e).
    Detecta divergências de markup antes que impactem rentabilidade.
    """

    peca_canonica_id = models.UUIDField(
        db_index=True,
        verbose_name="ID Peça Canônica",
    )
    mes_referencia = models.DateField(verbose_name="Mês de referência")
    qtd_amostras = models.IntegerField(default=0, verbose_name="Amostras")
    custo_snapshot_medio = models.DecimalField(
        max_digits=14, decimal_places=2, default=0, verbose_name="Custo snapshot médio"
    )
    custo_nfe_medio = models.DecimalField(
        max_digits=14, decimal_places=2, default=0, verbose_name="Custo NF-e médio"
    )
    variancia_pct = models.DecimalField(
        max_digits=7, decimal_places=4, default=0, verbose_name="Variância (%)"
    )
    alerta = models.BooleanField(
        default=False,
        verbose_name="Alerta",
        help_text="True quando |variancia_pct| > 0.15 (15%).",
    )

    class Meta:
        verbose_name = "Variância de Custo de Peça"
        verbose_name_plural = "Variâncias de Custo de Peças"
        unique_together = [("peca_canonica_id", "mes_referencia")]
        indexes = [
            models.Index(fields=["mes_referencia", "alerta"]),
        ]

    def __str__(self) -> str:
        return (
            f"VarianciaPeca {self.peca_canonica_id} "
            f"{self.mes_referencia.strftime('%Y-%m')} "
            f"({self.variancia_pct:+.1%})"
        )
