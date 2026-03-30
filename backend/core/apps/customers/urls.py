"""
Paddock Solutions — Customers URLs
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import UnifiedCustomerViewSet

router = DefaultRouter()
router.register(r"", UnifiedCustomerViewSet, basename="customer")

urlpatterns = [
    path("", include(router.urls)),
]
