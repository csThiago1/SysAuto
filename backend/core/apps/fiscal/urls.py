from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.fiscal.views import (
    FiscalDocumentViewSet,
    FocusWebhookView,
    NFeEntradaViewSet,
    NfseEmitManualView,
    NfseEmitView,
)

router = SimpleRouter()
router.register(r"nfe-entrada", NFeEntradaViewSet, basename="nfe-entrada")
router.register(r"documents", FiscalDocumentViewSet, basename="fiscal-document")

urlpatterns = [
    # Webhook Focus NF-e — autenticação via secret no path
    path("webhooks/focus/<str:secret>/", FocusWebhookView.as_view(), name="focus-webhook"),
    # 06C: Emissão NFS-e
    path("nfse/emit/", NfseEmitView.as_view(), name="nfse-emit"),
    path("nfse/emit-manual/", NfseEmitManualView.as_view(), name="nfse-emit-manual"),
    # NF-e de entrada (MO-5) + documentos fiscais (06C)
    path("", include(router.urls)),
]
