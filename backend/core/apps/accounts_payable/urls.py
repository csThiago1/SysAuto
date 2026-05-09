"""
Paddock Solutions — Accounts Payable URLs
"""
from rest_framework.routers import DefaultRouter

from .views import PayableDocumentViewSet, SupplierViewSet

router = DefaultRouter()
router.register("suppliers", SupplierViewSet, basename="supplier")
router.register("documents", PayableDocumentViewSet, basename="payable-document")

urlpatterns = router.urls
