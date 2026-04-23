import logging

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove

from .models import ImportAttempt
from .serializers import ImportAttemptSerializer
from .services import ImportService

logger = logging.getLogger(__name__)


class ImportAttemptViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista tentativas de importação com filtros."""

    serializer_class = ImportAttemptSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_queryset(self):  # type: ignore[override]
        qs = ImportAttempt.objects.select_related("service_order", "version_created").all()
        source = self.request.query_params.get("source")
        if source:
            qs = qs.filter(source=source)
        return qs

    @action(
        detail=False,
        methods=["post"],
        url_path="cilia/fetch",
        permission_classes=[IsAuthenticated, IsManagerOrAbove],
    )
    def fetch_cilia(self, request: Request) -> Response:
        """POST /imports/attempts/cilia/fetch/ — busca manual no Cília."""
        casualty = request.data.get("casualty_number", "").strip()
        budget = request.data.get("budget_number", "").strip()
        version = request.data.get("version_number")
        if not casualty or not budget:
            return Response(
                {"detail": "casualty_number e budget_number são obrigatórios."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        attempt = ImportService.fetch_cilia_budget(
            casualty_number=casualty,
            budget_number=budget,
            version_number=int(version) if version else None,
            trigger="user_requested",
            created_by=str(request.user),
        )
        return Response(ImportAttemptSerializer(attempt).data, status=status.HTTP_201_CREATED)

    @action(
        detail=False,
        methods=["post"],
        url_path="xml/upload",
        permission_classes=[IsAuthenticated, IsManagerOrAbove],
    )
    def upload_xml(self, request: Request) -> Response:
        """POST /imports/attempts/xml/upload/ — upload XML multipart."""
        file_obj = request.FILES.get("file")
        insurer_code = request.data.get("insurer_code", "").strip()
        if not file_obj or not insurer_code:
            return Response(
                {"detail": "file e insurer_code são obrigatórios."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        xml_bytes = file_obj.read()
        attempt = ImportService.import_xml_ifx(
            xml_bytes=xml_bytes,
            insurer_code=insurer_code,
            trigger="upload_manual",
            created_by=str(request.user),
        )
        return Response(ImportAttemptSerializer(attempt).data, status=status.HTTP_201_CREATED)
