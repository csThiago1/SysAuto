"""
Paddock Solutions — Persons URLs
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import PersonViewSet

router = DefaultRouter()
router.register(r"", PersonViewSet, basename="person")

urlpatterns = [
    path("", include(router.urls)),
]
