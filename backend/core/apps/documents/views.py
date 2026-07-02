"""Views do módulo de documentos PDF."""
from __future__ import annotations

import logging

from django.http import HttpResponse
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import serializers as drf_serializers
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove
from apps.documents.models import DocumentGeneration
from apps.documents.serializers import (
    DocumentGenerationSerializer,
    DocumentSnapshotSerializer,
    GenerateDocumentSerializer,
)
from apps.documents.services import DocumentService

logger = logging.getLogger(__name__)


class _DetailSerializer(drf_serializers.Serializer):
    detail = drf_serializers.CharField()


class _DocumentPreviewResponseSerializer(drf_serializers.Serializer):
    """Preview de dados pra render de documento — shape depende do document_type."""

    document_type = drf_serializers.CharField()
    order_id = drf_serializers.UUIDField()
    # Payload adicional é dinâmico por tipo — não tipamos individualmente.


class DocumentPreviewView(APIView):
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    @extend_schema(
        responses={200: _DocumentPreviewResponseSerializer, 400: _DetailSerializer},
    )
    def get(self, request: Request, order_id: str, document_type: str) -> Response:
        receivable_id = request.query_params.get("receivable_id")
        try:
            data = DocumentService.preview(
                order_id=order_id,
                document_type=document_type,
                receivable_id=receivable_id,
            )
            data.pop("logo_base64", None)
            return Response(data)
        except Exception as exc:
            logger.error("Erro ao gerar preview: %s", exc)
            return Response(
                {"detail": "Erro ao carregar dados do documento."},
                status=status.HTTP_400_BAD_REQUEST,
            )


class DocumentGenerateView(APIView):
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    @extend_schema(
        request=GenerateDocumentSerializer,
        responses={
            201: DocumentGenerationSerializer,
            400: _DetailSerializer,
            500: _DetailSerializer,
        },
    )
    def post(self, request: Request, order_id: str) -> Response:
        serializer = GenerateDocumentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        document_type = serializer.validated_data["document_type"]
        data = serializer.validated_data["data"]
        receivable_id = serializer.validated_data.get("receivable_id")

        from apps.documents.pdf_logo import get_logo_base64, get_logo_black_base64
        data["logo_base64"] = get_logo_base64()
        data["logo_black_base64"] = get_logo_black_base64()

        try:
            doc = DocumentService.generate(
                order_id=order_id,
                document_type=document_type,
                data=data,
                user=request.user,
                receivable_id=receivable_id,
            )
            return Response(
                DocumentGenerationSerializer(doc).data,
                status=status.HTTP_201_CREATED,
            )
        except ValueError as exc:
            logger.warning("Dados inválidos para geração do documento: %s", exc)
            return Response({"detail": "Dados inválidos para geração do documento."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.error("Erro ao gerar documento: %s", exc)
            return Response(
                {"detail": "Erro interno ao gerar documento."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class DocumentHistoryView(APIView):
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    @extend_schema(responses={200: DocumentGenerationSerializer(many=True)})
    def get(self, request: Request, order_id: str) -> Response:
        qs = DocumentGeneration.objects.filter(
            service_order_id=order_id,
        ).select_related("generated_by").order_by("-created_at")
        return Response(DocumentGenerationSerializer(qs, many=True).data)


class DocumentDownloadView(APIView):
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    @extend_schema(
        responses={
            (200, "application/pdf"): OpenApiTypes.BINARY,
            404: None,
        },
    )
    def get(self, request: Request, doc_id: str) -> HttpResponse:
        try:
            pdf_bytes, filename = DocumentService.download(doc_id)
            is_pdf = pdf_bytes[:4] == b"%PDF"

            if not is_pdf:
                # Arquivo antigo salvo como HTML (antes de WeasyPrint) — regenera do snapshot
                pdf_bytes = DocumentService.regenerate_from_snapshot(doc_id)
                is_pdf = pdf_bytes[:4] == b"%PDF"

            response = HttpResponse(pdf_bytes, content_type="application/pdf")
            response["Content-Disposition"] = f'inline; filename="{filename}"'
            return response
        except DocumentGeneration.DoesNotExist:
            return HttpResponse(status=404)
        except Exception as exc:
            logger.error("Erro ao baixar documento %s: %s", doc_id, exc)
            return HttpResponse(status=500)


class DocumentSnapshotView(APIView):
    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    @extend_schema(responses={200: DocumentSnapshotSerializer, 404: None})
    def get(self, request: Request, doc_id: str) -> Response:
        try:
            doc = DocumentGeneration.objects.get(pk=doc_id)
            return Response(DocumentSnapshotSerializer(doc).data)
        except DocumentGeneration.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
