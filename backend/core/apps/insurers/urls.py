"""
Paddock Solutions — Insurers URLs
"""
from rest_framework.routers import DefaultRouter

from apps.insurers.views import InsurerViewSet

router = DefaultRouter()
router.register(r"", InsurerViewSet, basename="insurer")

urlpatterns = router.urls
