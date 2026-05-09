"""
Paddock Solutions — Service Orders Services Package

ServiceOrderService e composto por dois mixins para organizacao de arquivo:
- _ServiceOrderCoreMixin (order_service.py): create, update, transition, change_status,
  add_part, add_labor, financial_summary, create_budget_snapshot, get_next_number
- _ServiceOrderVersioningMixin (versioning_service.py): create_new_version_from_import,
  approve_version, recalculate_version_totals, compute_version_diff,
  apply_version_override, _map_part_type, create_from_budget

ServiceOrderDeliveryService (delivery_service.py) e uma classe separada.

AUTO_TRANSITIONS tambem e re-exportado para manter compatibilidade.
"""
from .order_service import _ServiceOrderCoreMixin, AUTO_TRANSITIONS
from .versioning_service import _ServiceOrderVersioningMixin
from .delivery_service import ServiceOrderDeliveryService


class ServiceOrderService(_ServiceOrderCoreMixin, _ServiceOrderVersioningMixin):
    """Service layer para Ordens de Servico.

    Composta por dois mixins — split para gerenciar tamanho de arquivo.
    Todas as chamadas existentes continuam funcionando:
        ServiceOrderService.create(...)
        ServiceOrderService.create_new_version_from_import(...)
    """
    pass


__all__ = [
    "ServiceOrderService",
    "ServiceOrderDeliveryService",
    "AUTO_TRANSITIONS",
]
