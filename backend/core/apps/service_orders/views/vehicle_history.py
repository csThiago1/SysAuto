"""
Paddock Solutions — Service Orders: VehicleHistoryView
Standalone APIView for plate-based vehicle history lookup.
"""
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import ServiceOrder


class VehicleHistoryView(APIView):
    """
    GET /service-orders/vehicle-history/?plate=ABC1234
    Busca veículo no histórico de OS por placa.
    Retorna dados do veículo + último cliente + contagem de visitas.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        plate_raw = request.query_params.get("plate", "").upper().replace("-", "").replace(" ", "")
        if len(plate_raw) < 7:
            return Response({"found": False, "results": []})

        qs = ServiceOrder.objects.filter(
            is_active=True,
            plate__iexact=plate_raw,
        ).order_by("-created_at")

        if not qs.exists():
            return Response({"found": False})

        latest = qs.first()
        assert latest is not None
        return Response({
            "found": True,
            "plate": plate_raw,
            "make": latest.make,
            "model": latest.model,
            "year": latest.year,
            "vehicle_version": latest.vehicle_version,
            "color": latest.color,
            "fuel_type": latest.fuel_type,
            "fipe_value": str(latest.fipe_value) if latest.fipe_value else None,
            "last_customer_name": latest.customer_name,
            "last_customer_uuid": str(latest.customer_uuid) if latest.customer_uuid else None,
            "visits": qs.count(),
            "last_visit": latest.created_at.date().isoformat() if latest.created_at else None,
        })
