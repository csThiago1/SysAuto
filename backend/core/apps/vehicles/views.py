"""vehicles.views — VehicleViewSet com lookup action."""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.authentication.permissions import (
    IsConsultantOrAbove,
    IsManagerOrAbove,
    PermissionsByActionMixin,
)
from .models import Vehicle
from .serializers import VehicleSerializer
from .services import VehicleService


class VehicleViewSet(PermissionsByActionMixin, viewsets.ModelViewSet):
    """CRUD de veículos físicos + lookup de placa."""

    serializer_class = VehicleSerializer

    def get_queryset(self):  # type: ignore[override]
        return Vehicle.objects.filter(is_active=True).select_related("version")


    @action(detail=False, methods=["get"], url_path="lookup")
    def lookup(self, request: Request) -> Response:
        """GET /vehicles/lookup/?plate=ABC1D23 — DB-first então API externa."""
        plate = request.query_params.get("plate", "").strip()
        if not plate:
            return Response({"detail": "Parâmetro 'plate' obrigatório."}, status=400)
        result = VehicleService.lookup_plate(plate)
        if result is None:
            return Response({"detail": "Veículo não encontrado."}, status=404)
        return Response(result)
