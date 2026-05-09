"""
Service Orders — Views Package

Re-exports all view classes for backward compatibility.
urls.py imports from `.views` which resolves to this package.
"""
from .orders import ServiceOrderViewSet
from .dashboard import DashboardStatsView
from .calendar import CalendarView
from .catalog import ServiceCatalogViewSet, HolidayViewSet
from .versioning import (
    ServiceOrderVersionViewSet,
    ServiceOrderEventViewSet,
    ServiceOrderParecerViewSet,
)
from .vehicle_history import VehicleHistoryView

__all__ = [
    "ServiceOrderViewSet",
    "DashboardStatsView",
    "CalendarView",
    "ServiceCatalogViewSet",
    "HolidayViewSet",
    "ServiceOrderVersionViewSet",
    "ServiceOrderEventViewSet",
    "ServiceOrderParecerViewSet",
    "VehicleHistoryView",
]
