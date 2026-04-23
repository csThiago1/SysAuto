"""payments URLs — para inclusão via nested pattern em service_orders/urls.py."""
from rest_framework.routers import SimpleRouter

from .views import PaymentViewSet

router = SimpleRouter()
router.register(r"", PaymentViewSet, basename="payment")

urlpatterns = router.urls
