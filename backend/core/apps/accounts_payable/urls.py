"""
Paddock Solutions — Accounts Payable URLs
"""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AsaasWebhookView, PayableDocumentViewSet, SupplierViewSet

router = DefaultRouter()
router.register("suppliers", SupplierViewSet, basename="supplier")
router.register("documents", PayableDocumentViewSet, basename="payable-document")

urlpatterns = router.urls + [
    path("asaas/webhook/", AsaasWebhookView.as_view(), name="asaas-webhook"),
]
