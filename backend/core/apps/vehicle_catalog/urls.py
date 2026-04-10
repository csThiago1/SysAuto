"""
Paddock Solutions — Vehicle Catalog URLs
"""
from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.vehicle_catalog.views import VehicleColorViewSet, plate_lookup

router = DefaultRouter()
router.register(r"colors", VehicleColorViewSet, basename="vehicle-color")

urlpatterns = [
    path("plate/<str:plate>/", plate_lookup, name="vehicle-plate-lookup"),
    *router.urls,
]
