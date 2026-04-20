"""
Paddock Solutions — Pricing Tech — Celery Tasks
MO-9: Task de geração mensal de variâncias de ficha técnica e custo de peças.
"""
import logging
from datetime import date

from celery import shared_task
from django_tenants.utils import schema_context

logger = logging.getLogger(__name__)


@shared_task
def task_gerar_variancias_mensais(tenant_schema: str, mes_referencia_iso: str | None = None) -> dict:
    """
    Gera VarianciaFicha e VarianciaPecaCusto para o mês de referência.

    Args:
        tenant_schema: Schema do tenant (obrigatório para multitenancy).
        mes_referencia_iso: "YYYY-MM-DD" do primeiro dia do mês.
                            Se None, usa o mês anterior ao atual.

    Returns:
        dict com fichas_geradas e pecas_geradas.
    """
    with schema_context(tenant_schema):
        from apps.pricing_tech.services.variancia import VarianciaService

        if mes_referencia_iso:
            mes_ref = date.fromisoformat(mes_referencia_iso)
        else:
            hoje = date.today()
            if hoje.month == 1:
                mes_ref = date(hoje.year - 1, 12, 1)
            else:
                mes_ref = date(hoje.year, hoje.month - 1, 1)

        logger.info(
            "[pricing_tech] Gerando variâncias para %s schema=%s",
            mes_ref.strftime("%Y-%m"),
            tenant_schema,
        )
        resultado = VarianciaService.gerar_variancia_periodo(mes_ref)
        logger.info("[pricing_tech] Variâncias geradas: %s", resultado)
        return resultado
