from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.fiscal.views import (
    FiscalDocumentViewSet,
    FocusWebhookView,
    NFeEntradaViewSet,
    NfeRecebidaListView,
    NfeRecebidaManifestView,
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
    # NF-e recebidas (manifestação de destinatário)
    path("nfe-recebidas/", NfeRecebidaListView.as_view(), name="nfe-recebidas-list"),
    path("nfe-recebidas/<str:chave>/manifesto/", NfeRecebidaManifestView.as_view(), name="nfe-recebidas-manifesto"),
    # NF-e de entrada (MO-5) + documentos fiscais (06C)
    path("", include(router.urls)),
]
