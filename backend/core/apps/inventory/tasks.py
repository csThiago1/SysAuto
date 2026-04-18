"""
Paddock Solutions — Inventory — Celery Tasks
Motor de Orçamentos (MO) — Sprint MO-5: Estoque Físico + NF-e Entrada

P6: impressão SEMPRE via Celery — nunca direto no viewset.
P9: impressora pode ser IP interno da LAN da oficina.
"""
import logging

from celery import shared_task
from django_tenants.utils import schema_context

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def task_imprimir_etiquetas_nfe(self: object, nfe_id: str, tenant_schema: str) -> dict:
    """
    Gera e imprime etiquetas ZPL para todas as unidades/lotes criados por uma NF-e.

    Args:
        nfe_id: UUID da NFeEntrada.
        tenant_schema: schema do tenant (multitenancy).

    Returns:
        dict com impressas (int) e motivo (str, se falhou).
    """
    with schema_context(tenant_schema):
        from apps.fiscal.models import NFeEntrada
        from apps.inventory.models import EtiquetaImpressa, ImpressoraEtiqueta
        from apps.inventory.services.etiqueta import ZPLService

        try:
            nfe = NFeEntrada.objects.get(pk=nfe_id)
            impressora = ImpressoraEtiqueta.objects.filter(is_active=True).first()

            if not impressora:
                logger.warning("Sem impressora ativa para NF-e %s", nfe_id)
                return {"impressas": 0, "motivo": "sem_impressora"}

            count = 0

            for u in nfe.unidades_fisicas.select_related("peca_canonica", "nfe_entrada").all():
                zpl = ZPLService.gerar_zpl_peca(u)
                ZPLService.imprimir(zpl, impressora)
                EtiquetaImpressa.objects.create(
                    unidade_fisica=u,
                    impressora=impressora,
                    zpl_payload=zpl,
                )
                count += 1

            for l in nfe.lotes_insumo.select_related("material_canonico").all():
                zpl = ZPLService.gerar_zpl_lote(l)
                ZPLService.imprimir(zpl, impressora)
                EtiquetaImpressa.objects.create(
                    lote_insumo=l,
                    impressora=impressora,
                    zpl_payload=zpl,
                )
                count += 1

            logger.info("NF-e %s: %d etiquetas impressas", nfe_id, count)
            return {"impressas": count}

        except Exception as exc:
            logger.error("Erro ao imprimir etiquetas NF-e %s: %s", nfe_id, type(exc).__name__)
            raise self.retry(exc=exc)  # type: ignore[union-attr]
