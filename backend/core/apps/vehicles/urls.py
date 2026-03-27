from rest_framework.routers import DefaultRouter

from .views import VehicleBrandViewSet, VehicleModelViewSet, VehicleViewSet

router = DefaultRouter()
router.register(r"brands", VehicleBrandViewSet, basename="vehicle-brand")
router.register(r"catalog-models", VehicleModelViewSet, basename="vehicle-model")
router.register(r"", VehicleViewSet, basename="vehicle")

urlpatterns = router.urls
