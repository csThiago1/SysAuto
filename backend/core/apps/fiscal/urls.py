from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.fiscal.views import NFeEntradaViewSet

router = SimpleRouter()
router.register(r"nfe-entrada", NFeEntradaViewSet, basename="nfe-entrada")

urlpatterns = [
    path("", include(router.urls)),
]
