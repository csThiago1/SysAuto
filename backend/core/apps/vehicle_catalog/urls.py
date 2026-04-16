"""
Paddock Solutions — Vehicle Catalog URLs
"""
from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.vehicle_catalog.views import (
    VehicleColorViewSet,
    VehicleMakeViewSet,
    VehicleModelViewSet,
    plate_lookup,
)

router = DefaultRouter()
router.register(r"colors", VehicleColorViewSet, basename="vehicle-color")
router.register(r"makes", VehicleMakeViewSet, basename="vehicle-make")
router.register(r"models", VehicleModelViewSet, basename="vehicle-model")

urlpatterns = [
    path("plate/<str:plate>/", plate_lookup, name="vehicle-plate-lookup"),
    *router.urls,
]
