"""
Fiscal — Purchase Order Matching Service
Matches NF-e de entrada with existing purchase orders by supplier CNPJ.
"""
import logging

from apps.fiscal.models import NFeEntrada

logger = logging.getLogger(__name__)


class PurchaseOrderMatchingService:
    """Serviço para vincular NF-e de entrada com pedidos de compra."""

    @staticmethod
    def find_matches(nfe_entrada: NFeEntrada) -> list:
        """Busca POs pendentes do mesmo fornecedor (por CNPJ)."""
        try:
            from apps.purchasing.models import PurchaseOrder
            return list(
                PurchaseOrder.objects.filter(
                    supplier__cnpj=nfe_entrada.emitente_cnpj,
                    status__in=["approved", "sent", "partial"],
                ).select_related("supplier").order_by("-created_at")[:10]
            )
        except Exception as e:
            logger.warning("PO matching error: %s", e)
            return []

    @staticmethod
    def link(nfe_entrada: NFeEntrada, purchase_order_id: str) -> bool:
        """Vincula NFeEntrada a um PurchaseOrder."""
        try:
            from apps.purchasing.models import PurchaseOrder
            po = PurchaseOrder.objects.get(pk=purchase_order_id)
            nfe_entrada.purchase_order = po
            nfe_entrada.save(update_fields=["purchase_order"])
            logger.info("Linked NFeEntrada %s to PO %s", nfe_entrada.pk, po.pk)
            return True
        except Exception as e:
            logger.warning("PO link error: %s", e)
            return False
