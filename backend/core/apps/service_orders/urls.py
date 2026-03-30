"""
Paddock Solutions — Service Orders URLs
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DashboardStatsView, ServiceOrderViewSet

router = DefaultRouter()
router.register(r"", ServiceOrderViewSet, basename="service-order")

urlpatterns = [
    path("dashboard/stats/", DashboardStatsView.as_view(), name="service-order-dashboard-stats"),
    path("", include(router.urls)),
]
