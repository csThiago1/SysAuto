"""
Paddock Solutions — Accounts Receivable URLs
"""
from rest_framework.routers import DefaultRouter

from .views import ReceivableDocumentViewSet

router = DefaultRouter()
router.register("documents", ReceivableDocumentViewSet, basename="receivable-document")

urlpatterns = router.urls
