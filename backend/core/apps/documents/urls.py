from django.urls import path

from apps.documents.views import (
    DocumentDownloadView,
    DocumentGenerateView,
    DocumentHistoryView,
    DocumentPreviewView,
    DocumentSnapshotView,
)

urlpatterns = [
    path("os/<uuid:order_id>/preview/<str:document_type>/", DocumentPreviewView.as_view(), name="document-preview"),
    path("os/<uuid:order_id>/generate/", DocumentGenerateView.as_view(), name="document-generate"),
    path("os/<uuid:order_id>/history/", DocumentHistoryView.as_view(), name="document-history"),
    path("<uuid:doc_id>/download/", DocumentDownloadView.as_view(), name="document-download"),
    path("<uuid:doc_id>/snapshot/", DocumentSnapshotView.as_view(), name="document-snapshot"),
]
