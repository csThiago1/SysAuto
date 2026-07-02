"""
Paddock Solutions — Service Orders: Calendar View
"""
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers, status

from django.db.models import Q

from ..models import ServiceOrder, ServiceOrderStatus
from ..serializers import ServiceOrderCalendarSerializer


class _DetailSerializer(serializers.Serializer):
    detail = serializers.CharField()


class CalendarView(APIView):
    """
    GET /service-orders/calendar/?date_start=YYYY-MM-DD&date_end=YYYY-MM-DD
    Retorna OS com scheduling_date ou estimated_delivery_date dentro do range.
    Exclui OS canceladas.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("date_start", str, description="YYYY-MM-DD"),
            OpenApiParameter("date_end", str, description="YYYY-MM-DD"),
        ],
        responses={
            200: ServiceOrderCalendarSerializer(many=True),
            400: _DetailSerializer,
        },
    )
    def get(self, request: Request) -> Response:
        """Retorna lista de OS no range de datas."""
        date_start = request.query_params.get("date_start")
        date_end = request.query_params.get("date_end")

        if not date_start or not date_end:
            return Response(
                {"detail": "Parâmetros date_start e date_end são obrigatórios."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from datetime import datetime as _datetime
            _datetime.strptime(date_start, "%Y-%m-%d")
            _datetime.strptime(date_end, "%Y-%m-%d")
        except ValueError:
            return Response(
                {"detail": "Formato de data inválido. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = (
            ServiceOrder.objects.filter(
                is_active=True,
            )
            .filter(
                Q(scheduling_date__date__range=(date_start, date_end))
                | Q(estimated_delivery_date__range=(date_start, date_end))
                | Q(delivery_date__date__range=(date_start, date_end))
            )
            .exclude(status=ServiceOrderStatus.CANCELLED)
            .select_related("created_by")
        )

        serializer = ServiceOrderCalendarSerializer(qs, many=True)
        return Response(serializer.data)
