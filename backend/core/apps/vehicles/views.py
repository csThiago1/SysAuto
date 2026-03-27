import logging

from django.http import JsonResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Vehicle, VehicleBrand, VehicleModel, VehicleVersion
from .serializers import (
    VehicleBrandSerializer,
    VehicleCreateSerializer,
    VehicleDetailSerializer,
    VehicleListSerializer,
    VehicleModelSerializer,
    VehicleVersionSerializer,
)
from .services import lookup_plate

logger = logging.getLogger(__name__)


class VehicleBrandViewSet(viewsets.ReadOnlyModelViewSet):
    """Catálogo FIPE — marcas. Read-only: populado via importação, não por API."""

    permission_classes = [IsAuthenticated]
    queryset = VehicleBrand.objects.all().order_by("name")
    serializer_class = VehicleBrandSerializer
    filterset_fields = ["vehicle_type"]
    search_fields = ["name"]

    @action(detail=True, methods=["get"], url_path="models")
    def list_models(self, request, pk=None):
        brand = self.get_object()
        models_qs = VehicleModel.objects.filter(brand=brand).order_by("name")
        serializer = VehicleModelSerializer(models_qs, many=True)
        return Response(serializer.data)


class VehicleModelViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = VehicleModel.objects.select_related("brand").order_by("name")
    serializer_class = VehicleModelSerializer
    filterset_fields = ["brand"]
    search_fields = ["name"]

    @action(detail=True, methods=["get"], url_path="versions")
    def list_versions(self, request, pk=None):
        vehicle_model = self.get_object()
        versions = VehicleVersion.objects.filter(model=vehicle_model).order_by("-year_model")
        serializer = VehicleVersionSerializer(versions, many=True)
        return Response(serializer.data)


class VehicleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Vehicle.objects.filter(is_active=True).select_related("version__model__brand").order_by("-created_at")
    filterset_fields = ["plate"]
    search_fields = ["plate", "description", "version__full_name"]

    def get_serializer_class(self):
        if self.action == "list":
            return VehicleListSerializer
        if self.action == "create":
            return VehicleCreateSerializer
        return VehicleDetailSerializer

    @action(detail=False, methods=["get"], url_path="lookup")
    def lookup(self, request):
        """
        GET /api/v1/vehicles/lookup/?plate=ABC1D23

        Retorna dados do veículo via API externa + catálogo FIPE local.
        Falha silenciosa: se a API externa não responder, retorna 404.
        """
        plate = request.query_params.get("plate", "").strip()
        if not plate:
            return Response({"detail": "Parâmetro 'plate' obrigatório."}, status=400)

        result = lookup_plate(plate)
        if result is None:
            return Response({"detail": "Veículo não encontrado para essa placa."}, status=404)

        return Response(result)
