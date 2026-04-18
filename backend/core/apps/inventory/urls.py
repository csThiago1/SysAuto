from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.inventory.views import (
    BaixarInsumoView,
    ImpressoraEtiquetaViewSet,
    LoteInsumoViewSet,
    UnidadeFisicaViewSet,
)

router = SimpleRouter()
router.register(r"unidades", UnidadeFisicaViewSet, basename="unidade-fisica")
router.register(r"lotes", LoteInsumoViewSet, basename="lote-insumo")
router.register(r"impressoras", ImpressoraEtiquetaViewSet, basename="impressora-etiqueta")

urlpatterns = [
    path("baixar-insumo/", BaixarInsumoView.as_view(), name="baixar-insumo"),
    path("", include(router.urls)),
]
