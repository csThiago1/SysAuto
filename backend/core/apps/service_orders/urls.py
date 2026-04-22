"""
Paddock Solutions — Service Orders URLs
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter, SimpleRouter

from .views import (
    CalendarView, DashboardStatsView, HolidayViewSet,
    ServiceCatalogViewSet, ServiceOrderViewSet, VehicleHistoryView,
    ServiceOrderVersionViewSet, ServiceOrderEventViewSet, ServiceOrderParecerViewSet,
)

router = DefaultRouter()
router.register(r"", ServiceOrderViewSet, basename="service-order")

catalog_router = SimpleRouter()
catalog_router.register(r"", ServiceCatalogViewSet, basename="service-catalog")

holiday_router = SimpleRouter()
holiday_router.register(r"", HolidayViewSet, basename="holiday")

versions_router = SimpleRouter()
versions_router.register(r"", ServiceOrderVersionViewSet, basename="service-order-version")

events_router = SimpleRouter()
events_router.register(r"", ServiceOrderEventViewSet, basename="service-order-event")

pareceres_router = SimpleRouter()
pareceres_router.register(r"", ServiceOrderParecerViewSet, basename="service-order-parecer")

urlpatterns = [
    path("dashboard/stats/", DashboardStatsView.as_view(), name="service-order-dashboard-stats"),
    path("calendar/", CalendarView.as_view(), name="service-order-calendar"),
    path("vehicle-history/", VehicleHistoryView.as_view(), name="vehicle-history"),
    path("service-catalog/", include(catalog_router.urls)),
    path("holidays/", include(holiday_router.urls)),
    path("versions/", include(versions_router.urls)),
    path("events/", include(events_router.urls)),
    path("pareceres/", include(pareceres_router.urls)),
    path("", include(router.urls)),
]
