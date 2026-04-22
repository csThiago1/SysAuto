from rest_framework.routers import DefaultRouter

from .views import SignatureViewSet


router = DefaultRouter()
router.register(r"signatures", SignatureViewSet, basename="signature")

urlpatterns = router.urls
