"""
Service Orders — Models Package
Split into focused modules for maintainability.
All models are re-exported here for backward compatibility.
"""
from .service_order import (
    ServiceOrderStatus,
    VALID_TRANSITIONS,
    OSPhotoFolder,
    ServiceOrder,
    StatusTransitionLog,
    ServiceOrderPhoto,
    ActivityType,
    ServiceOrderActivityLog,
    BudgetSnapshot,
)
from .items import (
    ServiceOrderPartQuerySet,
    ServiceOrderPartManager,
    ServiceOrderPart,
    ServiceCatalogCategory,
    ServiceCatalog,
    ServiceOrderLaborQuerySet,
    ServiceOrderLaborManager,
    ServiceOrderLabor,
    ChecklistItemStatus,
    ChecklistItem,
    Holiday,
)
from .versioning import (
    ServiceOrderVersion,
    ServiceOrderVersionItem,
    ServiceOrderEvent,
)
from .capacity import (
    ApontamentoHoras,
    CapacidadeTecnico,
    BloqueioCapacidade,
    _dias_semana_default,
)
from .parecer import (
    ServiceOrderParecer,
    ImpactAreaLabel,
    TransitionOverrideRequest,
)
from .pricing import (
    OSAreaImpacto,
    OSIntervencao,
    OSItemAdicional,
)

__all__ = [
    # service_order
    "ServiceOrderStatus",
    "VALID_TRANSITIONS",
    "OSPhotoFolder",
    "ServiceOrder",
    "StatusTransitionLog",
    "ServiceOrderPhoto",
    "ActivityType",
    "ServiceOrderActivityLog",
    "BudgetSnapshot",
    # items
    "ServiceOrderPartQuerySet",
    "ServiceOrderPartManager",
    "ServiceOrderPart",
    "ServiceCatalogCategory",
    "ServiceCatalog",
    "ServiceOrderLaborQuerySet",
    "ServiceOrderLaborManager",
    "ServiceOrderLabor",
    "ChecklistItemStatus",
    "ChecklistItem",
    "Holiday",
    # versioning
    "ServiceOrderVersion",
    "ServiceOrderVersionItem",
    "ServiceOrderEvent",
    # capacity
    "ApontamentoHoras",
    "CapacidadeTecnico",
    "BloqueioCapacidade",
    # parecer
    "ServiceOrderParecer",
    "ImpactAreaLabel",
    "TransitionOverrideRequest",
    # pricing
    "OSAreaImpacto",
    "OSIntervencao",
    "OSItemAdicional",
]
