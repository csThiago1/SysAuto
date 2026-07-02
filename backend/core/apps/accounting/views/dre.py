"""
Paddock Solutions — DRE View

GET /api/v1/accounting/dre/?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&cost_center_id=UUID
"""
import logging
from datetime import date, datetime

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounting.services.dre_service import DREService
from apps.authentication.permissions import IsManagerOrAbove


class _DetailSerializer(serializers.Serializer):
    detail = serializers.CharField()

logger = logging.getLogger(__name__)


class DREView(APIView):
    """Demonstração do Resultado do Exercício."""

    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    @extend_schema(
        parameters=[
            OpenApiParameter("start_date", str, description="YYYY-MM-DD"),
            OpenApiParameter("end_date", str, description="YYYY-MM-DD"),
            OpenApiParameter("cost_center_id", str, required=False, description="UUID"),
        ],
        responses={200: OpenApiTypes.OBJECT, 400: _DetailSerializer},
    )
    def get(self, request: Request) -> Response:
        """Retorna DRE para o período informado.

        Query params:
            start_date (obrigatório): YYYY-MM-DD
            end_date (obrigatório): YYYY-MM-DD
            cost_center_id (opcional): UUID do centro de custo
        """
        start_str = request.query_params.get("start_date")
        end_str = request.query_params.get("end_date")

        if not start_str or not end_str:
            return Response(
                {"detail": "Parâmetros start_date e end_date são obrigatórios."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            start_date = datetime.strptime(start_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_str, "%Y-%m-%d").date()
        except ValueError:
            return Response(
                {"detail": "Formato de data inválido. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if start_date > end_date:
            return Response(
                {"detail": "start_date não pode ser posterior a end_date."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cost_center_id = request.query_params.get("cost_center_id")

        dre = DREService.generate(
            start_date=start_date,
            end_date=end_date,
            cost_center_id=cost_center_id,
        )

        return Response(dre, status=status.HTTP_200_OK)
