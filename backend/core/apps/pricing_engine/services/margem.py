"""
Paddock Solutions — Pricing Engine — MargemResolver
Motor de Orçamentos (MO) — Sprint MO-6: Motor de Precificação

Resolve a margem aplicável para serviço ou peça, seguindo a hierarquia:
  Para peças: peça específica > faixa de custo > default segmento (peca_revenda)
  Para serviço: MargemOperacao tipo servico_mao_obra vigente para o segmento.
"""
import logging
from datetime import date
from decimal import Decimal

from django.db.models import Q

logger = logging.getLogger(__name__)


class MargemNaoDefinida(Exception):
    """Levantada quando não há margem vigente para o contexto dado."""


class MargemResolver:
    """Resolve margem aplicável por tipo de operação e segmento veicular."""

    @staticmethod
    def para_servico(empresa_id: str, segmento_codigo: str) -> Decimal:
        """Margem vigente para serviço/mão de obra no segmento.

        Args:
            empresa_id: UUID str da Empresa.
            segmento_codigo: código do SegmentoVeicular (ex: "popular").

        Returns:
            Decimal com a margem percentual (ex: 0.4000 = 40%).

        Raises:
            MargemNaoDefinida: se nenhuma MargemOperacao vigente encontrada.
        """
        from apps.pricing_engine.models.motor import MargemOperacao

        hoje = date.today()
        m = (
            MargemOperacao.objects.filter(
                empresa_id=empresa_id,
                segmento__codigo=segmento_codigo,
                tipo_operacao="servico_mao_obra",
                vigente_desde__lte=hoje,
                is_active=True,
            )
            .filter(Q(vigente_ate__isnull=True) | Q(vigente_ate__gte=hoje))
            .order_by("-vigente_desde")
            .first()
        )

        if not m:
            raise MargemNaoDefinida(
                f"Sem margem vigente para empresa={empresa_id} "
                f"segmento={segmento_codigo!r} tipo=servico_mao_obra em {hoje}. "
                "Cadastre uma MargemOperacao no painel de configuração."
            )

        logger.debug(
            "MargemResolver.para_servico: empresa=%s segmento=%s margem=%s",
            empresa_id,
            segmento_codigo,
            m.margem_percentual,
        )
        return m.margem_percentual

    @staticmethod
    def para_peca(
        empresa_id: str,
        segmento_codigo: str,
        peca_canonica_id: str,
        custo_base: Decimal,
    ) -> Decimal:
        """Margem vigente para peça, com hierarquia de resolução.

        Hierarquia:
          1. MarkupPeca com peca_canonica específica.
          2. MarkupPeca com faixa de custo que englobe custo_base.
          3. Fallback: MargemOperacao tipo peca_revenda para o segmento.

        Args:
            empresa_id: UUID str da Empresa.
            segmento_codigo: código do SegmentoVeicular.
            peca_canonica_id: UUID str da PecaCanonica.
            custo_base: custo base da peça para resolução por faixa.

        Returns:
            Decimal com a margem percentual.

        Raises:
            MargemNaoDefinida: se nenhuma regra vigente encontrada.
        """
        from apps.pricing_engine.models.motor import MarkupPeca

        hoje = date.today()
        qs = MarkupPeca.objects.filter(
            empresa_id=empresa_id,
            vigente_desde__lte=hoje,
            is_active=True,
        ).filter(Q(vigente_ate__isnull=True) | Q(vigente_ate__gte=hoje))

        # 1. Peça específica
        pec = (
            qs.filter(peca_canonica_id=peca_canonica_id)
            .order_by("-vigente_desde")
            .first()
        )
        if pec:
            logger.debug(
                "MargemResolver.para_peca: via peça específica=%s margem=%s",
                peca_canonica_id,
                pec.margem_percentual,
            )
            return pec.margem_percentual

        # 2. Faixa de custo
        faixa = (
            qs.filter(
                peca_canonica__isnull=True,
                faixa_custo_min__lte=custo_base,
                faixa_custo_max__gte=custo_base,
            )
            .order_by("-vigente_desde")
            .first()
        )
        if faixa:
            logger.debug(
                "MargemResolver.para_peca: via faixa [%s–%s] margem=%s",
                faixa.faixa_custo_min,
                faixa.faixa_custo_max,
                faixa.margem_percentual,
            )
            return faixa.margem_percentual

        # 3. Default segmento (peca_revenda)
        return MargemResolver._para_segmento_peca_revenda(empresa_id, segmento_codigo)

    @staticmethod
    def _para_segmento_peca_revenda(empresa_id: str, segmento_codigo: str) -> Decimal:
        """Fallback: margem padrão de peça via MargemOperacao tipo peca_revenda."""
        from apps.pricing_engine.models.motor import MargemOperacao

        hoje = date.today()
        m = (
            MargemOperacao.objects.filter(
                empresa_id=empresa_id,
                segmento__codigo=segmento_codigo,
                tipo_operacao="peca_revenda",
                vigente_desde__lte=hoje,
                is_active=True,
            )
            .filter(Q(vigente_ate__isnull=True) | Q(vigente_ate__gte=hoje))
            .order_by("-vigente_desde")
            .first()
        )

        if not m:
            raise MargemNaoDefinida(
                f"Sem margem vigente para empresa={empresa_id} "
                f"segmento={segmento_codigo!r} tipo=peca_revenda em {hoje}. "
                "Cadastre MargemOperacao(peca_revenda) ou MarkupPeca específico."
            )

        logger.debug(
            "MargemResolver._para_segmento_peca_revenda: empresa=%s segmento=%s margem=%s",
            empresa_id,
            segmento_codigo,
            m.margem_percentual,
        )
        return m.margem_percentual
