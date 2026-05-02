from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.inventory.views import (
    BaixarInsumoView,
    ImpressoraEtiquetaViewSet,
    LoteInsumoViewSet,
    UnidadeFisicaViewSet,
)
from apps.inventory.views_location import (
    ArmazemViewSet,
    NivelViewSet,
    PrateleiraViewSet,
    RuaViewSet,
)

router = SimpleRouter()
router.register(r"unidades", UnidadeFisicaViewSet, basename="unidade-fisica")
router.register(r"lotes", LoteInsumoViewSet, basename="lote-insumo")
router.register(r"impressoras", ImpressoraEtiquetaViewSet, basename="impressora-etiqueta")
router.register(r"armazens", ArmazemViewSet, basename="armazem")
router.register(r"ruas", RuaViewSet, basename="rua")
router.register(r"prateleiras", PrateleiraViewSet, basename="prateleira")
router.register(r"niveis", NivelViewSet, basename="nivel")

urlpatterns = [
    path("baixar-insumo/", BaixarInsumoView.as_view(), name="baixar-insumo"),
    path("", include(router.urls)),
]
