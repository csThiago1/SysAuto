"""
Paddock Solutions — Banks URLs
"""
from rest_framework.routers import DefaultRouter

from apps.banks.views import BankViewSet

router = DefaultRouter()
router.register(r"", BankViewSet, basename="bank")

urlpatterns = router.urls
