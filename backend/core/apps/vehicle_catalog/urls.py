"""
Paddock Solutions — Vehicle Catalog URLs
"""

from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.vehicle_catalog.views import (
    VehicleColorViewSet,
    VehicleFamilyViewSet,
    VehicleMakeViewSet,
    VehicleModelViewSet,
    VehicleYearViewSet,
    plate_lookup,
)

router = DefaultRouter()
router.register(r"colors", VehicleColorViewSet, basename="vehicle-color")
router.register(r"makes", VehicleMakeViewSet, basename="vehicle-make")
router.register(r"families", VehicleFamilyViewSet, basename="vehicle-family")
router.register(r"models", VehicleModelViewSet, basename="vehicle-model")
router.register(r"years", VehicleYearViewSet, basename="vehicle-year")

urlpatterns = [
    path("plate/<str:plate>/", plate_lookup, name="vehicle-plate-lookup"),
    *router.urls,
]
