from rest_framework_nested import routers

from apps.payments.views import PaymentViewSet

from .views import ServiceOrderVersionViewSet, ServiceOrderViewSet
from .views_insurer import InsurerViewSet


router = routers.SimpleRouter()
router.register(r"insurers", InsurerViewSet, basename="insurer")
router.register(r"service-orders", ServiceOrderViewSet, basename="service-order")

os_router = routers.NestedSimpleRouter(router, r"service-orders", lookup="service_order")
os_router.register(r"versions", ServiceOrderVersionViewSet, basename="os-version")
os_router.register(r"payments", PaymentViewSet, basename="os-payment")


urlpatterns = router.urls + os_router.urls
