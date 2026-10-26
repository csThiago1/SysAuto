"""vehicles.views — VehicleViewSet."""

from rest_framework import viewsets

from apps.authentication.permissions import PermissionsByActionMixin

from .models import Vehicle
from .serializers import VehicleSerializer


class VehicleViewSet(PermissionsByActionMixin, viewsets.ModelViewSet):
    """CRUD de veículos físicos."""

    serializer_class = VehicleSerializer

    def get_queryset(self):  # type: ignore[override]
        return Vehicle.objects.filter(is_active=True).select_related("version")
