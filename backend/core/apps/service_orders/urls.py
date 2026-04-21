from rest_framework.routers import DefaultRouter

from .views import ServiceOrderViewSet
from .views_insurer import InsurerViewSet


router = DefaultRouter()
router.register(r"insurers", InsurerViewSet, basename="insurer")
router.register(r"service-orders", ServiceOrderViewSet, basename="service-order")

urlpatterns = router.urls
