"""
Paddock Solutions — Service Orders Serializers Package

Re-exports todos os serializers para manter compatibilidade com imports existentes.
Organizacao interna:
- core.py: OS CRUD, photo, parts, labor, budget, status transition, checklist, etc.
- checklist.py: danos e pertences do checklist de entrada 3D
- mobile.py: ServiceOrderSyncSerializer (WatermelonDB)
- versioning.py: Version, VersionItem, Event, Parecer, Diff serializers
"""
# -- core.py --
from .core import (
    BudgetSnapshotSerializer,
    ChecklistItemBulkSerializer,
    ChecklistItemSerializer,
    ComplementLaborCreateSerializer,
    ComplementPartCreateSerializer,
    DeliverOSSerializer,
    FinancialSummarySerializer,
    HolidaySerializer,
    NotificationFeedSerializer,
    OverrideRequestCreateSerializer,
    OverrideRequestSerializer,
    OverrideResolveSerializer,
    PartCompraInputSerializer,
    PartEstoqueInputSerializer,
    PartSeguradoraInputSerializer,
    PhotoIdsSerializer,
    ServiceCatalogListSerializer,
    ServiceCatalogSerializer,
    ServiceOrderActivityLogSerializer,
    ServiceOrderCalendarSerializer,
    ServiceOrderCreateSerializer,
    ServiceOrderDetailSerializer,
    ServiceOrderLaborSerializer,
    ServiceOrderListSerializer,
    ServiceOrderOverdueSerializer,
    ServiceOrderPartSerializer,
    ServiceOrderPhotoSerializer,
    ServiceOrderStatusTransitionSerializer,
    ServiceOrderUpdateSerializer,
    StatusTransitionLogSerializer,
    TransitionValidationResultSerializer,
    UploadPhotoSerializer,
    VehicleHistoryItemSerializer,
    _get_folder_display,
    _get_status_display,
)

# -- checklist.py --
from .checklist import ChecklistDamageSerializer, CustomerBelongingSerializer

# -- mobile.py --
from .mobile import ServiceOrderSyncSerializer

# -- versioning.py --
from .versioning import (
    ServiceOrderEventSerializer,
    ServiceOrderParecerSerializer,
    ServiceOrderVersionItemSerializer,
    ServiceOrderVersionSerializer,
    VersionDetailSerializer,
    VersionDiffItemSerializer,
    VersionDiffSerializer,
    VersionItemCompactSerializer,
)

__all__ = [
    # core
    "_get_status_display",
    "_get_folder_display",
    "ServiceOrderPhotoSerializer",
    "BudgetSnapshotSerializer",
    "StatusTransitionLogSerializer",
    "NotificationFeedSerializer",
    "ServiceOrderActivityLogSerializer",
    "ServiceOrderPartSerializer",
    "PartEstoqueInputSerializer",
    "PartCompraInputSerializer",
    "PartSeguradoraInputSerializer",
    "ServiceOrderLaborSerializer",
    "ServiceCatalogSerializer",
    "ServiceCatalogListSerializer",
    "ServiceOrderOverdueSerializer",
    "ServiceOrderCalendarSerializer",
    "ServiceOrderListSerializer",
    "ServiceOrderDetailSerializer",
    "ServiceOrderCreateSerializer",
    "ServiceOrderUpdateSerializer",
    "ServiceOrderStatusTransitionSerializer",
    "DeliverOSSerializer",
    "UploadPhotoSerializer",
    "PhotoIdsSerializer",
    "ChecklistItemSerializer",
    "ChecklistItemBulkSerializer",
    "HolidaySerializer",
    "ComplementPartCreateSerializer",
    "ComplementLaborCreateSerializer",
    "FinancialSummarySerializer",
    "VehicleHistoryItemSerializer",
    "TransitionValidationResultSerializer",
    "OverrideRequestCreateSerializer",
    "OverrideResolveSerializer",
    "OverrideRequestSerializer",
    # checklist
    "ChecklistDamageSerializer",
    "CustomerBelongingSerializer",
    # mobile
    "ServiceOrderSyncSerializer",
    # versioning
    "ServiceOrderVersionItemSerializer",
    "ServiceOrderVersionSerializer",
    "ServiceOrderEventSerializer",
    "ServiceOrderParecerSerializer",
    "VersionItemCompactSerializer",
    "VersionDetailSerializer",
    "VersionDiffItemSerializer",
    "VersionDiffSerializer",
]
