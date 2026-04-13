"""
Paddock Solutions — Service Orders URLs
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CalendarView, DashboardStatsView, ServiceCatalogViewSet, ServiceOrderViewSet

router = DefaultRouter()
router.register(r"", ServiceOrderViewSet, basename="service-order")

catalog_router = DefaultRouter()
catalog_router.register(r"service-catalog", ServiceCatalogViewSet, basename="service-catalog")

urlpatterns = [
    path("dashboard/stats/", DashboardStatsView.as_view(), name="service-order-dashboard-stats"),
    path("calendar/", CalendarView.as_view(), name="service-order-calendar"),
    path("", include(router.urls)),
    path("", include(catalog_router.urls)),
]
