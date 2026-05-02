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
from apps.inventory.views_product import (
    CategoriaInsumoViewSet,
    CategoriaProdutoViewSet,
    ProdutoComercialInsumoViewSet,
    ProdutoComercialPecaViewSet,
    TipoPecaViewSet,
)

router = SimpleRouter()
router.register(r"unidades", UnidadeFisicaViewSet, basename="unidade-fisica")
router.register(r"lotes", LoteInsumoViewSet, basename="lote-insumo")
router.register(r"impressoras", ImpressoraEtiquetaViewSet, basename="impressora-etiqueta")
router.register(r"armazens", ArmazemViewSet, basename="armazem")
router.register(r"ruas", RuaViewSet, basename="rua")
router.register(r"prateleiras", PrateleiraViewSet, basename="prateleira")
router.register(r"niveis", NivelViewSet, basename="nivel")
router.register(r"tipos-peca", TipoPecaViewSet, basename="tipo-peca")
router.register(r"categorias-produto", CategoriaProdutoViewSet, basename="categoria-produto")
router.register(r"categorias-insumo", CategoriaInsumoViewSet, basename="categoria-insumo")
router.register(r"produtos-peca", ProdutoComercialPecaViewSet, basename="produto-peca")
router.register(r"produtos-insumo", ProdutoComercialInsumoViewSet, basename="produto-insumo")

urlpatterns = [
    path("baixar-insumo/", BaixarInsumoView.as_view(), name="baixar-insumo"),
    path("", include(router.urls)),
]
