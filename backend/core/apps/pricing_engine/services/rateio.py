"""
Paddock Solutions — Pricing Engine — RateioService
Motor de Orçamentos (MO) — Sprint 03: Adapters de Custo

Calcula o rateio de despesas recorrentes por hora produtiva,
usando ParametroRateio vigente da empresa.
"""

import logging
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Q

logger = logging.getLogger(__name__)


class ParametroRateioNaoDefinido(Exception):
    """Levantada quando não há ParametroRateio ativo para empresa+data."""


class RateioService:
    """Calcula rateio de despesas fixas por hora produtiva.

    Fórmula:
        rateio_hora = total_despesas_vigentes / horas_produtivas_mes

    O resultado é quantizado em 4 casas decimais para precisão máxima.
    O arredondamento final para 2 casas ocorre no motor de precificação (MO-6).
    """

    @staticmethod
    def por_hora(data: date, empresa_id: str) -> Decimal:
        """Rateio de despesas fixas por hora produtiva do mês.

        Args:
            data: Data de referência (determina vigência do ParametroRateio e despesas).
            empresa_id: ID da Empresa (pricing_profile.Empresa). Obrigatório — P4.

        Returns:
            Decimal quantizado em 4 casas decimais (ex: Decimal("12.3456")).

        Raises:
            ParametroRateioNaoDefinido: Se não há ParametroRateio ativo para empresa/data.
            ValueError: Se horas_produtivas_mes = 0 no parâmetro vigente.
        """
        from apps.pricing_engine.models import ParametroRateio
        from apps.pricing_engine.services.despesa_recorrente import DespesaRecorrenteService

        total_despesas = DespesaRecorrenteService.total_vigente(data, empresa_id)

        param = (
            ParametroRateio.objects.filter(
                empresa_id=empresa_id,
                vigente_desde__lte=data,
                is_active=True,
            )
            .filter(Q(vigente_ate__isnull=True) | Q(vigente_ate__gte=data))
            .order_by("-vigente_desde")
            .first()
        )

        if not param:
            raise ParametroRateioNaoDefinido(
                f"Nenhum ParametroRateio ativo para empresa={empresa_id} em {data}. "
                "Cadastre um ParametroRateio vigente no painel de configuração do motor."
            )

        if param.horas_produtivas_mes == 0:
            raise ValueError(
                f"ParametroRateio id={param.id} tem horas_produtivas_mes = 0 — "
                "impossível calcular rateio por hora."
            )

        logger.debug(
            "RateioService.por_hora: empresa=%s data=%s total_despesas=%s " "horas=%s param_id=%s",
            empresa_id,
            data,
            total_despesas,
            param.horas_produtivas_mes,
            param.id,
        )

        return (total_despesas / param.horas_produtivas_mes).quantize(
            Decimal("0.0001"), ROUND_HALF_UP
        )
