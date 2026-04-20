"""
Paddock Solutions — Service Orders URLs
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter, SimpleRouter

from .views import CalendarView, DashboardStatsView, HolidayViewSet, ServiceCatalogViewSet, ServiceOrderViewSet

router = DefaultRouter()
router.register(r"", ServiceOrderViewSet, basename="service-order")

catalog_router = SimpleRouter()
catalog_router.register(r"", ServiceCatalogViewSet, basename="service-catalog")

holiday_router = SimpleRouter()
holiday_router.register(r"", HolidayViewSet, basename="holiday")

urlpatterns = [
    path("dashboard/stats/", DashboardStatsView.as_view(), name="service-order-dashboard-stats"),
    path("calendar/", CalendarView.as_view(), name="service-order-calendar"),
    path("service-catalog/", include(catalog_router.urls)),
    path("holidays/", include(holiday_router.urls)),
    path("", include(router.urls)),
]
