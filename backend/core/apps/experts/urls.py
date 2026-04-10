"""
Paddock Solutions — Experts URLs
"""
from rest_framework.routers import DefaultRouter

from apps.experts.views import ExpertViewSet

router = DefaultRouter()
router.register(r"", ExpertViewSet, basename="expert")

urlpatterns = router.urls
