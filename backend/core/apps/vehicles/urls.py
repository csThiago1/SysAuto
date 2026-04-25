"""vehicles URL configuration."""
from rest_framework.routers import SimpleRouter

from .views import VehicleViewSet

router = SimpleRouter()
router.register(r"", VehicleViewSet, basename="vehicle")

urlpatterns = router.urls
