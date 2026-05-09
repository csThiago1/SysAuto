from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.fiscal.views import (
    DanfePreviewView,
    FiscalDocumentViewSet,
    FiscalFileProxyView,
    FocusWebhookView,
    NFeEntradaViewSet,
    NfeEmitManualView,
    NfeEmitView,
    NfeInutilizacaoListView,
    NfeInutilizacaoView,
    NfeRecebidaFileProxyView,
    NfeRecebidaListView,
    NfeRecebidaManifestView,
    NfeRecebidaSyncView,
    NfseEmitManualView,
    NfseEmitView,
    NfseSubstituirView,
    ResumoFiscalView,
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
    # S3-T5: Substituição NFS-e
    path("nfse/substituir/", NfseSubstituirView.as_view(), name="nfse-substituir"),
    # 07A: Emissão NF-e de Produto
    path("nfe/emit/", NfeEmitView.as_view(), name="nfe-emit"),
    path("nfe/emit-manual/", NfeEmitManualView.as_view(), name="nfe-emit-manual"),
    # NF-e recebidas (manifestação de destinatário + download XML/DANFE)
    path("nfe-recebidas/", NfeRecebidaListView.as_view(), name="nfe-recebidas-list"),
    path("nfe-recebidas/sync/", NfeRecebidaSyncView.as_view(), name="nfe-recebidas-sync"),
    path("nfe-recebidas/<str:chave>/manifesto/", NfeRecebidaManifestView.as_view(), name="nfe-recebidas-manifesto"),
    # S4-T4: proxy XML/DANFE para NF-e recebidas
    path("nfe-recebidas/<str:chave>/file/<str:file_type>/", NfeRecebidaFileProxyView.as_view(), name="nfe-recebida-file-proxy"),
    # Proxy para PDF/XML da Focus (requer auth Focus)
    path("documents/<str:pk>/file/<str:file_type>/", FiscalFileProxyView.as_view(), name="fiscal-file-proxy"),
    # S3-T3: Inutilização de numeração NF-e
    path("nfe/inutilizacao/", NfeInutilizacaoView.as_view(), name="nfe-inutilizacao"),
    path("nfe/inutilizacoes/", NfeInutilizacaoListView.as_view(), name="nfe-inutilizacoes-list"),
    # S3-T7: DANFE preview (sem emissão)
    path("nfe/danfe-preview/", DanfePreviewView.as_view(), name="nfe-danfe-preview"),
    # S6-T3: Resumo Fiscal Mensal
    path("resumo-mensal/", ResumoFiscalView.as_view(), name="resumo-fiscal"),
    # NF-e de entrada (MO-5) + documentos fiscais (06C)
    path("", include(router.urls)),
]
