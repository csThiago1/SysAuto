from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.fiscal.views import FocusWebhookView, NFeEntradaViewSet

router = SimpleRouter()
router.register(r"nfe-entrada", NFeEntradaViewSet, basename="nfe-entrada")

urlpatterns = [
    # Webhook Focus NF-e — autenticação via secret no path
    path("webhooks/focus/<str:secret>/", FocusWebhookView.as_view(), name="focus-webhook"),
    # NF-e de entrada (MO-5)
    path("", include(router.urls)),
]
