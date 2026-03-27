from rest_framework.routers import DefaultRouter

from .views import ServiceOrderViewSet


router = DefaultRouter()
router.register(r"", ServiceOrderViewSet, basename="service-order")

urlpatterns = router.urls
