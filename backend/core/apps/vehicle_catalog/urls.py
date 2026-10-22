"""
Paddock Solutions — Vehicle Catalog URLs
"""

from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.vehicle_catalog.views import (
    VehicleFamilyViewSet,
    VehicleMakeViewSet,
    VehicleModelViewSet,
    VehicleYearViewSet,
    colors_list,
)

router = DefaultRouter()
router.register(r"makes", VehicleMakeViewSet, basename="vehicle-make")
router.register(r"families", VehicleFamilyViewSet, basename="vehicle-family")
router.register(r"models", VehicleModelViewSet, basename="vehicle-model")
router.register(r"years", VehicleYearViewSet, basename="vehicle-year")

urlpatterns = [
    path("colors/", colors_list, name="vehicle-colors"),
    *router.urls,
]
