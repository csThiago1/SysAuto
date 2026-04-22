"""Views DRF do app imports."""
from __future__ import annotations

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from rest_framework.parsers import FormParser, MultiPartParser

from .models import ImportAttempt
from .serializers import (
    FetchCiliaSerializer,
    ImportAttemptReadSerializer,
    UploadXmlIfxSerializer,
)
from .services import ImportService


class ImportAttemptViewSet(viewsets.ReadOnlyModelViewSet):
    """Listagem/detalhe de tentativas de importação.

    Endpoints extras:
        POST /imports/cilia/fetch/ — gatilho manual (trigger=user_requested)
    """

    queryset = ImportAttempt.objects.all()
    serializer_class = ImportAttemptReadSerializer
    filterset_fields = ["source", "parsed_ok", "http_status", "casualty_number"]
    search_fields = ["casualty_number", "budget_number", "raw_hash"]
    ordering_fields = ["created_at", "duration_ms"]

    @action(detail=False, methods=["post"], url_path="cilia/fetch")
    def fetch_cilia(self, request):
        """Fetch imediato de um orçamento Cilia (trigger manual).

        Body JSON:
          {
            "casualty_number": "406571903",
            "budget_number": "1446508",
            "version_number": 2  // opcional
          }

        Retorna o `ImportAttempt` resultante (sucesso ou falha — 201 sempre).
        """
        ser = FetchCiliaSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        attempt = ImportService.fetch_cilia_budget(
            casualty_number=ser.validated_data["casualty_number"],
            budget_number=ser.validated_data["budget_number"],
            version_number=ser.validated_data.get("version_number"),
            trigger="user_requested",
            created_by=getattr(request.user, "username", "API"),
        )
        return Response(
            ImportAttemptReadSerializer(attempt).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="xml/upload",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_xml_ifx(self, request):
        """Upload de XML IFX (Porto/Azul/Itaú).

        Multipart form data:
          - file: arquivo XML
          - insurer_code: "porto" | "azul" | "itau"
        """
        ser = UploadXmlIfxSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        file = ser.validated_data["file"]
        xml_bytes = file.read()

        attempt = ImportService.import_xml_ifx(
            xml_bytes=xml_bytes,
            insurer_code=ser.validated_data["insurer_code"],
            trigger="upload_manual",
            created_by=getattr(request.user, "username", "API"),
        )
        return Response(
            ImportAttemptReadSerializer(attempt).data,
            status=status.HTTP_201_CREATED,
        )
