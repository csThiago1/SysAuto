from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.inventory.views import (
    BaixarInsumoView,
    ImpressoraEtiquetaViewSet,
    LoteInsumoViewSet,
    UnidadeFisicaViewSet,
)
from apps.inventory.views_counting import (
    ContagemViewSet,
    RegistrarItemView,
)
from apps.inventory.views_location import (
    ArmazemViewSet,
    NivelViewSet,
    PrateleiraViewSet,
    RuaViewSet,
)
from apps.inventory.views_movement import (
    AprovacoesPendentesView,
    AprovarView,
    DashboardStatsView,
    DevolucaoView,
    EntradaLoteView,
    EntradaPecaView,
    MargemOSView,
    MovimentacaoViewSet,
    PerdaView,
    RejeitarView,
    TransferenciaView,
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
router.register(r"movimentacoes", MovimentacaoViewSet, basename="movimentacao")
router.register(r"contagens", ContagemViewSet, basename="contagem")

urlpatterns = [
    # Dashboard
    path("dashboard-stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    # Existing
    path("baixar-insumo/", BaixarInsumoView.as_view(), name="baixar-insumo"),
    # Movement
    path("entrada/peca/", EntradaPecaView.as_view(), name="entrada-peca"),
    path("entrada/lote/", EntradaLoteView.as_view(), name="entrada-lote"),
    path("devolucao/<uuid:unidade_id>/", DevolucaoView.as_view(), name="devolucao"),
    path("transferir/", TransferenciaView.as_view(), name="transferir"),
    path("perda/", PerdaView.as_view(), name="perda"),
    # Approval
    path("aprovacoes/pendentes/", AprovacoesPendentesView.as_view(), name="aprovacoes-pendentes"),
    path("aprovacoes/<uuid:pk>/aprovar/", AprovarView.as_view(), name="aprovar"),
    path("aprovacoes/<uuid:pk>/rejeitar/", RejeitarView.as_view(), name="rejeitar"),
    # Margin analysis
    path("margem-os/<uuid:os_id>/", MargemOSView.as_view(), name="margem-os"),
    # Counting item registration
    path("contagens/<uuid:contagem_id>/itens/<uuid:item_id>/", RegistrarItemView.as_view(), name="registrar-item"),
    # Router (MUST be last — catches remaining paths)
    path("", include(router.urls)),
]
